"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/auth";
import { recordAuditEvent } from "@/lib/audit";
import type { Database, LeadStatus, LeadUpdate } from "@/lib/supabase/types";
import { LEAD_STATUSES } from "@/lib/constants";

export type ActionState = { error: string } | null;

function str(formData: FormData, key: string): string {
  return String(formData.get(key) ?? "").trim();
}

function optionalStr(formData: FormData, key: string): string | null {
  const value = str(formData, key);
  return value.length ? value : null;
}

function optionalNumber(formData: FormData, key: string): number | null {
  const value = str(formData, key);
  if (!value.length) return null;
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
}

function revalidateLead(leadId: string) {
  revalidatePath("/leads");
  revalidatePath(`/leads/${leadId}`);
  revalidatePath("/dashboard");
}

// leads RLS now enforces ownership independently (see the leads_*_admin_or_*
// policies), but every write here still checks explicitly rather than
// relying on the database alone. Admin is unrestricted. Staff may only
// act on a lead already assigned to them via this helper; separately,
// createLead below forces assigned_to_id for a staff-created lead.
async function checkLeadAccess(
  supabase: SupabaseClient<Database>,
  leadId: string
): Promise<ActionState> {
  const profile = await getCurrentProfile();
  if (!profile) return { error: "Not signed in." };
  if (profile.role === "admin") return null;

  const { data: lead } = await supabase
    .from("leads")
    .select("assigned_to_id")
    .eq("id", leadId)
    .single();

  if (!lead || lead.assigned_to_id !== profile.id) {
    return { error: "You do not have access to this lead." };
  }
  return null;
}

export async function createLead(_prevState: ActionState, formData: FormData): Promise<ActionState> {
  const profile = await getCurrentProfile();
  if (!profile) return { error: "Not signed in." };

  const phone = str(formData, "phone");
  if (!phone) return { error: "Phone number is required." };

  // Staff-created leads are always self-owned. assigned_to_id is never
  // read from client input -- formData.get("assigned_to_id") is never
  // called here at all, so a crafted request field can't reach the
  // insert regardless of caller. Admin-created leads stay unassigned
  // (no assignee picker in this phase).
  const assignedToId = profile.role === "staff" ? profile.id : null;

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("leads")
    .insert({
      customer_name: optionalStr(formData, "customer_name"),
      phone,
      whatsapp_message: optionalStr(formData, "whatsapp_message"),
      source: str(formData, "source") || "manual",
      campaign_name: optionalStr(formData, "campaign_name"),
      location: optionalStr(formData, "location"),
      project_type: optionalStr(formData, "project_type"),
      service_required: optionalStr(formData, "service_required"),
      estimated_sqft: optionalNumber(formData, "estimated_sqft"),
      expected_start_date: optionalStr(formData, "expected_start_date"),
      assigned_to: optionalStr(formData, "assigned_to"),
      assigned_to_id: assignedToId,
      status: "new",
    })
    .select("id")
    .single();

  if (error) return { error: error.message };

  await recordAuditEvent({
    actorId: profile.id,
    action: "lead_created",
    targetType: "lead",
    targetId: data.id,
    metadata: { source: str(formData, "source") || "manual", status: "new" },
  });

  revalidatePath("/leads");
  revalidatePath("/dashboard");
  redirect(`/leads/${data.id}`);
}

export async function updateLead(_prevState: ActionState, formData: FormData): Promise<ActionState> {
  const leadId = str(formData, "lead_id");
  const phone = str(formData, "phone");
  if (!phone) return { error: "Phone number is required." };

  const supabase = await createClient();
  const accessError = await checkLeadAccess(supabase, leadId);
  if (accessError) return accessError;

  const update = {
    customer_name: optionalStr(formData, "customer_name"),
    phone,
    whatsapp_message: optionalStr(formData, "whatsapp_message"),
    source: str(formData, "source") || "manual",
    campaign_name: optionalStr(formData, "campaign_name"),
    location: optionalStr(formData, "location"),
    project_type: optionalStr(formData, "project_type"),
    service_required: optionalStr(formData, "service_required"),
    estimated_sqft: optionalNumber(formData, "estimated_sqft"),
    expected_start_date: optionalStr(formData, "expected_start_date"),
    assigned_to: optionalStr(formData, "assigned_to"),
  };

  const { error } = await supabase.from("leads").update(update).eq("id", leadId);

  if (error) return { error: error.message };

  const profile = await getCurrentProfile();
  if (profile) {
    await recordAuditEvent({
      actorId: profile.id,
      action: "lead_updated",
      targetType: "lead",
      targetId: leadId,
      metadata: { fields_changed: Object.keys(update) },
    });
  }

  revalidateLead(leadId);
  redirect(`/leads/${leadId}`);
}

