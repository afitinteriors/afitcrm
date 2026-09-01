// Types for the public.leads table (project: afitcrm / hivuaquqlwfwlbgtooko).
// Regenerate from the source of truth when convenient:
//   supabase gen types typescript --project-id hivuaquqlwfwlbgtooko > lib/supabase/types.ts

export type LeadStatus =
  | "new"
  | "contacted"
  | "qualified"
  | "site_visit"
  | "quotation"
  | "negotiation"
  | "won"
  | "lost"
  | "invalid";

export type LeadRow = {
  id: string;
  customer_name: string | null;
  phone: string;
  whatsapp_message: string | null;
  source: string | null;
  campaign_name: string | null;
  campaign_id: string | null;
  adset_name: string | null;
  adset_id: string | null;
  ad_name: string | null;
  ad_id: string | null;
  location: string | null;
  project_type: string | null;
  service_required: string | null;
  estimated_sqft: number | null;
  expected_start_date: string | null;
  status: LeadStatus;
  qualification_score: number | null;
  qualification_notes: string | null;
  site_visit_date: string | null;
  quotation_amount: number | null;
  job_value: number | null;
  lost_reason: string | null;
  assigned_to: string | null;
  assigned_to_id: string | null;
  created_at: string;
  updated_at: string;
  wa_message_id: string | null;
  wa_phone_number_id: string | null;
  wa_message_timestamp: string | null;
};

export type LeadInsert = Partial<Omit<LeadRow, "id" | "created_at" | "updated_at">> & {
  phone: string;
};

export type LeadUpdate = Partial<Omit<LeadRow, "id" | "created_at" | "updated_at">>;

export type ProfileRole = "admin" | "staff";

export type ProfileRow = {
  id: string;
  role: ProfileRole;
  display_name: string | null;
  created_at: string;
  updated_at: string;
};

export type ConversationStatus = "open" | "closed";

export type ConversationRow = {
  id: string;
  lead_id: string | null;
  wa_id: string;
  phone_number_id: string;
  status: ConversationStatus;
  created_at: string;
  updated_at: string;
};

export type ConversationInsert = Partial<Omit<ConversationRow, "id" | "created_at" | "updated_at">> & {
  wa_id: string;
  phone_number_id: string;
};

export type ConversationUpdate = Partial<Omit<ConversationRow, "id" | "created_at">>;

export type MessageDirection = "inbound" | "outbound";

export type MessageRow = {
  id: string;
  conversation_id: string;
  wa_message_id: string | null;
  direction: MessageDirection;
  message_type: string;
  body: string | null;
  media_id: string | null;
  media_storage_path: string | null;
  status: string | null;
  raw_payload: unknown;
  created_at: string;
  updated_at: string;
};

export type MessageInsert = Partial<Omit<MessageRow, "id" | "created_at" | "updated_at">> & {
  conversation_id: string;
  direction: MessageDirection;
  message_type: string;
};

export type MessageUpdate = Partial<Omit<MessageRow, "id" | "created_at" | "updated_at">>;

export type FollowUpType = "call" | "whatsapp_message" | "site_visit" | "quotation" | "meeting" | "follow_up";
export type FollowUpStatus = "pending" | "completed";

export type FollowUpRow = {
  id: string;
  lead_id: string;
  type: FollowUpType;
  due_date: string;
  due_time: string | null;
  status: FollowUpStatus;
  notes: string | null;
  assigned_to_id: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
};

export type FollowUpInsert = Partial<Omit<FollowUpRow, "id" | "created_at" | "updated_at">> & {
  lead_id: string;
  due_date: string;
};

export type FollowUpUpdate = Partial<Omit<FollowUpRow, "id" | "created_at" | "updated_at">>;

export type AuditAction =
  | "login"
  | "logout"
  | "lead_viewed"
  | "lead_created"
  | "lead_updated"
  | "conversation_viewed"
  | "message_sent"
  | "audit_log_viewed"
  | "follow_up_created"
  | "follow_up_completed"
  | "lead_assigned";

export type AuditTargetType = "lead" | "conversation" | "message" | "follow_up";

export type AuditLogRow = {
  id: string;
  actor_id: string;
  action: AuditAction;
  target_type: AuditTargetType | null;
  target_id: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
};

export type AuditLogInsert = Partial<Omit<AuditLogRow, "id" | "created_at">> & {
  actor_id: string;
  action: AuditAction;
};

// Phase 1 (schema + RLS only) of keyword-triggered, service-specific
// WhatsApp automation. No webhook/executor/UI wiring yet -- these types
// exist so the schema and this file stay in sync, matching this file's own
// convention of adding a table's types in the same session its migration
// lands, not deferring to whenever the first consumer is built.

