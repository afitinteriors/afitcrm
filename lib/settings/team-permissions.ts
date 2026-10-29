// The PERMISSION GRANTS half of this page is now real, backed by
// public.profile_permissions (supabase/migrations/
// 20261029140000_profile_permissions.sql) -- see lib/actions/
// team-permissions.ts for the reads/writes. PermissionKey itself now comes
// from lib/supabase/types.ts (generated against that table's CHECK
// constraint) rather than being redeclared here, so the two can't drift.
//
// Still a deliberate, documented UI-only draft: TeamMemberFormModal's "Add
// member" flow. Creating a real account needs Supabase Auth's Admin API /
// an invite-email mechanism -- a genuinely different, more security-
// sensitive piece of work than persisting a checkbox grid for EXISTING
// real profiles (getAllTeamMembers() already reads real `profiles` rows).
// That flow needs its own separate approval before it writes anything real
// -- nothing about it changed in this phase.
import type { PermissionKey } from "@/lib/supabase/types";
export type { PermissionKey };

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
