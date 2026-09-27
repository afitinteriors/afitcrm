import { getCurrentProfile } from "@/lib/auth";
import { HeaderAccountMenu } from "@/components/HeaderAccountMenu";

// Server wrapper: fetches the profile HeaderAccountMenu (client) needs to
// render, same data SidebarProfileFooter already uses.
export async function HeaderAccount({ dark = false }: { dark?: boolean }) {
  const profile = await getCurrentProfile();
  return <HeaderAccountMenu displayName={profile?.displayName ?? null} role={profile?.role ?? "staff"} dark={dark} />;
}
