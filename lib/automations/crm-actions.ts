import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, LeadUpdate } from "@/lib/supabase/types";
import type { CapturableLeadField } from "./graph-schema";
import { toCanonicalPhone } from "@/lib/phone";

// Webhook-context (service-role) CRM operations for the automation executor.
// The existing lib/actions/leads.ts Server Actions (createLead, updateLead,
// ...) all require getCurrentProfile() -- a real user session -- which the
// webhook never has. This is the one file where automation code touches
// Supabase directly for CRM effects, kept separate from matching.ts/text.ts
// (which stay pure) so a future migration away from Supabase only has one
// integration surface to replace for this feature.

export type CreateOrLinkLeadContext = {
  conversationId: string;
  phone: string;
  customerName: string | null;
  serviceName: string;
  // Owner for a lead this call genuinely INSERTS -- never applied to an
  // existing lead, a concurrent-race winner reused by the loser, or anything
  // else. Only the WABIS ingestion path supplies it (see
  // lib/whatsapp/parse-wabis.ts); the automation executor never does, so
  // automation-created leads keep their existing unassigned behavior.
  defaultAssigneeId?: string;
};

export type CreateOrLinkLeadResult = {
  leadId: string;
  created: boolean;
};

// PostgreSQL SQLSTATE for unique_violation, as surfaced by PostgREST.
const UNIQUE_VIOLATION = "23505";

// Resolves a requested default assignee to a usable leads.assigned_to_id, or
// null. The id must belong to an existing `staff` profile -- the same target
// rule assignLead() enforces for a manual assignment. Anything else (not
// found, wrong role, lookup error) yields null so the lead is still created,
// unassigned, exactly as before this option existed: an invalid id reaching
// the insert would fail leads_assigned_to_id_fkey, and that throw would be
// swallowed by ingest.ts's best-effort try/catch -- silently losing the lead.
// Never throws. Logs no identifiers.
async function resolveDefaultAssignee(
  supabase: SupabaseClient<Database>,
  assigneeId: string | undefined
): Promise<string | null> {
  if (!assigneeId) return null;
  try {
    const { data, error } = await supabase
      .from("profiles")
      .select("id")
      .eq("id", assigneeId)
      .eq("role", "staff")
      .limit(1);
    if (!error && data && data.length === 1) return assigneeId;
  } catch {
    // fall through -- a thrown lookup must not cost us the lead either
  }
  console.error("Default lead assignee could not be validated; creating the lead unassigned.");
  return null;
}

async function findLeadsByPhoneExact(
  supabase: SupabaseClient<Database>,
  phone: string
): Promise<{ id: string }[]> {
  // Exact phone match only, mirroring the webhook's own
  // findLeadByExactPhone -- 0 or 2+ matches are handled explicitly by the
  // caller rather than guessing which lead (if any) this is. Excludes
  // retired/merged leads (merged_into_id set), same "active leads only"
  // convention as lib/leads.ts's getLeads() -- a phone that only matches a
  // merged lead is treated as no match rather than reviving a retired record.
  const { data, error } = await supabase
    .from("leads")
    .select("id")
    .eq("phone", phone)
    .is("merged_into_id", null)
    .limit(2);
  if (error) {
    throw new Error(`Failed to look up lead by phone: ${error.message}`);
  }
  return data ?? [];
}

