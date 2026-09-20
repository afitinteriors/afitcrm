import { NotificationsControl } from "@/components/NotificationsControl";

// Available to every signed-in user (each person manages their own devices),
// unlike /settings, which is admin-only. Phase A is only the device opt-in;
// nothing here sends or lists notifications yet.
export default function NotificationsPage() {
  return (
    <div className="max-w-xl">
      <h1 className="text-xl font-semibold text-foreground">Notifications</h1>
      <p className="mt-1 text-sm text-muted-foreground">Choose whether this device can receive AFIT CRM alerts.</p>
      <div className="mt-6">
        <NotificationsControl publicKey={process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? null} />
      </div>
    </div>
  );
}
