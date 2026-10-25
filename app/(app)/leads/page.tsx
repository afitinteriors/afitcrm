import Link from "next/link";
import { buildLeadsQueryString, getCampaignOptions, getLeads } from "@/lib/leads";
import { LeadsFilterBar } from "@/components/LeadsFilterBar";
import { LeadRow } from "@/components/LeadRow";
import { LeadCard } from "@/components/LeadCard";
import { PipelineBoard } from "@/components/leads/PipelineBoard";
import { getCurrentProfile } from "@/lib/auth";

export default async function LeadsPage({
  searchParams,
}: {
  searchParams: Promise<{
    search?: string;
    status?: string;
    campaign?: string;
    assignment?: string;
    datePreset?: string;
    dateFrom?: string;
    dateTo?: string;
    view?: string;
  }>;
}) {
  const params = await searchParams;
  const search = params.search ?? "";
  const status = params.status ?? "";
  const campaign = params.campaign ?? "";
  const assignment = params.assignment ?? "";
  const datePreset = params.datePreset ?? "";
  const dateFrom = params.dateFrom ?? "";
  const dateTo = params.dateTo ?? "";
  // "board" is a new, purely presentational read-only Kanban view over the
  // same getLeads() result -- not a new entity, not persisted anywhere, so
  // an unrecognized/missing value just falls back to the existing list.
  const view = params.view === "board" ? "board" : "list";

  const [leads, campaignOptions, profile] = await Promise.all([
    getLeads({ search, status, campaign, assignment, datePreset, dateFrom, dateTo }),
    getCampaignOptions(),
    getCurrentProfile(),
  ]);

  const heading = profile?.role === "staff" ? "My Leads" : "Leads";
  const description =
    profile?.role === "staff"
      ? "Leads currently assigned to you."
      : "All leads across every campaign and staff member.";
  const listQuery = buildLeadsQueryString({ search, status, campaign, assignment, datePreset, dateFrom, dateTo });
  const viewHref = (next: "list" | "board") => {
    const qs = listQuery ? `${listQuery}&view=${next}` : `view=${next}`;
    return next === "list" ? (listQuery ? `/leads?${listQuery}` : "/leads") : `/leads?${qs}`;
  };

  return (
    // Phase 0a dark-glass surface (CLAUDE.md §2), same bounded pattern as
    // Dashboard/Lead Detail: only this page's own shell/local markup (and
    // the Board view, which is this page's own component) uses the new
    // tokens. LeadsFilterBar and the List view's table/LeadCard are shared
    // with /today and other call sites -- left untouched, they read fine as
    // light widgets on the dark canvas.
    <div className="rounded-2xl bg-gradient-dark-bg p-4 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-surface-foreground">{heading}</h1>
          <p className="mt-1 text-sm text-surface-foreground-muted">{description}</p>
        </div>

        {/* View toggle -- List is the existing, unchanged default; Board is
            new and read-only (no drag-and-drop, per the owner's decision). */}
        <div className="flex h-10 shrink-0 items-center rounded-md border border-white/10 bg-glass p-0.5 text-sm backdrop-blur-sm">
          <Link
            href={viewHref("list")}
            aria-current={view === "list" ? "page" : undefined}
            className={`flex h-full items-center rounded-[5px] px-3 font-medium ${
              view === "list" ? "bg-primary text-primary-foreground" : "text-surface-foreground-muted hover:text-surface-foreground"
            }`}
          >
            List
          </Link>
          <Link
            href={viewHref("board")}
            aria-current={view === "board" ? "page" : undefined}
            className={`flex h-full items-center rounded-[5px] px-3 font-medium ${
              view === "board" ? "bg-primary text-primary-foreground" : "text-surface-foreground-muted hover:text-surface-foreground"
            }`}
          >
            Board
          </Link>
        </div>
      </div>

      {profile?.role === "admin" && (
        <Link href="/leads/unassigned" className="mt-3 inline-flex min-h-11 items-center text-sm font-semibold text-primary hover:underline">
          Review unassigned leads
        </Link>
      )}

      <div className="mt-4">
        <LeadsFilterBar
          search={search}
          status={status}
          campaign={campaign}
          assignment={assignment}
          showAssignment={profile?.role === "admin"}
          campaignOptions={campaignOptions}
          datePreset={datePreset}
          dateFrom={dateFrom}
          dateTo={dateTo}
        />
      </div>

      <p className="mt-4 text-xs text-surface-foreground-muted">
        {leads.length} {leads.length === 1 ? "lead" : "leads"}
      </p>

      {leads.length === 0 ? (
        <div className="mt-2 rounded-lg border border-white/10 bg-glass p-8 text-center text-sm text-surface-foreground-muted shadow-sm">
          No leads match your filters.
        </div>
      ) : view === "board" ? (
        <PipelineBoard leads={leads} listQuery={listQuery} showAssignee={profile?.role === "admin"} />
      ) : (
        <>
          {/* Desktop: table. Mobile: dedicated cards below, not a squeezed table. */}
          <div className="mt-2 hidden overflow-x-auto rounded-lg border border-border bg-card shadow-sm lg:block">
            <table className="min-w-full divide-y divide-border text-sm">
              <thead className="bg-muted">
                <tr>
                  <th className="px-4 py-2 text-left font-medium text-muted-foreground">Customer</th>
                  <th className="px-4 py-2 text-left font-medium text-muted-foreground">Status</th>
                  <th className="px-4 py-2 text-left font-medium text-muted-foreground">Owner</th>
                  <th className="px-4 py-2 text-left font-medium text-muted-foreground">Value</th>
                  <th className="px-4 py-2 text-left font-medium text-muted-foreground">Created</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {leads.map((lead) => (
                  <LeadRow key={lead.id} lead={lead} listQuery={listQuery} />
                ))}
              </tbody>
            </table>
          </div>

          <ul className="-mx-2 mt-1 lg:hidden">
            {leads.map((lead) => (
              <LeadCard key={lead.id} lead={lead} showAssignee={profile?.role === "admin"} listQuery={listQuery} />
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