// Admin-only by design -- staff must never reassign a lead. This check is
// deliberately stricter than checkLeadAccess (which lets staff act on a
// lead already assigned to them): assignment is not a "my lead" action.
// leads_update_admin_or_owner RLS backs this up independently -- its
// WITH CHECK requires assigned_to_id = auth.uid() on the *new* row for a
// non-admin, so even a crafted request that reached this far would still
// be rejected by the database if this check were somehow bypassed.
export async function assignLead(leadId: string, staffId: string): Promise<ActionState> {
  const profile = await getCurrentProfile();
  if (!profile) return { error: "Not signed in." };
  if (profile.role !== "admin") return { error: "Only an admin can assign leads." };

  const supabase = await createClient();

  const { data: targetStaff } = await supabase
    .from("profiles")
    .select("id")
    .eq("id", staffId)
    .eq("role", "staff")
    .single();
  if (!targetStaff) return { error: "Select a valid staff member." };

  const { data: current, error: fetchError } = await supabase
    .from("leads")
    .select("assigned_to_id")
    .eq("id", leadId)
    .single();
  if (fetchError || !current) return { error: "Lead not found." };

  // Re-selecting the current owner is a success no-op: no update, no audit
  // event, per the assignment semantics requirement.
  if (current.assigned_to_id === staffId) return null;

  const { data, error } = await supabase
    .from("leads")
    .update({ assigned_to_id: staffId })
    .eq("id", leadId)
    .select("id")
    .single();

  if (error || !data) return { error: "Could not assign this lead." };

  await recordAuditEvent({
    actorId: profile.id,
    action: "lead_assigned",
    targetType: "lead",
    targetId: data.id,
  });

  revalidateLead(leadId);
  return null;
}

export async function setLeadStatus(leadId: string, status: LeadStatus): Promise<ActionState> {
  if (!LEAD_STATUSES.includes(status)) return { error: "Invalid status." };

  // "won"/"lost" must only be reachable through markLeadWon/markLeadLost,
  // which capture the job_value/lost_reason that go with those transitions.
  // Rejected here server-side -- the UI already redirects instead of
  // calling this, but that's a client-side courtesy, not enforcement; a
  // direct call (or a request that skips the UI) must be blocked too.
  if (status === "won" || status === "lost") {
    return { error: "Use Mark as Won or Mark as Lost to set this status." };
  }

  const supabase = await createClient();
  const accessError = await checkLeadAccess(supabase, leadId);
  if (accessError) return accessError;

  // status is never "lost" here (rejected above), so lost_reason is always
  // cleared -- this path can only move a lead between open/invalid stages.
  const update: LeadUpdate = { status, lost_reason: null };
  const { error } = await supabase.from("leads").update(update).eq("id", leadId);
  revalidateLead(leadId);
  if (error) return { error: error.message };

  const profile = await getCurrentProfile();
  if (profile) {
    await recordAuditEvent({
      actorId: profile.id,
      action: "lead_updated",
      targetType: "lead",
      targetId: leadId,
      metadata: { fields_changed: Object.keys(update) },
    });
  }

  return null;
}

export async function markLeadWon(_prevState: ActionState, formData: FormData): Promise<ActionState> {
  const leadId = str(formData, "lead_id");
  const jobValue = optionalNumber(formData, "job_value");

  const supabase = await createClient();
  const accessError = await checkLeadAccess(supabase, leadId);
  if (accessError) return accessError;

  const wonUpdate: LeadUpdate = { status: "won", job_value: jobValue, lost_reason: null };
  const { error } = await supabase.from("leads").update(wonUpdate).eq("id", leadId);

  revalidateLead(leadId);
  if (error) return { error: error.message };

  const profile = await getCurrentProfile();
  if (profile) {
    await recordAuditEvent({
      actorId: profile.id,
      action: "lead_updated",
      targetType: "lead",
      targetId: leadId,
      metadata: { fields_changed: Object.keys(wonUpdate) },
    });
  }

  return null;
}

