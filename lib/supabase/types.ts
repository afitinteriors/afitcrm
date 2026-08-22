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
  | "audit_log_viewed";

export type AuditTargetType = "lead" | "conversation" | "message";

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
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};
