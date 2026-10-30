// Permission grants are real, backed by public.profile_permissions
// (supabase/migrations/20261029140000_profile_permissions.sql). "Add team
// member" is also real as of Blueprint Phase 1 (supabase/migrations/
// 20261030160000_team_member_lifecycle.sql) -- it creates a genuine
// Supabase Auth account via the Admin API and a matching profiles row; see
// lib/actions/team-permissions.ts for every mutation. PermissionKey itself
// comes from lib/supabase/types.ts (generated against profile_permissions'
// CHECK constraint) rather than being redeclared here, so the two can't
// drift.
import type { ProfileRole } from "@/lib/supabase/types";
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

// What TeamMemberFormModal collects before handing off to
// inviteTeamMember() (lib/actions/team-permissions.ts). No mobile number
// field -- profiles has no mobile column (Blueprint Section 11 doesn't
// list one either), so collecting one here would be a field that goes
// nowhere.
export type TeamMemberFormValues = {
  name: string;
  email: string;
  role: ProfileRole;
  telegramUsername: string;
};
