-- leads.updated_at was never advanced after insert: the column has
-- `default now()` (insert only), there was no trigger anywhere in `public`,
-- and no application code sets it on leads. This adds the one missing piece.
--
-- Scope, deliberately narrow:
--   * one trigger function in the `private` schema (not exposed through the API)
--   * one BEFORE UPDATE trigger on public.leads
--   * NO change to existing rows, created_at, RLS policies, or any other column
--
-- The function only stamps updated_at when the row actually changed, so a
-- no-op UPDATE (same values written back) does not move it.

create or replace function private.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new is distinct from old then
    new.updated_at := now();
  end if;
  return new;
end;
$$;

revoke all on function private.set_updated_at() from public;

create or replace trigger leads_set_updated_at
  before update on public.leads
  for each row
  execute function private.set_updated_at();
