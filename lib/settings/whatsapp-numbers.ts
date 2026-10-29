// Display helpers and static option lists for Settings -> WhatsApp
// Numbers. The data itself is now real, backed by public.whatsapp_numbers
// (supabase/migrations/20261029130000_whatsapp_numbers.sql) -- see
// lib/actions/whatsapp-numbers.ts for the reads/writes and that file's own
// WhatsAppNumber type (this module no longer defines one, to avoid two
// copies drifting apart).
import type { WhatsAppNumberPurpose, WhatsAppNumberStatus } from "@/lib/supabase/types";

export type NumberStatus = WhatsAppNumberStatus;
export type NumberPurpose = WhatsAppNumberPurpose;

export const NUMBER_STATUS_LABELS: Record<NumberStatus, string> = {
  connected: "Connected",
  needs_attention: "Needs attention",
  disconnected: "Disconnected",
};

export const NUMBER_STATUS_BADGE_CLASSES: Record<NumberStatus, string> = {
  connected: "bg-success-soft text-success",
  needs_attention: "bg-warning-soft text-warning",
  disconnected: "bg-danger-soft text-danger",
};

export const NUMBER_PURPOSES: NumberPurpose[] = ["Sales", "Support", "General"];

export function formatPhoneForDisplay(raw: string): string {
  const digits = raw.replace(/\D/g, "");
  if (digits.length === 10) return `+91 ${digits.slice(0, 5)} ${digits.slice(5)}`;
  if (digits.length > 10) return `+${digits.slice(0, digits.length - 10)} ${digits.slice(-10, -5)} ${digits.slice(-5)}`;
  return raw;
}
