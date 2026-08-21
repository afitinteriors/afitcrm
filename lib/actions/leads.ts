"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/auth";
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

// RLS on leads is still permissive (Phase 3B has not replaced it yet), so
// every write here enforces authorization explicitly rather than relying
// on the database. Admin is unrestricted. Staff may only act on a lead
// already assigned to them, and never touches assigned_to_id (no action
// below reads or writes that column).
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
  if (profile.role !== "admin") return { error: "Only admins can create leads." };

  const phone = str(formData, "phone");
  if (!phone) return { error: "Phone number is required." };

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
      status: "new",
    })
    .select("id")
    .single();

  if (error) return { error: error.message };

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

  const { error } = await supabase
    .from("leads")
    .update({
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
    })
    .eq("id", leadId);

  if (error) return { error: error.message };
  revalidateLead(leadId);
  redirect(`/leads/${leadId}`);
}

export async function setLeadStatus(leadId: string, status: LeadStatus): Promise<ActionState> {
  if (!LEAD_STATUSES.includes(status)) return { error: "Invalid status." };

  const supabase = await createClient();
  const accessError = await checkLeadAccess(supabase, leadId);
  if (accessError) return accessError;

  const update: LeadUpdate = { status };
  if (status !== "lost") update.lost_reason = null;
  const { error } = await supabase.from("leads").update(update).eq("id", leadId);
  revalidateLead(leadId);
  if (error) return { error: error.message };
  return null;
}

export async function markLeadWon(_prevState: ActionState, formData: FormData): Promise<ActionState> {
  const leadId = str(formData, "lead_id");
  const jobValue = optionalNumber(formData, "job_value");

  const supabase = await createClient();
  const accessError = await checkLeadAccess(supabase, leadId);
  if (accessError) return accessError;

  const { error } = await supabase
    .from("leads")
    .update({ status: "won", job_value: jobValue, lost_reason: null })
    .eq("id", leadId);

  revalidateLead(leadId);
  if (error) return { error: error.message };
  return null;
}

export async function markLeadLost(_prevState: ActionState, formData: FormData): Promise<ActionState> {
  const leadId = str(formData, "lead_id");
  const reason = str(formData, "lost_reason");
  if (!reason) return { error: "A lost reason is required." };

  const supabase = await createClient();
  const accessError = await checkLeadAccess(supabase, leadId);
  if (accessError) return accessError;

  const { error } = await supabase
    .from("leads")
    .update({ status: "lost", lost_reason: reason })
    .eq("id", leadId);

  revalidateLead(leadId);
  if (error) return { error: error.message };
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

  const { error } = await supabase
    .from("leads")
    .update({
      qualification_score: score,
      qualification_notes: optionalStr(formData, "qualification_notes"),
    })
    .eq("id", leadId);

  revalidateLead(leadId);
  if (error) return { error: error.message };
  return null;
}

export async function setSiteVisitDate(_prevState: ActionState, formData: FormData): Promise<ActionState> {
  const leadId = str(formData, "lead_id");
  const siteVisitDate = str(formData, "site_visit_date");
  if (!siteVisitDate) return { error: "Pick a date and time for the visit." };

  const supabase = await createClient();
  const accessError = await checkLeadAccess(supabase, leadId);
  if (accessError) return accessError;

  const { error } = await supabase
    .from("leads")
    .update({
      site_visit_date: new Date(siteVisitDate).toISOString(),
      status: "site_visit",
    })
    .eq("id", leadId);

  revalidateLead(leadId);
  if (error) return { error: error.message };
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

  const { error } = await supabase
    .from("leads")
    .update({ quotation_amount: amount, status: "quotation" })
    .eq("id", leadId);

  revalidateLead(leadId);
  if (error) return { error: error.message };
  return null;
}

export async function setJobValue(_prevState: ActionState, formData: FormData): Promise<ActionState> {
  const leadId = str(formData, "lead_id");
  const jobValue = optionalNumber(formData, "job_value");

  const supabase = await createClient();
  const accessError = await checkLeadAccess(supabase, leadId);
  if (accessError) return accessError;

  const { error } = await supabase.from("leads").update({ job_value: jobValue }).eq("id", leadId);

  revalidateLead(leadId);
  if (error) return { error: error.message };
  return null;
}
