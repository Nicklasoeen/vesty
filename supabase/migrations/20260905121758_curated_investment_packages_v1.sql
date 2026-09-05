-- Curated V1 investment packages.
-- New clubs choose a package id. StrategyVersion 1 is resolved server-side.
-- Legacy KLP/DNB targets stay active for existing clubs.

-- ---------------------------------------------------------------------------
-- CORE V1 ETF catalog (deterministic IDs)
-- provider_symbol stays null. Marketstack mappings are not seeded.
-- ---------------------------------------------------------------------------

insert into public.investment_targets (
  id,
  name,
  kind,
  status,
  currency,
  ticker,
  exchange,
  isin
)
values
  (
    '31000000-0000-4000-8000-000000000011',
    'Vanguard FTSE All-World UCITS ETF - (USD) Acc',
    'etf',
    'active',
    'EUR',
    'VWCE',
    'Xetra',
    'IE00BK5BQT80'
  ),
  (
    '31000000-0000-4000-8000-000000000012',
    'iShares Core MSCI Europe UCITS ETF EUR (Acc)',
    'etf',
    'active',
    'EUR',
    'EUNK',
    'Xetra',
    'IE00B4K48X80'
  ),
  (
    '31000000-0000-4000-8000-000000000013',
    'iShares Core MSCI EM IMI UCITS ETF USD (Acc)',
    'etf',
    'active',
    'EUR',
    'IS3N',
    'Xetra',
    'IE00BKM4GZ66'
  ),
  (
    '31000000-0000-4000-8000-000000000014',
    'iShares Core S&P 500 UCITS ETF USD (Acc)',
    'etf',
    'active',
    'EUR',
    'SXR8',
    'Xetra',
    'IE00B5BMR087'
  ),
  (
    '31000000-0000-4000-8000-000000000015',
    'iShares NASDAQ 100 UCITS ETF USD (Acc)',
    'etf',
    'active',
    'EUR',
    'SXRV',
    'Xetra',
    'IE00B53SZB19'
  );

-- ---------------------------------------------------------------------------
-- Canonical packages (private: not on the Data API)
-- ---------------------------------------------------------------------------

create table private.curated_strategy_packages (
  id text primary key,
  display_name text not null,
  status text not null,
  position smallint not null,
  constraint curated_strategy_packages_id_check
    check (id ~ '^[a-z][a-z0-9_]*$'),
  constraint curated_strategy_packages_display_name_check
    check (btrim(display_name) <> ''),
  constraint curated_strategy_packages_status_check
    check (status in ('active', 'inactive')),
  constraint curated_strategy_packages_position_check
    check (position >= 1),
  constraint curated_strategy_packages_position_key
    unique (position)
);

create table private.curated_strategy_package_allocations (
  package_id text not null
    references private.curated_strategy_packages (id) on delete restrict,
  investment_target_id uuid not null
    references public.investment_targets (id) on delete restrict,
  allocation_bps smallint not null,
  position smallint not null,
  constraint curated_strategy_package_allocations_pkey
    primary key (package_id, investment_target_id),
  constraint curated_strategy_package_allocations_position_key
    unique (package_id, position),
  constraint curated_strategy_package_allocations_bps_check
    check (allocation_bps >= 1 and allocation_bps <= 10000),
  constraint curated_strategy_package_allocations_position_check
    check (position >= 1)
);

comment on table private.curated_strategy_packages is
  'Vesty-owned V1 package catalog. Public create_club resolves an allowlisted id to allocations.';

comment on table private.curated_strategy_package_allocations is
  'Canonical 10000-bps snapshots for curated packages. Clients cannot supply these rows.';

alter table private.curated_strategy_packages enable row level security;
alter table private.curated_strategy_packages force row level security;
alter table private.curated_strategy_package_allocations enable row level security;
alter table private.curated_strategy_package_allocations force row level security;

revoke all on table private.curated_strategy_packages from public, anon, authenticated;
revoke all on table private.curated_strategy_package_allocations from public, anon, authenticated;

