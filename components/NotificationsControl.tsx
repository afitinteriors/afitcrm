"use client";

import { useEffect, useState } from "react";
import { currentSubscription, disablePush, enablePush, pushSupport } from "@/lib/push/client";
import { sendTestNotification } from "@/lib/actions/push";

type Status = "checking" | "unsupported" | "not-configured" | "disabled" | "enabling" | "enabled" | "denied" | "error";

const STATUS_TEXT: Record<Status, { label: string; tone: string }> = {
  checking: { label: "Checking this device…", tone: "text-muted-foreground" },
  unsupported: {
    label: "Not supported on this browser",
    tone: "text-muted-foreground",
  },
  "not-configured": {
    label: "Not available yet",
    tone: "text-muted-foreground",
  },
  disabled: {
    label: "Notifications are off on this device",
    tone: "text-muted-foreground",
  },
  enabling: { label: "Enabling…", tone: "text-muted-foreground" },
  enabled: {
    label: "Notifications are on for this device",
    tone: "text-success",
  },
  denied: { label: "Permission denied", tone: "text-danger" },
  error: { label: "Something went wrong", tone: "text-danger" },
};

// Explicit opt-in. Permission is requested only inside the Enable button's
// click handler -- never on mount, never on another page.
export function NotificationsControl({ publicKey }: { publicKey: string | null }) {
  const [status, setStatus] = useState<Status>("checking");
  const [detail, setDetail] = useState<string | null>(null);
  const [test, setTest] = useState<{
    state: "idle" | "sending" | "sent" | "error";
    message?: string;
  }>({ state: "idle" });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (pushSupport() === "unsupported") return void (!cancelled && setStatus("unsupported"));
      if (!publicKey) return void (!cancelled && setStatus("not-configured"));
      if (Notification.permission === "denied") return void (!cancelled && setStatus("denied"));
      const subscription = await currentSubscription().catch(() => null);
      if (!cancelled) setStatus(subscription && Notification.permission === "granted" ? "enabled" : "disabled");
    })();
    return () => {
      cancelled = true;
    };
  }, [publicKey]);

  async function onEnable() {
    if (!publicKey) return;
    setDetail(null);
    setStatus("enabling");
    const result = await enablePush(publicKey);
    if (result.ok) return setStatus("enabled");
    if (result.reason === "denied") return setStatus("denied");
    setStatus("error");
    setDetail(
      result.reason === "no-worker"
        ? "The app's background service isn't active yet. Reload the page and try again."
        : (result.message ?? "Could not enable notifications. Try again."),
    );
  }

  // Explicit click only -- never sent automatically. The server sends to the
  // signed-in user's own devices; nothing about the recipient comes from here.
  async function onSendTest() {
    setTest({ state: "sending" });
    const result = await sendTestNotification();
    setTest(
      "ok" in result
        ? {
            state: "sent",
            message: "Test sent. It should appear on this device in a moment.",
          }
        : { state: "error", message: result.error },
    );
  }

  async function onDisable() {
    setDetail(null);
    setTest({ state: "idle" });
    const result = await disablePush();
    if (result.ok) return setStatus("disabled");
    setStatus("error");
    setDetail(result.message);
  }

  const text = STATUS_TEXT[status];
  // Read only after mount (status leaves "checking" client-side), so no hydration mismatch.
  const isIos = status !== "checking" && /iphone|ipad|ipod/i.test(navigator.userAgent);
  const busy = status === "checking" || status === "enabling";

  return (
    <section className="rounded-xl border border-border bg-card p-4 shadow-sm" aria-labelledby="push-heading">
      <h2 id="push-heading" className="text-sm font-semibold text-foreground">
        Notifications on this device
      </h2>
      <p className="mt-1 text-xs text-muted-foreground">
        Turn this on to allow AFIT CRM to alert this browser or phone. Each device is enabled separately.
      </p>

      <p
        className={`mt-3 text-sm font-medium ${text.tone}`}
        role="status"
        data-testid="push-status"
        data-status={status}
      >
        {text.label}
      </p>
      {detail && <p className="mt-1 text-xs text-danger">{detail}</p>}
      {status === "denied" && (
        <p className="mt-1 text-xs text-muted-foreground">
          Notifications are blocked for this site. Allow them in your browser or device settings, then come back.
        </p>
      )}
      {isIos && status === "unsupported" && (
        <p className="mt-1 text-xs text-muted-foreground">
          On iPhone, add AFIT CRM to your Home Screen (Share → Add to Home Screen) and open it from there.
        </p>
      )}

      <div className="mt-3">
        {status === "enabled" ? (
          <>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={onSendTest}
                disabled={test.state === "sending"}
                className="min-h-11 rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50 lg:min-h-9"
              >
                {test.state === "sending" ? "Sending…" : "Send test notification"}
              </button>
              <button
                type="button"
                onClick={onDisable}
                className="min-h-11 rounded-lg border border-border bg-card px-4 text-sm font-medium text-foreground hover:bg-secondary lg:min-h-9"
              >
                Turn off on this device
              </button>
            </div>
            {test.state === "sent" && (
              <p className="mt-2 text-xs text-success" data-testid="push-test-result" role="status">
                {test.message}
              </p>
            )}
            {test.state === "error" && (
              <p className="mt-2 text-xs text-danger" data-testid="push-test-result" role="alert">
                {test.message}
              </p>
            )}
          </>
        ) : (
          <button
            type="button"
            onClick={onEnable}
            disabled={busy || status === "unsupported" || status === "not-configured" || status === "denied"}
            className="min-h-11 rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50 lg:min-h-9"
          >
            {status === "enabling" ? "Enabling…" : "Enable notifications"}
          </button>
        )}
      </div>
    </section>
  );
}
