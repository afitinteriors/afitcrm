import { getCurrentProfile } from "@/lib/auth";
import { MobileMoreMenu } from "@/components/MobileMoreMenu";

// Always renders for both roles -- replaces the old MobileAdminMore, which
// returned null for staff entirely. Work items (Site Visits, Deals,
// Quotations) are staff-visible; only MobileMoreMenu's Management/System
// sections are conditional on isAdmin. Server Component so the profile
// fetch can stream in via Suspense without blocking the four core mobile
// tabs, same reasoning the old component had.
export async function MobileMoreEntry() {
  const profile = await getCurrentProfile();
  return <MobileMoreMenu isAdmin={profile?.role === "admin"} />;
}
