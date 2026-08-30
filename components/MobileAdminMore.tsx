import { getCurrentProfile } from "@/lib/auth";
import { MobileMoreMenu } from "@/components/MobileMoreMenu";

// Same role check and same "hide, don't gate" caveat as SidebarAdminNav --
// real enforcement lives server-side/RLS on /automation and /audit-log
// themselves. Server Component so it can stream in via Suspense without
// blocking the 3 core mobile nav items for staff (who never see it).
export async function MobileAdminMore() {
  const profile = await getCurrentProfile();
  if (profile?.role !== "admin") return null;

  return <MobileMoreMenu />;
}