insert into private.curated_strategy_packages (id, display_name, status, position)
values
  ('world_mix', 'World Mix', 'active', 1),
  ('world_america', 'World + America', 'active', 2),
  ('tech_forward', 'Tech Forward', 'active', 3);

insert into private.curated_strategy_package_allocations (
  package_id,
  investment_target_id,
  allocation_bps,
  position
)
values
  ('world_mix', '31000000-0000-4000-8000-000000000011', 6000, 1),
  ('world_mix', '31000000-0000-4000-8000-000000000012', 2500, 2),
  ('world_mix', '31000000-0000-4000-8000-000000000013', 1500, 3),
  ('world_america', '31000000-0000-4000-8000-000000000011', 5000, 1),
  ('world_america', '31000000-0000-4000-8000-000000000014', 3000, 2),
  ('world_america', '31000000-0000-4000-8000-000000000012', 1000, 3),
  ('world_america', '31000000-0000-4000-8000-000000000013', 1000, 4),
  ('tech_forward', '31000000-0000-4000-8000-000000000011', 4000, 1),
  ('tech_forward', '31000000-0000-4000-8000-000000000015', 3500, 2),
  ('tech_forward', '31000000-0000-4000-8000-000000000014', 1500, 3),
  ('tech_forward', '31000000-0000-4000-8000-000000000013', 1000, 4);

-- ---------------------------------------------------------------------------
-- Server-side package resolution
-- ---------------------------------------------------------------------------

create function private.resolve_curated_package_allocations(p_package_id text)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $function$
declare
  v_id text;
  v_status text;
  v_sum integer;
  v_allocations jsonb;
begin
  v_id := pg_catalog.btrim(coalesce(p_package_id, ''));

  select package.status
  into v_status
  from private.curated_strategy_packages as package
  where package.id = v_id;

  if not found or v_status <> 'active' then
    raise exception using
      errcode = 'P0001',
      message = 'vesty.invalid_package';
  end if;

  select
    coalesce(pg_catalog.jsonb_agg(
      pg_catalog.jsonb_build_object(
        'investment_target_id', allocation.investment_target_id,
        'allocation_bps', allocation.allocation_bps,
        'position', allocation.position
      )
      order by allocation.position
    ), '[]'::jsonb),
    coalesce(sum(allocation.allocation_bps), 0)
  into v_allocations, v_sum
  from private.curated_strategy_package_allocations as allocation
  where allocation.package_id = v_id;

  if v_sum <> 10000 then
    raise exception using
      errcode = 'P0001',
      message = 'vesty.invalid_allocation_sum';
  end if;

  return v_allocations;
end;
$function$;

comment on function private.resolve_curated_package_allocations(text) is
  'Returns the canonical allocation snapshot for an active curated package id.';

-- ---------------------------------------------------------------------------
-- Public create_club now accepts a package id, not client allocations
-- ---------------------------------------------------------------------------

revoke all on function public.create_club(text, public.governance_threshold_kind, jsonb, text) from public, anon, authenticated;
drop function public.create_club(text, public.governance_threshold_kind, jsonb, text);

create function public.create_club(
  p_name text,
  p_governance_threshold_kind public.governance_threshold_kind,
  p_package_id text,
  p_base_currency text default 'NOK'
)
returns table (
  club_id uuid,
  membership_id uuid,
  strategy_version_id uuid
)
language sql
volatile
security invoker
set search_path = ''
as $function$
  select *
  from private.create_club(
    p_name,
    p_governance_threshold_kind,
    private.resolve_curated_package_allocations(p_package_id),
    p_base_currency
  );
$function$;

comment on function public.create_club(text, public.governance_threshold_kind, text, text) is
  'Creates a club and genesis StrategyVersion 1 from an allowlisted curated package. Callers cannot supply allocations.';

revoke all on function private.resolve_curated_package_allocations(text) from public, anon, authenticated;
grant execute on function private.resolve_curated_package_allocations(text) to authenticated;

revoke all on function public.create_club(text, public.governance_threshold_kind, text, text) from public, anon;
grant execute on function public.create_club(text, public.governance_threshold_kind, text, text) to authenticated;
