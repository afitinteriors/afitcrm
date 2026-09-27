import { NotificationsControl } from "@/components/NotificationsControl";
import { NotificationSoundControl } from "@/components/NotificationSoundControl";
import { getCurrentProfile } from "@/lib/auth";

// Available to every signed-in user (each person manages their own devices),
// unlike /settings, which is admin-only. Phase A is only the device opt-in;
// nothing here sends or lists notifications yet.
export default async function NotificationsPage() {
  const profile = await getCurrentProfile();

  return (
    <div className="max-w-xl">
      <h1 className="text-xl font-semibold text-foreground">Notifications</h1>
      <p className="mt-1 text-sm text-muted-foreground">Choose whether this device can receive AFIT CRM alerts.</p>
      <div className="mt-6 space-y-4">
        <NotificationsControl publicKey={process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? null} />
        {profile && <NotificationSoundControl userId={profile.id} />}
      </div>
    </div>
  );
}
