import Link from "next/link";
import { formatLakhs } from "@/lib/format";

// Real sum of open-pipeline leads' job_value (falling back to
// quotation_amount), from getStaffOverview(). No trend/sparkline is drawn --
// there's no historical time-series for this figure, and a decorative
// upward bar chart would imply a trend that isn't real data. Links to the
// existing Deals view (the real page backing this same pipeline).
export function StaffPipelineValue({ value }: { value: number }) {
  return (
    <Link href="/deals" className="block rounded-2xl border border-border bg-card p-4 transition-colors hover:bg-muted/40">
      <div className="flex items-center justify-between">
        <h3 className="flex items-center gap-1.5 text-sm font-semibold text-foreground">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} className="h-4 w-4 text-primary" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18.75a60.07 60.07 0 0115.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5v.75A.75.75 0 013 6h-.75m0 0v-.375c0-.621.504-1.125 1.125-1.125H20.625c.621 0 1.125.504 1.125 1.125V6h-.75m0 0v11.25M6 6.75h12" />
          </svg>
          Pipeline Value
        </h3>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-4 w-4 text-muted-foreground/70" aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
        </svg>
      </div>
      <p className="mt-2 text-2xl font-bold text-foreground">{value === 0 ? "₹0" : formatLakhs(value)}</p>
      <p className="text-xs text-muted-foreground">in active opportunities</p>
    </Link>
  );
}