export type ServiceRow = {
  id: string;
  name: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export type ServiceInsert = Partial<Omit<ServiceRow, "id" | "created_at" | "updated_at">> & {
  name: string;
};

export type ServiceUpdate = Partial<Omit<ServiceRow, "id" | "created_at">>;

export type ServiceKeywordRow = {
  id: string;
  service_id: string;
  keyword: string;
  priority: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export type ServiceKeywordInsert = Partial<Omit<ServiceKeywordRow, "id" | "created_at" | "updated_at">> & {
  service_id: string;
  keyword: string;
};

export type ServiceKeywordUpdate = Partial<Omit<ServiceKeywordRow, "id" | "created_at">>;

export type AutomationStatus = "draft" | "active";

export type AutomationRow = {
  id: string;
  service_id: string;
  name: string;
  status: AutomationStatus;
  actions: unknown;
  created_at: string;
  updated_at: string;
};

export type AutomationInsert = Partial<Omit<AutomationRow, "id" | "created_at" | "updated_at">> & {
  service_id: string;
  name: string;
};

export type AutomationUpdate = Partial<Omit<AutomationRow, "id" | "created_at">>;

export type AutomationRunStatus = "pending" | "matched" | "no_match" | "failed";

export type AutomationRunRow = {
  id: string;
  message_id: string;
  conversation_id: string;
  automation_id: string | null;
  matched_keyword: string | null;
  matched_service_id: string | null;
  status: AutomationRunStatus;
  error_message: string | null;
  session_id: string | null;
  created_at: string;
  completed_at: string | null;
};

export type AutomationRunInsert = Partial<Omit<AutomationRunRow, "id" | "created_at">> & {
  message_id: string;
  conversation_id: string;
};

export type AutomationRunUpdate = Partial<Omit<AutomationRunRow, "id" | "created_at">>;

// Conversational session state -- one row per currently-engaged (active or
// handed_off) automation flow for a conversation, distinct from
// automation_runs (one row per inbound message, keyed by message_id for
// per-message idempotency). automation_sessions_one_engaged_per_conversation
// (a partial unique index on conversation_id WHERE status IN
// ('active','handed_off')) is the real concurrency guard -- enforced in the
// database, not just in application code.
export type AutomationSessionStatus = "active" | "completed" | "failed" | "handed_off";

export type AutomationSessionRow = {
  id: string;
  conversation_id: string;
  automation_id: string | null;
  current_node_id: string;
  collected_data: Record<string, unknown>;
  status: AutomationSessionStatus;
  last_message_id: string | null;
  started_at: string;
  updated_at: string;
  completed_at: string | null;
};

export type AutomationSessionInsert = Partial<Omit<AutomationSessionRow, "id" | "started_at">> & {
  conversation_id: string;
  current_node_id: string;
};

export type AutomationSessionUpdate = Partial<Omit<AutomationSessionRow, "id" | "started_at">>;

// Media MVP (approved architecture, added 2026-09-01): a minimal,
// admin-only library of images/videos automation flows can send via
// send_image/send_video nodes. meta_media_id is null until the first
// successful send using this asset (lazy upload, cached, self-healing
// re-upload on rejection -- lib/automations/outbound-sender.ts).
export type AutomationMediaType = "image" | "video";

export type AutomationMediaRow = {
  id: string;
  name: string;
  media_type: AutomationMediaType;
  mime_type: string;
  storage_path: string;
  file_size_bytes: number;
  meta_media_id: string | null;
  created_at: string;
  updated_at: string;
};

export type AutomationMediaInsert = Partial<Omit<AutomationMediaRow, "created_at" | "updated_at">> & {
  name: string;
  media_type: AutomationMediaType;
  mime_type: string;
  storage_path: string;
  file_size_bytes: number;
};

export type AutomationMediaUpdate = Partial<Omit<AutomationMediaRow, "id" | "created_at">>;

export type Database = {
  public: {
    Tables: {
      leads: {
        Row: LeadRow;
        Insert: LeadInsert;
        Update: LeadUpdate;
        Relationships: [];
      };
      profiles: {
        Row: ProfileRow;
        Insert: never;
        Update: never;
        Relationships: [];
      };
      conversations: {
        Row: ConversationRow;
        Insert: ConversationInsert;
        Update: ConversationUpdate;
        Relationships: [];
      };
      messages: {
        Row: MessageRow;
        Insert: MessageInsert;
        Update: MessageUpdate;
        Relationships: [];
      };
      follow_ups: {
        Row: FollowUpRow;
        Insert: FollowUpInsert;
        Update: FollowUpUpdate;
        Relationships: [];
      };
      audit_logs: {
        Row: AuditLogRow;
        Insert: AuditLogInsert;
        Update: never;
        Relationships: [];
      };
      services: {
        Row: ServiceRow;
        Insert: ServiceInsert;
        Update: ServiceUpdate;
        Relationships: [];
      };
      service_keywords: {
        Row: ServiceKeywordRow;
        Insert: ServiceKeywordInsert;
        Update: ServiceKeywordUpdate;
        Relationships: [];
      };
      automations: {
        Row: AutomationRow;
        Insert: AutomationInsert;
        Update: AutomationUpdate;
        Relationships: [];
      };
      automation_runs: {
        Row: AutomationRunRow;
        Insert: AutomationRunInsert;
        Update: AutomationRunUpdate;
        Relationships: [];
      };
      automation_sessions: {
        Row: AutomationSessionRow;
        Insert: AutomationSessionInsert;
        Update: AutomationSessionUpdate;
        Relationships: [];
      };
      automation_media: {
        Row: AutomationMediaRow;
        Insert: AutomationMediaInsert;
        Update: AutomationMediaUpdate;
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};
