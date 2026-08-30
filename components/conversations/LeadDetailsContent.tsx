import Link from "next/link";
import { StatusBadge } from "@/components/StatusBadge";
import { telLink, whatsappLink } from "@/lib/format";
import type { LeadRow } from "@/lib/supabase/types";

export function LeadDetailsContent({ lead }: { lead: Pick<LeadRow, "id" | "customer_name" | "phone" | "status" | "location" | "service_required"> | null }) {
  if (!lead) {
    return (
      <div className="p-4 text-sm text-muted-foreground">
        This conversation isn&apos;t linked to a lead yet.
      </div>
    );
  }

  return (
    <div className="space-y-5 p-4">
      <div className="flex items-center gap-3">
        <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-primary text-xl font-semibold text-primary-foreground">
          {(lead.customer_name || "?").charAt(0).toUpperCase()}
        </div>
        <div className="min-w-0">
          <p className="truncate text-base font-semibold text-foreground">{lead.customer_name || "Unnamed lead"}</p>
          <p className="text-sm text-muted-foreground">{lead.phone}</p>
        </div>
      </div>

      <StatusBadge status={lead.status} />

      <dl className="space-y-3 text-sm">
        {lead.location && (
          <div>
            <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Location</dt>
            <dd className="mt-0.5 text-foreground">{lead.location}</dd>
          </div>
        )}
        {lead.service_required && (
          <div>
            <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Service required</dt>
            <dd className="mt-0.5 text-foreground">{lead.service_required}</dd>
          </div>
        )}
      </dl>

      <div className="grid grid-cols-2 gap-2 pt-1">
        <a
          href={telLink(lead.phone)}
          aria-label={`Call ${lead.customer_name || "lead"}`}
          title="Call"
          className="flex h-11 items-center justify-center gap-2 rounded-lg border border-border text-sm font-medium text-foreground active:bg-secondary"
        >
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5">
            <path d="M1.5 4.5a3 3 0 013-3h1.372c.86 0 1.61.586 1.819 1.42l1.105 4.423a1.875 1.875 0 01-.694 1.955l-1.293.97c-.135.101-.164.249-.126.352a11.285 11.285 0 006.697 6.697c.103.038.25.009.352-.126l.97-1.293a1.875 1.875 0 011.955-.694l4.423 1.105c.834.209 1.42.959 1.42 1.82V19.5a3 3 0 01-3 3h-2.25C8.552 22.5 1.5 15.448 1.5 6.75V4.5z" />
          </svg>
          Call
        </a>
        <a
          href={whatsappLink(lead.phone)}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={`Message ${lead.customer_name || "lead"} on WhatsApp`}
          title="Message on WhatsApp"
          className="flex h-11 items-center justify-center gap-2 rounded-lg border border-border text-sm font-medium text-brand-700 active:bg-secondary"
        >
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5">
            <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.198.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.499-.669-.51-.173-.008-.371-.01-.57-.01s-.52.074-.792.372c-.273.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347zM20.52 3.449C12.831-3.984.194 1.4.192 11.987c0 2.113.55 4.176 1.596 6.006L0 24l6.157-1.611a11.936 11.936 0 005.83 1.485h.005c9.548 0 15.53-10.446 10.53-18.428zM12 21.785h-.004a9.878 9.878 0 01-5.031-1.378l-.361-.214-3.741.981.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.245c0-5.462 4.446-9.906 9.913-9.906 2.65 0 5.14 1.032 7.011 2.905a9.83 9.83 0 012.897 6.987C21.933 17.343 17.487 21.785 12 21.785z" />
          </svg>
          Chat
        </a>
      </div>

      <Link
        href={`/leads/${lead.id}`}
        className="block rounded-lg bg-gold py-2.5 text-center text-sm font-semibold text-gold-foreground active:bg-gold/85"
      >
        View full lead
      </Link>
    </div>
  );
}
