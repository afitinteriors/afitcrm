import "server-only";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/auth";

// Read-only count for the header bell badge. notifications RLS is
// owner-only already (see CLAUDE.md's Current Database Reality); the
// explicit user_id filter is defense-in-depth, same convention lib/leads.ts
// uses alongside RLS.
export async function getUnreadNotificationCount(): Promise<number> {
  const profile = await getCurrentProfile();
  if (!profile) return 0;

  const supabase = await createClient();
  const { count, error } = await supabase
    .from("notifications")
    .select("id", { count: "exact", head: true })
    .eq("user_id", profile.id)
    .is("read_at", null);

  if (error) throw new Error(error.message);
  return count ?? 0;
}
