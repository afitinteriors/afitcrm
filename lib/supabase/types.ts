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

export type Database = {
  public: {
    Tables: {
      leads: {
        Row: LeadRow;
        Insert: LeadInsert;
        Update: LeadUpdate;
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};