export async function createOrLinkLeadForConversation(
  supabase: SupabaseClient<Database>,
  context: CreateOrLinkLeadContext
): Promise<CreateOrLinkLeadResult> {
  // Canonicalized to E.164 (lib/phone.ts) so +91/91/bare-national Indian
  // variants, and international numbers by their real country code, all
  // resolve to the same lead -- and so newly created leads are stored in
  // canonical form going forward. An unparseable phone is a real,
  // actionable data problem for an action specifically configured to
  // create-or-link a lead, so it fails the run rather than silently
  // storing a garbage value.
  const canonical = toCanonicalPhone(context.phone);
  if (!canonical.ok) {
    throw new Error(`Cannot create or link a lead: phone number could not be parsed (${canonical.reason}).`);
  }
  const canonicalPhone = canonical.e164;

  let existingLeads = await findLeadsByPhoneExact(supabase, canonicalPhone);
  // Legacy fallback: leads created before canonicalization was introduced
  // may still have the original raw phone value stored (no backfill has
  // been run -- see lib/phone.ts). Only tried when nothing matched the
  // canonical form and the raw input actually differs from it.
  if (existingLeads.length === 0 && context.phone !== canonicalPhone) {
    existingLeads = await findLeadsByPhoneExact(supabase, context.phone);
  }

  if (existingLeads.length > 1) {
    // Unlike the webhook's own find-or-create (which fails closed to
    // "unlinked" for a plain inbound message), an action that was
    // specifically configured to create-or-link a lead should not silently
    // do nothing here -- that's a real, actionable data problem worth
    // surfacing as a failed run rather than a quiet no-op.
    throw new Error(`Ambiguous phone match: ${existingLeads.length} leads found for this phone number.`);
  }

  let leadId: string | null = existingLeads.length === 1 ? existingLeads[0].id : null;
  let created = false;

  if (!leadId) {
    // Only reached when no active lead exists for this phone -- the one
    // branch that can insert. Validated before the insert so a bad id can
    // never cost us the lead itself.
    const assigneeId = await resolveDefaultAssignee(supabase, context.defaultAssigneeId);
    const { data: newLead, error: insertError } = await supabase
      .from("leads")
      .insert({
        phone: canonicalPhone,
        customer_name: context.customerName,
        service_required: context.serviceName,
        source: "whatsapp",
        // Omitted entirely (not null) when there's no assignee, so an insert
        // without one is byte-for-byte what it was before this option.
        ...(assigneeId ? { assigned_to_id: assigneeId } : {}),
      })
      .select("id")
      .single();

    if (insertError?.code === UNIQUE_VIOLATION) {
      // Lost a race: a concurrent request inserted the active lead for this
      // phone between our lookup and our insert, and the database's partial
      // unique index (leads_active_phone_unique_idx) rejected ours. That is a
      // normal, expected outcome, not a failure -- reuse the winner. The
      // index is what makes this safe; the lookup alone could not.
      const winners = await findLeadsByPhoneExact(supabase, canonicalPhone);
      if (winners.length !== 1) {
        throw new Error(`Failed to create lead: ${insertError.message}`);
      }
      leadId = winners[0].id;
    } else if (insertError || !newLead) {
      throw new Error(`Failed to create lead: ${insertError?.message ?? "unknown error"}`);
    } else {
      leadId = newLead.id;
      created = true;
    }
  }

  if (!created) {
    // Existing lead (found up front, or the concurrent winner above). Never
    // overwrite an existing service_required -- same "don't clobber a value
    // that's already there" convention as the webhook's own
    // applyReferralToLead (.is("ad_id", null)). Nothing else on the existing
    // lead (name, assignee, status, job data) is touched.
    const { error: updateError } = await supabase
      .from("leads")
      .update({ service_required: context.serviceName })
      .eq("id", leadId)
      .is("service_required", null);

    if (updateError) {
      throw new Error(`Failed to update existing lead's service_required: ${updateError.message}`);
    }
  }

  // Link the conversation to the lead if it isn't already linked -- same
  // never-clobber convention as above.
  const { error: linkError } = await supabase
    .from("conversations")
    .update({ lead_id: leadId })
    .eq("id", context.conversationId)
    .is("lead_id", null);

  if (linkError) {
    throw new Error(`Failed to link conversation to lead: ${linkError.message}`);
  }

  return { leadId, created };
}

export type CaptureLeadFieldContext = {
  conversationId: string;
  fieldKey: CapturableLeadField;
  replyText: string;
};

const APPEND_NOTE_MAX_ATTEMPTS = 5;

// Appends a line to leads.qualification_notes without losing a concurrent
// writer's own append. The prior version here read the current value then
// wrote the concatenated result unconditionally -- a classic read-modify-
// write lost update: two concurrent replies both reading the same base
// value would have the second writer's blind UPDATE silently erase the
// first's line entirely (reproduced deterministically before this fix:
// two sequential writes from the same base left only the second writer's
// text, the first's line gone with no error). Fixed as an optimistic
// compare-and-swap retry loop -- the same pattern this codebase's
// session-state code already uses via current_node_id/status
// (lib/automations/sessions.ts): each attempt reads the current value,
// computes the new value from that exact snapshot, then writes conditioned
// on qualification_notes still equalling that snapshot. A concurrent
// writer that commits first invalidates the condition, so the loser's
// write affects 0 rows (never silently overwrites) and retries against the
// now-current value instead of being lost. No RPC or raw SQL expression
// needed -- every step uses the existing Supabase update/select API,
// exactly the "atomic conditional write, not read-then-write" the fix
// requires.
async function appendQualificationNote(
  supabase: SupabaseClient<Database>,
  leadId: string,
  label: string,
  value: string
): Promise<void> {
  const line = `[Automation] ${label}: ${value}`;

  for (let attempt = 0; attempt < APPEND_NOTE_MAX_ATTEMPTS; attempt++) {
    const { data: lead, error: fetchError } = await supabase
      .from("leads")
      .select("qualification_notes")
      .eq("id", leadId)
      .single();

    if (fetchError || !lead) {
      throw new Error(`Failed to load lead for qualification note: ${fetchError?.message ?? "not found"}`);
    }

    const base = lead.qualification_notes;
    const updated = base ? `${base}\n${line}` : line;

    let query = supabase.from("leads").update({ qualification_notes: updated }).eq("id", leadId);
    query = base === null ? query.is("qualification_notes", null) : query.eq("qualification_notes", base);

    const { data, error: updateError } = await query.select("id");

    if (updateError) {
      throw new Error(`Failed to append qualification note: ${updateError.message}`);
    }
    if ((data?.length ?? 0) > 0) return; // won the compare-and-swap -- our line is persisted.
    // Lost the race -- qualification_notes changed between our read and
    // write. Retry against the now-current value rather than dropping this
    // note.
  }

  throw new Error(
    `Failed to append qualification note after ${APPEND_NOTE_MAX_ATTEMPTS} attempts due to repeated concurrent writes.`
  );
}

