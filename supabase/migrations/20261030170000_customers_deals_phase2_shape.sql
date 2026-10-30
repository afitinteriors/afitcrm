-- Blueprint V1 Phase 2 (partial, scoped): the customers/deals data-model
-- split from Section 11, additive only -- per explicit owner instruction,
-- this does NOT touch the WABIS webhook, lib/whatsapp/ingest.ts, or the
-- `leads` table's write path in any way (CLAUDE.md "Live Data Safety").
-- `leads` stays exactly as the one and only table WABIS writes to; real ad
-- leads are flowing through it live right now. This migration only adds
-- two new, currently-unwritten-by-the-app tables alongside it, backfilled
-- once from today's `leads` data so the new shape can be reviewed and
-- built against in a later phase, before any live write path is ever
-- pointed at it.
--
-- customers: one row per normalised phone number (Section 11: "Unique
-- phone"). leads.phone is already stored normalised (+91XXXXXXXXXX, every
-- sampled row), so no reformatting is done here -- it is copied as-is.
--
-- deals: one row per service enquiry (Section 11: "One enquiry per
-- customer per service"), carrying every column leads already has for
-- that purpose (status, assignment, ad attribution, qualification,
-- site-visit/quotation/job value, lost reason). Each deal keeps
-- source_lead_id pointing back to the leads row it was backfilled from,
-- so this is traceable and safely re-derivable, never a disconnected copy.
--
-- Deliberately out of scope for this migration (left for a later phase,
-- once this shape is reviewed):
--   * no live sync/trigger from leads -> customers/deals -- this is a
--     one-time backfill of today's data, not a standing pipeline. Adding a
--     trigger onto the live `leads` table is exactly the kind of change
--     that needs its own explicit go-ahead, separate from "design the
--     shape": a buggy trigger could slow down or block real lead intake.
--   * merged-away leads (merged_into_id is not null) are duplicates that
--     were already consolidated into another lead -- they are excluded
--     from this backfill (one deal per *active* lead, not per historical
--     duplicate), matching how the rest of the app already treats them
--     (leads_active_phone_unique_idx is scoped the same way).
--   * no RLS INSERT/UPDATE/DELETE policies -- nothing in the app writes to
--     these tables yet (this backfill runs once, as the migration), so
--     only SELECT is granted (admin-or-assigned, mirroring leads) for a
--     later phase to build read paths against; write policies are added
--     when that phase adds the write paths they actually need.
--   * no lib/supabase/types.ts entry -- same reasoning: nothing in the app
--     reads these tables yet, so there is no typed consumer to keep in
--     sync with.

create table public.customers (
  id uuid primary key default uuid_generate_v4(),
  phone text not null unique,
  customer_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.deals (
  id uuid primary key default uuid_generate_v4(),
  customer_id uuid not null references public.customers(id) on delete restrict,
  source_lead_id uuid unique references public.leads(id) on delete set null,
  service_required text,
  status text not null default 'new'
    check (status = any (array['new','contacted','qualified','site_visit','quotation','negotiation','won','lost','invalid'])),
  assigned_to_id uuid references public.profiles(id) on delete restrict,
  source text,
  campaign_name text,
  campaign_id text,
  adset_name text,
  adset_id text,
  ad_name text,
  ad_id text,
  location text,
  project_type text,
  estimated_sqft numeric,
  expected_start_date date,
  qualification_score integer,
  qualification_notes text,
  site_visit_date timestamptz,
  quotation_amount numeric,
  job_value numeric,
  lost_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index deals_customer_id_idx on public.deals (customer_id);
create index deals_status_idx on public.deals (status);
create index deals_campaign_id_idx on public.deals (campaign_id);
create index deals_created_at_idx on public.deals (created_at);

create or replace trigger customers_set_updated_at
  before update on public.customers
  for each row
  execute function private.set_updated_at();

create or replace trigger deals_set_updated_at
  before update on public.deals
  for each row
  execute function private.set_updated_at();

alter table public.customers enable row level security;
alter table public.deals enable row level security;

-- Mirrors leads' own "admin or assigned owner" SELECT shape. A deal's
-- "owner" is its own assigned_to_id (not a column on customers), so
-- customers_select is admin-or-linked-to-a-deal-you-can-see, expressed via
-- EXISTS against deals rather than duplicating assignment onto customers
-- itself (a customer can have deals assigned to different staff).
create policy "customers_select_admin_or_linked_deal_owner"
  on public.customers
  for select
  to authenticated
  using (
    (select private.is_admin())
    or exists (
      select 1 from public.deals d
      where d.customer_id = customers.id
        and d.assigned_to_id = (select auth.uid())
    )
  );

create policy "deals_select_admin_or_owner"
  on public.deals
  for select
  to authenticated
  using ((select private.is_admin()) or assigned_to_id = (select auth.uid()));

-- One-time backfill from today's leads. Idempotent: re-running this exact
-- migration never happens (forward-only migrations), but the ON CONFLICT /
-- NOT EXISTS guards below mean it is still safe if ever replayed by hand
-- (e.g. against a freshly restored copy) -- it will not duplicate rows.
insert into public.customers (phone, customer_name, created_at, updated_at)
select distinct on (phone)
  phone,
  customer_name,
  created_at,
  updated_at
from public.leads
where merged_into_id is null
order by phone, created_at desc
on conflict (phone) do nothing;

insert into public.deals (
  customer_id, source_lead_id, service_required, status, assigned_to_id,
  source, campaign_name, campaign_id, adset_name, adset_id, ad_name, ad_id,
  location, project_type, estimated_sqft, expected_start_date,
  qualification_score, qualification_notes, site_visit_date,
  quotation_amount, job_value, lost_reason, created_at, updated_at
)
select
  c.id, l.id, l.service_required, l.status, l.assigned_to_id,
  l.source, l.campaign_name, l.campaign_id, l.adset_name, l.adset_id, l.ad_name, l.ad_id,
  l.location, l.project_type, l.estimated_sqft, l.expected_start_date,
  l.qualification_score, l.qualification_notes, l.site_visit_date,
  l.quotation_amount, l.job_value, l.lost_reason, l.created_at, l.updated_at
from public.leads l
join public.customers c on c.phone = l.phone
where l.merged_into_id is null
on conflict (source_lead_id) do nothing;
