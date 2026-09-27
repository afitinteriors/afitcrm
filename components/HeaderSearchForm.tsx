// Plain GET form -- no client JS needed. Submits straight to the existing
// /leads search filter (lib/leads.ts's `search` filter, already ilike-matches
// customer_name/phone), so this is real search, not a decorative input.
export function HeaderSearchForm() {
  return (
    <form action="/leads" method="GET" className="w-full max-w-md">
      <label className="relative block">
        <span className="sr-only">Search leads, name, phone</span>
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={1.75}
          className="pointer-events-none absolute left-3 top-1/2 h-4.5 w-4.5 -translate-y-1/2 text-muted-foreground"
          aria-hidden="true"
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M18.5 11a7.5 7.5 0 11-15 0 7.5 7.5 0 0115 0z" />
        </svg>
        <input
          type="search"
          name="search"
          placeholder="Search leads, name, phone..."
          className="w-full rounded-full border border-border bg-muted/40 py-2 pl-9 pr-4 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
      </label>
    </form>
  );
}
