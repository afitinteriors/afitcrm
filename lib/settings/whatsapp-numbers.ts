// UI/UX prototype only (this phase is design-first, per CLAUDE.md workflow) --
// no `whatsapp_numbers` table exists yet (CLAUDE.md §3 lists the real tables;
// this isn't one of them). Every number here lives in the workspace
// component's own state for this visit, the same deliberate choice already
// made for the Automation prototype (lib/automation/types.ts). Persisting
// this for real is a backend decision that needs explicit approval before a
// table gets created -- see the Phase completion report for what that would
// require.

export type NumberStatus = "connected" | "needs_attention" | "disconnected";

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

export const NUMBER_PURPOSES = ["Sales", "Support", "General"] as const;
export type NumberPurpose = (typeof NUMBER_PURPOSES)[number];

export type WhatsAppNumber = {
  id: string;
  label: string;
  phoneNumber: string;
  status: NumberStatus;
  purpose: NumberPurpose;
  // Empty array = "All staff can use this number" -- kept as an explicit
  // choice rather than null/undefined so the UI never has to guess what an
  // absent value means.
  assignedStaffIds: string[];
  isDefault: boolean;
};

export function formatPhoneForDisplay(raw: string): string {
  const digits = raw.replace(/\D/g, "");
  if (digits.length === 10) return `+91 ${digits.slice(0, 5)} ${digits.slice(5)}`;
  if (digits.length > 10) return `+${digits.slice(0, digits.length - 10)} ${digits.slice(-10, -5)} ${digits.slice(-5)}`;
  return raw;
}

export function seedWhatsAppNumbers(): WhatsAppNumber[] {
  return [
    {
      id: "seed-1",
      label: "Main Business Line",
      phoneNumber: "+91 80752 87437",
      status: "connected",
      purpose: "General",
      assignedStaffIds: [],
      isDefault: true,
    },
    {
      id: "seed-2",
      label: "Support Line",
      phoneNumber: "+91 96336 03670",
      status: "needs_attention",
      purpose: "Support",
      assignedStaffIds: [],
      isDefault: false,
    },
  ];
}