export async function markLeadLost(_prevState: ActionState, formData: FormData): Promise<ActionState> {
  const leadId = str(formData, "lead_id");
  const reason = str(formData, "lost_reason");
  if (!reason) return { error: "A lost reason is required." };

  const supabase = await createClient();
  const accessError = await checkLeadAccess(supabase, leadId);
  if (accessError) return accessError;

  const lostUpdate: LeadUpdate = { status: "lost", lost_reason: reason };
  const { error } = await supabase.from("leads").update(lostUpdate).eq("id", leadId);

  revalidateLead(leadId);
  if (error) return { error: error.message };

  const profile = await getCurrentProfile();
  if (profile) {
    await recordAuditEvent({
      actorId: profile.id,
      action: "lead_updated",
      targetType: "lead",
      targetId: leadId,
      metadata: { fields_changed: Object.keys(lostUpdate) },
    });
  }

  return null;
}

export async function setLeadQualification(
  _prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  const leadId = str(formData, "lead_id");
  const score = optionalNumber(formData, "qualification_score");
  if (score !== null && (score < 0 || score > 100)) {
    return { error: "Qualification score must be between 0 and 100." };
  }

  const supabase = await createClient();
  const accessError = await checkLeadAccess(supabase, leadId);
  if (accessError) return accessError;

  const qualificationUpdate = {
    qualification_score: score,
    qualification_notes: optionalStr(formData, "qualification_notes"),
  };
  const { error } = await supabase.from("leads").update(qualificationUpdate).eq("id", leadId);

  revalidateLead(leadId);
  if (error) return { error: error.message };

  const profile = await getCurrentProfile();
  if (profile) {
    await recordAuditEvent({
      actorId: profile.id,
      action: "lead_updated",
      targetType: "lead",
      targetId: leadId,
      metadata: { fields_changed: Object.keys(qualificationUpdate) },
    });
  }

  return null;
}

export async function setSiteVisitDate(_prevState: ActionState, formData: FormData): Promise<ActionState> {
  const leadId = str(formData, "lead_id");
  const siteVisitDate = str(formData, "site_visit_date");
  if (!siteVisitDate) return { error: "Pick a date and time for the visit." };

  const supabase = await createClient();
  const accessError = await checkLeadAccess(supabase, leadId);
  if (accessError) return accessError;

  // Recording a visit date is an activity record, not a stage transition --
  // the live stage (leads.status) only changes via an explicit StatusSelect
  // choice or Mark Won/Lost. See setQuotationAmount for the same rule.
  const siteVisitUpdate: LeadUpdate = {
    site_visit_date: new Date(siteVisitDate).toISOString(),
  };
  const { error } = await supabase.from("leads").update(siteVisitUpdate).eq("id", leadId);

  revalidateLead(leadId);
  if (error) return { error: error.message };

  const profile = await getCurrentProfile();
  if (profile) {
    await recordAuditEvent({
      actorId: profile.id,
      action: "lead_updated",
      targetType: "lead",
      targetId: leadId,
      metadata: { fields_changed: Object.keys(siteVisitUpdate) },
    });
  }

  return null;
}

export async function setQuotationAmount(
  _prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  const leadId = str(formData, "lead_id");
  const amount = optionalNumber(formData, "quotation_amount");
  if (amount === null || amount < 0) return { error: "Enter a valid quotation amount." };

  const supabase = await createClient();
  const accessError = await checkLeadAccess(supabase, leadId);
  if (accessError) return accessError;

  // Same rule as setSiteVisitDate: recording an amount is an activity
  // record, not a stage transition.
  const quotationUpdate: LeadUpdate = { quotation_amount: amount };
  const { error } = await supabase.from("leads").update(quotationUpdate).eq("id", leadId);

  revalidateLead(leadId);
  if (error) return { error: error.message };

  const profile = await getCurrentProfile();
  if (profile) {
    await recordAuditEvent({
      actorId: profile.id,
      action: "lead_updated",
      targetType: "lead",
      targetId: leadId,
      metadata: { fields_changed: Object.keys(quotationUpdate) },
    });
  }

  return null;
}

export async function setJobValue(_prevState: ActionState, formData: FormData): Promise<ActionState> {
  const leadId = str(formData, "lead_id");
  const jobValue = optionalNumber(formData, "job_value");

  const supabase = await createClient();
  const accessError = await checkLeadAccess(supabase, leadId);
  if (accessError) return accessError;

  const jobValueUpdate = { job_value: jobValue };
  const { error } = await supabase.from("leads").update(jobValueUpdate).eq("id", leadId);

  revalidateLead(leadId);
  if (error) return { error: error.message };

  const profile = await getCurrentProfile();
  if (profile) {
    await recordAuditEvent({
      actorId: profile.id,
      action: "lead_updated",
      targetType: "lead",
      targetId: leadId,
      metadata: { fields_changed: Object.keys(jobValueUpdate) },
    });
  }

  return null;
}
