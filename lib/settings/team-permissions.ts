// UI/UX prototype only (this phase is design-first, per CLAUDE.md workflow) --
// no `permissions` table or `mobile` column exists yet (see CLAUDE.md's
// Current Database Reality / this project's Team & Permissions audit).
// Checkbox state here lives in the workspace component's own state for this
// visit, the same deliberate choice already made for WhatsApp Numbers
// (lib/settings/whatsapp-numbers.ts). Team MEMBERS shown are real
// (read from `profiles` via getAllTeamMembers()) -- only the PERMISSION
// grants are a local-only preview. Persisting permissions for real is a
// backend decision that needs its own explicit approval before a migration
// runs -- see the proposed migration plan from this phase's audit.

export type PermissionKey =
  | "leads_view_all"
  | "leads_reassign"
  | "leads_bulk_export"
  | "conversations_view_all"
  | "reports_view"
  | "automation_access"
  | "audit_log_view"
  | "settings_manage_whatsapp"
  | "settings_manage_team";

export type PermissionGroup = {
  label: string;
  items: { key: PermissionKey; label: string }[];
};

export const PERMISSION_GROUPS: PermissionGroup[] = [
  {
    label: "Leads",
    items: [
      { key: "leads_view_all", label: "View all leads (not just assigned)" },
      { key: "leads_reassign", label: "Reassign leads" },
      { key: "leads_bulk_export", label: "Bulk export leads" },
    ],
  },
  {
    label: "Conversations",
    items: [{ key: "conversations_view_all", label: "View all conversations" }],
  },
  {
    label: "Reports",
    items: [{ key: "reports_view", label: "View reports" }],
  },
  {
    label: "Automation",
    items: [{ key: "automation_access", label: "Access Automation Builder" }],
  },
  {
    label: "Audit Log",
    items: [{ key: "audit_log_view", label: "View audit log" }],
  },
  {
    label: "Settings",
    items: [
      { key: "settings_manage_whatsapp", label: "Manage WhatsApp numbers" },
      { key: "settings_manage_team", label: "Manage team" },
    ],
  },
];

// Draft only -- submitting this form never calls Supabase Auth or creates a
// real account. Real staff creation needs its own separate approval (the
// Admin API / invite-email mechanism flagged in this phase's audit), since
// it's a genuine security-sensitive action, not a styling/UI decision.
export type TeamMemberDraft = {
  id: string;
  name: string;
  mobile: string;
  email: string;
};