// Writes a never-clobber text field (only if currently null) using the
// existing atomic `.is(column, null)` conditional update -- this part was
// already race-safe for the lead ROW (only one concurrent writer's value
// can ever land, exactly like service_required above). What was missing:
// the caller always used its OWN replyText for collected_data regardless
// of whether its write actually won, so a losing execution's session
// bookkeeping could disagree with what's really in the lead row. Fixed by
// always reading back and returning the field's actual, currently-
// persisted value -- whether this call's own write won or a concurrent
// writer's did -- so two concurrent executions racing for the same field
// both report the SAME confirmed value to their caller, regardless of
// which one physically wrote it. That's what keeps a session's
// collected_data consistent with the real lead row under concurrency:
// whichever execution later wins the separate session-level optimistic-
// concurrency race (sessions.ts) writes a collected_data value that
// matches the lead row either way.
async function captureNeverClobberTextField(
  supabase: SupabaseClient<Database>,
  leadId: string,
  column: "customer_name" | "location" | "project_type",
  value: string
): Promise<string> {
  const patch: LeadUpdate = { [column]: value };
  const { data: written, error: updateError } = await supabase
    .from("leads")
    .update(patch)
    .eq("id", leadId)
    .is(column, null)
    .select(column)
    .maybeSingle();

  if (updateError) {
    throw new Error(`Failed to capture ${column}: ${updateError.message}`);
  }
  if (written) {
    return (written as Record<string, string>)[column];
  }

  // Lost the never-clobber write -- another execution's value is already
  // there. Read it back rather than assuming our own replyText "took".
  const { data: current, error: readError } = await supabase.from("leads").select(column).eq("id", leadId).single();
  if (readError || !current) {
    throw new Error(`Failed to read back ${column} after a lost capture race: ${readError?.message ?? "not found"}`);
  }
  return (current as Record<string, string>)[column];
}

// This is a technical wait-and-store step, not a customer-facing question --
// it never sends anything. It requires the conversation to already be
// linked to a lead (normally via a preceding create_or_link_lead node); if
// not, that's a real, actionable configuration problem worth surfacing as a
// failed run rather than silently discarding the customer's reply.
//
// Returns the value that should be recorded into the session's
// collected_data for this field -- the actual, DB-confirmed value after
// this field's own write/never-clobber race resolves, not necessarily this
// call's own replyText. See captureNeverClobberTextField's comment for why.
export async function captureLeadField(
  supabase: SupabaseClient<Database>,
  context: CaptureLeadFieldContext
): Promise<string> {
  const replyText = context.replyText.trim();

  const { data: conversation, error: conversationError } = await supabase
    .from("conversations")
    .select("lead_id")
    .eq("id", context.conversationId)
    .single();

  if (conversationError || !conversation) {
    throw new Error(`Failed to look up conversation for capture: ${conversationError?.message ?? "not found"}`);
  }
  if (!conversation.lead_id) {
    throw new Error("Cannot capture a lead field -- this conversation has no linked lead yet.");
  }

  const leadId = conversation.lead_id;

  if (context.fieldKey === "notes") {
    await appendQualificationNote(supabase, leadId, "Notes", replyText);
    return replyText;
  }

  if (context.fieldKey === "estimated_sqft") {
    const match = replyText.match(/\d+(\.\d+)?/);
    const value = match ? Number(match[0]) : NaN;
    if (Number.isFinite(value) && value > 0) {
      const { data: written, error } = await supabase
        .from("leads")
        .update({ estimated_sqft: value })
        .eq("id", leadId)
        .is("estimated_sqft", null)
        .select("estimated_sqft")
        .maybeSingle();
      if (error) throw new Error(`Failed to capture estimated_sqft: ${error.message}`);

      if (written) return String(written.estimated_sqft);

      // Lost the never-clobber write -- read back the real, currently-
      // persisted number rather than reporting our own parsed value.
      const { data: current, error: readError } = await supabase
        .from("leads")
        .select("estimated_sqft")
        .eq("id", leadId)
        .single();
      if (readError || !current) {
        throw new Error(
          `Failed to read back estimated_sqft after a lost capture race: ${readError?.message ?? "not found"}`
        );
      }
      return String(current.estimated_sqft);
    }
    // No parseable number in the reply -- never discard the customer's
    // answer, fall back to a labeled note instead of writing garbage into
    // a numeric column.
    await appendQualificationNote(supabase, leadId, "Area/sqft (unparsed)", replyText);
    return replyText;
  }

  // customer_name / location / project_type -- never-clobber, race-safe
  // writes via captureNeverClobberTextField above.
  return captureNeverClobberTextField(supabase, leadId, context.fieldKey, replyText);
}
