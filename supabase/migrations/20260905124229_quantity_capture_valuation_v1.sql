-- Quantity capture + truthful EUR position valuation for curated V1 ETFs.
--
-- Member-reported quantity is never inferred from Marketstack close.
-- amount_minor stays the server-derived club-base (NOK) contribution.
-- Optional execution_unit_price is instrument-currency decimal, not øre.
-- unit_price_minor is insufficient for ETF prints such as IS3N 47.534 EUR.
-- No EUR/NOK FX: current value is instrument currency only.

-- ---------------------------------------------------------------------------
-- Quantity may exist without a NOK unit_price_minor pair.
-- ---------------------------------------------------------------------------

alter table public.member_investment_transactions
  drop constraint member_investment_transactions_lot_pair_check;

alter table public.member_investment_transactions
  add column execution_unit_price numeric(20, 8),
  add column execution_unit_price_currency text;

alter table public.member_investment_transactions
  add constraint member_investment_transactions_unit_price_requires_quantity_check
    check (unit_price_minor is null or quantity is not null),
  add constraint member_investment_transactions_execution_price_check
    check (execution_unit_price is null or execution_unit_price > 0),
  add constraint member_investment_transactions_execution_price_quantity_check
    check (execution_unit_price is null or quantity is not null),
  add constraint member_investment_transactions_execution_price_currency_check
    check (
      (execution_unit_price is null and execution_unit_price_currency is null)
      or (
        execution_unit_price is not null
        and execution_unit_price_currency ~ '^[A-Z]{3}$'
      )
    );

comment on column public.member_investment_transactions.quantity is
  'Member-reported instrument units. numeric(28, 8). Null on legacy amount-only rows. Never derived from amount or from a later market price.';

comment on column public.member_investment_transactions.unit_price_minor is
  'Legacy optional unit price in the same minor units as amount_minor (øre for NOK). Not used for EUR ETF execution prints; those use execution_unit_price.';

comment on column public.member_investment_transactions.execution_unit_price is
  'Optional member-reported execution price per unit in instrument currency. numeric(20, 8). Not club-base øre. Not inferred from Marketstack.';

comment on column public.member_investment_transactions.execution_unit_price_currency is
  'ISO currency of execution_unit_price. Server-set from the investment target. Null when no execution price is stored.';

-- ---------------------------------------------------------------------------
-- Position aggregation: distinguish complete / partial / unavailable quantity.
-- ---------------------------------------------------------------------------

create or replace view public.member_investment_positions
with (security_invoker = true)
as
select
  transaction.membership_id,
  transaction.club_id,
  transaction.investment_target_id,
  transaction.currency,
  pg_catalog.sum(transaction.amount_minor) as total_invested_minor,
  pg_catalog.sum(transaction.quantity) as total_quantity,
  pg_catalog.count(*)::integer as buy_count,
  pg_catalog.count(transaction.quantity)::integer as quantity_reported_count,
  case
    when pg_catalog.count(transaction.quantity) = 0 then 'unavailable'
    when pg_catalog.count(transaction.quantity) = pg_catalog.count(*) then 'complete'
    else 'partial'
  end as quantity_status
from public.member_investment_transactions as transaction
where transaction.transaction_type = 'buy'
group by
  transaction.membership_id,
  transaction.club_id,
  transaction.investment_target_id,
  transaction.currency;

comment on view public.member_investment_positions is
  'Derived own cost basis from member-reported buy transactions. total_quantity sums only rows with quantity. quantity_status is complete, partial, or unavailable. No current market value.';

revoke all on public.member_investment_positions from public, anon, authenticated;
grant select on public.member_investment_positions to authenticated;

-- ---------------------------------------------------------------------------
-- Read-only EUR (instrument-currency) valuation. No FX. No club aggregate.
-- ---------------------------------------------------------------------------

create view public.member_position_valuations_v1
with (security_invoker = true)
as
select
  position.membership_id,
  position.club_id,
  position.investment_target_id,
  target.name as target_name,
  target.kind as target_kind,
  target.ticker as target_ticker,
  target.currency as instrument_currency,
  position.currency as contribution_currency,
  position.total_invested_minor,
  position.total_quantity,
  position.buy_count,
  position.quantity_reported_count,
  position.quantity_status,
  mapping.provider_instrument_id as provider_symbol,
  latest.price as latest_price,
  latest.currency as latest_price_currency,
  latest.price_date as latest_price_date,
  latest.freshness as latest_price_freshness,
  case
    when position.quantity_status <> 'complete' then 'quantity_incomplete'
    when mapping.id is null then 'no_mapping'
    when latest.price is null or latest.price <= 0 then 'no_price'
    when latest.freshness is distinct from 'fresh' then 'price_not_fresh'
    when latest.currency is distinct from target.currency then 'currency_mismatch'
    else 'available'
  end as valuation_status,
  case
    when position.quantity_status = 'complete'
      and mapping.id is not null
      and latest.price is not null
      and latest.price > 0
      and latest.freshness = 'fresh'
      and latest.currency is not distinct from target.currency
    then position.total_quantity * latest.price
    else null
  end as current_value,
  case
    when position.quantity_status = 'complete'
      and mapping.id is not null
      and latest.price is not null
      and latest.price > 0
      and latest.freshness = 'fresh'
      and latest.currency is not distinct from target.currency
    then target.currency
    else null
  end as current_value_currency
from public.member_investment_positions as position
join public.investment_targets as target
  on target.id = position.investment_target_id
left join public.market_data_instrument_mappings as mapping
  on mapping.investment_target_id = position.investment_target_id
 and mapping.provider = 'marketstack'
 and mapping.active
left join public.latest_market_price_status as latest
  on latest.investment_target_id = position.investment_target_id
 and latest.provider = 'marketstack'
 and latest.price_type = 'close';

comment on view public.member_position_valuations_v1 is
  'Own position quantity times latest fresh Marketstack close, in instrument currency only. Does not convert EUR to NOK. Does not compute gain/loss across contribution vs market currencies. security_invoker so transaction RLS applies.';

revoke all on public.member_position_valuations_v1 from public, anon, authenticated;
grant select on public.member_position_valuations_v1 to authenticated;

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------

create function private.core_v1_etf_target_ids()
returns uuid[]
language sql
immutable
security invoker
set search_path = ''
as $function$
  select array[
    '31000000-0000-4000-8000-000000000011'::uuid,
    '31000000-0000-4000-8000-000000000012'::uuid,
    '31000000-0000-4000-8000-000000000013'::uuid,
    '31000000-0000-4000-8000-000000000014'::uuid,
    '31000000-0000-4000-8000-000000000015'::uuid
  ];
$function$;

create function private.strategy_is_curated_v1_etf(p_strategy_version_id uuid)
returns boolean
language sql
stable
security invoker
set search_path = ''
as $function$
  select exists (
    select 1
    from public.strategy_allocations as allocation
    where allocation.strategy_version_id = p_strategy_version_id
  )
  and not exists (
    select 1
    from public.strategy_allocations as allocation
    where allocation.strategy_version_id = p_strategy_version_id
      and allocation.investment_target_id <> all (private.core_v1_etf_target_ids())
  );
$function$;

create function private.parse_positive_decimal_v1(
  p_value jsonb,
  p_max_precision integer,
  p_max_scale integer,
  p_error_code text
)
returns numeric
language plpgsql
immutable
security invoker
set search_path = ''
as $function$
declare
  v_text text;
  v_integer_digits integer;
  v_scale integer;
  v_numeric numeric;
begin
  if p_value is null or p_value = 'null'::jsonb then
    raise exception using
      errcode = 'P0001',
      message = p_error_code;
  end if;

  if pg_catalog.jsonb_typeof(p_value) = 'string' then
    v_text := pg_catalog.btrim(p_value #>> '{}');
  elsif pg_catalog.jsonb_typeof(p_value) = 'number' then
    v_text := pg_catalog.btrim(p_value #>> '{}');
  else
    raise exception using
      errcode = 'P0001',
      message = p_error_code;
  end if;

  if v_text is null or v_text = '' or v_text !~ '^[0-9]+(\.[0-9]+)?$' then
    raise exception using
      errcode = 'P0001',
      message = p_error_code;
  end if;

  v_integer_digits := pg_catalog.length(pg_catalog.split_part(v_text, '.', 1));
  if v_text ~ '\.' then
    v_scale := pg_catalog.length(pg_catalog.split_part(v_text, '.', 2));
  else
    v_scale := 0;
  end if;

  if v_integer_digits < 1
    or v_integer_digits > p_max_precision
    or v_scale > p_max_scale
  then
    raise exception using
      errcode = 'P0001',
      message = p_error_code;
  end if;

  v_numeric := v_text::numeric;
  if v_numeric <= 0 then
    raise exception using
      errcode = 'P0001',
      message = p_error_code;
  end if;

  return v_numeric;
end;
$function$;

-- ---------------------------------------------------------------------------
-- Plan JSON: expose ticker plus stored quantity / execution price as text.
-- ---------------------------------------------------------------------------

create or replace function private.investment_day_plan_v1(
  p_club_id uuid,
  p_membership_id uuid,
  p_cycle_id uuid
)
returns table (
  club_id uuid,
  club_name text,
  membership_id uuid,
  cycle_id uuid,
  investment_day_at timestamptz,
  cycle_status public.investment_cycle_status,
  participation_id uuid,
  participation_outcome public.participation_outcome,
  expected_amount_minor bigint,
  currency text,
  allocations jsonb,
  transactions jsonb
)
language plpgsql
stable
security definer
set search_path = ''
as $function$
declare
  v_club public.clubs%rowtype;
  v_cycle public.investment_cycles%rowtype;
  v_participation public.member_cycle_participations%rowtype;
  v_lines jsonb;
  v_allocations jsonb;
  v_transactions jsonb;
begin
  select *
  into v_club
  from public.clubs as club
  where club.id = p_club_id;

  if not found or v_club.status <> 'active' then
    raise exception using
      errcode = 'P0001',
      message = 'vesty.not_club_member';
  end if;

  select *
  into v_cycle
  from public.investment_cycles as cycle
  where cycle.id = p_cycle_id
    and cycle.club_id = p_club_id;

  if not found then
    raise exception using
      errcode = 'P0001',
      message = 'vesty.cycle_invalid';
  end if;

  select *
  into v_participation
  from public.member_cycle_participations as participation
  where participation.investment_cycle_id = p_cycle_id
    and participation.membership_id = p_membership_id
    and participation.club_id = p_club_id;

  if not found then
    raise exception using
      errcode = 'P0001',
      message = 'vesty.cycle_invalid';
  end if;

  select pg_catalog.jsonb_agg(
    pg_catalog.jsonb_build_object(
      'investment_target_id', allocation.investment_target_id,
      'allocation_bps', allocation.allocation_bps,
      'position', allocation.position
    )
    order by allocation.position
  )
  into v_lines
  from public.strategy_allocations as allocation
  where allocation.strategy_version_id = v_cycle.strategy_version_id;

  if v_lines is null then
    raise exception using
      errcode = 'P0001',
      message = 'vesty.strategy_missing';
  end if;

  select pg_catalog.jsonb_agg(
    pg_catalog.jsonb_build_object(
      'investment_target_id', allocated.investment_target_id,
      'name', allocation.target_name,
      'kind', allocation.target_kind,
      'ticker', allocation.target_ticker,
      'instrument_currency', target.currency,
      'allocation_bps', allocated.allocation_bps,
      'position', allocated.display_position,
      'amount_minor', allocated.amount_minor
    )
    order by allocated.display_position
  )
  into v_allocations
  from private.allocate_minor_by_bps(
    v_participation.expected_amount_minor,
    v_lines
  ) as allocated
  join public.strategy_allocations as allocation
    on allocation.strategy_version_id = v_cycle.strategy_version_id
   and allocation.investment_target_id = allocated.investment_target_id
  join public.investment_targets as target
    on target.id = allocated.investment_target_id;

  select coalesce(
    pg_catalog.jsonb_agg(
      pg_catalog.jsonb_build_object(
        'id', transaction.id,
        'investment_target_id', transaction.investment_target_id,
        'amount_minor', transaction.amount_minor,
        'currency', transaction.currency,
        'transaction_type', transaction.transaction_type,
        'source', transaction.source,
        'verification_status', transaction.verification_status,
        'quantity', case
          when transaction.quantity is null then null
          else transaction.quantity::text
        end,
        'unit_price_minor', transaction.unit_price_minor,
        'execution_unit_price', case
          when transaction.execution_unit_price is null then null
          else transaction.execution_unit_price::text
        end,
        'execution_unit_price_currency', transaction.execution_unit_price_currency,
        'executed_at', transaction.executed_at,
        'reported_at', transaction.reported_at
      )
      order by transaction.created_at
    ),
    '[]'::jsonb
  )
  into v_transactions
  from public.member_investment_transactions as transaction
  where transaction.membership_id = p_membership_id
    and transaction.investment_cycle_id = p_cycle_id
    and transaction.club_id = p_club_id;

  club_id := v_club.id;
  club_name := v_club.name;
  membership_id := p_membership_id;
  cycle_id := v_cycle.id;
  investment_day_at := v_cycle.investment_day_at;
  cycle_status := v_cycle.status;
  participation_id := v_participation.id;
  participation_outcome := v_participation.outcome;
  expected_amount_minor := v_participation.expected_amount_minor;
  currency := v_participation.currency;
  allocations := v_allocations;
  transactions := v_transactions;
  return next;
end;
$function$;

-- ---------------------------------------------------------------------------
-- Trusted quantity-complete confirmation for curated V1 ETF clubs.
-- ---------------------------------------------------------------------------

create function private.confirm_investment_day_v2(
  p_club_id uuid,
  p_cycle_id uuid,
  p_execution_reports jsonb
)
returns table (
  club_id uuid,
  club_name text,
  membership_id uuid,
  cycle_id uuid,
  investment_day_at timestamptz,
  cycle_status public.investment_cycle_status,
  participation_id uuid,
  participation_outcome public.participation_outcome,
  expected_amount_minor bigint,
  currency text,
  allocations jsonb,
  transactions jsonb
)
language plpgsql
volatile
security definer
set search_path = ''
as $function$
declare
  v_user_id uuid;
  v_membership public.club_memberships%rowtype;
  v_club public.clubs%rowtype;
  v_cycle public.investment_cycles%rowtype;
  v_participation public.member_cycle_participations%rowtype;
  v_lines jsonb;
  v_reports jsonb := '[]'::jsonb;
  v_elem jsonb;
  v_target_id uuid;
  v_quantity numeric;
  v_execution_price numeric;
  v_now timestamptz := pg_catalog.now();
  v_mismatch_count integer;
begin
  v_user_id := private.require_authenticated_profile_id();

  select *
  into v_club
  from public.clubs as club
  where club.id = p_club_id;

  if not found or v_club.status <> 'active' then
    raise exception using
      errcode = 'P0001',
      message = 'vesty.not_club_member';
  end if;

  select *
  into v_membership
  from public.club_memberships as membership
  where membership.club_id = p_club_id
    and membership.profile_id = v_user_id
    and membership.status = 'active';

  if not found then
    raise exception using
      errcode = 'P0001',
      message = 'vesty.not_club_member';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(v_membership.id::text || p_cycle_id::text, 0)
  );

  select *
  into v_cycle
  from public.investment_cycles as cycle
  where cycle.id = p_cycle_id
    and cycle.club_id = p_club_id;

  if not found then
    raise exception using
      errcode = 'P0001',
      message = 'vesty.cycle_invalid';
  end if;

  select *
  into v_participation
  from public.member_cycle_participations as participation
  where participation.investment_cycle_id = p_cycle_id
    and participation.membership_id = v_membership.id
    and participation.club_id = p_club_id;

  if not found then
    raise exception using
      errcode = 'P0001',
      message = 'vesty.cycle_invalid';
  end if;

  if v_participation.expected_amount_minor <= 0
    or v_participation.currency is null
    or v_participation.currency !~ '^[A-Z]{3}$'
    or v_participation.currency <> v_club.base_currency
  then
    raise exception using
      errcode = 'P0001',
      message = 'vesty.amount_invalid';
  end if;

  if not private.strategy_is_curated_v1_etf(v_cycle.strategy_version_id) then
    raise exception using
      errcode = 'P0001',
      message = 'vesty.confirmation_mode_invalid';
  end if;

  if v_participation.outcome <> 'confirmed' and v_cycle.status <> 'open' then
    raise exception using
      errcode = 'P0001',
      message = 'vesty.cycle_not_open';
  end if;

  if p_execution_reports is null
    or pg_catalog.jsonb_typeof(p_execution_reports) <> 'array'
    or pg_catalog.jsonb_array_length(p_execution_reports) = 0
  then
    raise exception using
      errcode = 'P0001',
      message = 'vesty.execution_reports_invalid';
  end if;

  if (
    select pg_catalog.count(*)
    from pg_catalog.jsonb_array_elements(p_execution_reports) as report(value)
  ) <> (
    select pg_catalog.count(distinct report.value->>'investment_target_id')
    from pg_catalog.jsonb_array_elements(p_execution_reports) as report(value)
  ) then
    raise exception using
      errcode = 'P0001',
      message = 'vesty.duplicate_execution_report';
  end if;

  for v_elem in
    select report.value
    from pg_catalog.jsonb_array_elements(p_execution_reports) as report(value)
  loop
    if pg_catalog.jsonb_typeof(v_elem) <> 'object' then
      raise exception using
        errcode = 'P0001',
        message = 'vesty.execution_reports_invalid';
    end if;

    begin
      v_target_id := (v_elem->>'investment_target_id')::uuid;
    exception
      when invalid_text_representation then
        raise exception using
          errcode = 'P0001',
          message = 'vesty.invalid_target';
    end;

    if v_target_id is null then
      raise exception using
        errcode = 'P0001',
        message = 'vesty.invalid_target';
    end if;

    v_quantity := private.parse_positive_decimal_v1(
      v_elem->'quantity',
      20,
      8,
      'vesty.quantity_invalid'
    );

    v_execution_price := null;
    if v_elem ? 'execution_unit_price'
      and v_elem->'execution_unit_price' is not null
      and v_elem->'execution_unit_price' <> 'null'::jsonb
      and not (
        pg_catalog.jsonb_typeof(v_elem->'execution_unit_price') = 'string'
        and pg_catalog.btrim(v_elem->>'execution_unit_price') = ''
      )
    then
      v_execution_price := private.parse_positive_decimal_v1(
        v_elem->'execution_unit_price',
        12,
        8,
        'vesty.execution_price_invalid'
      );
    end if;

    v_reports := v_reports || pg_catalog.jsonb_build_array(
      pg_catalog.jsonb_build_object(
        'investment_target_id', v_target_id,
        'quantity', v_quantity,
        'execution_unit_price', v_execution_price
      )
    );
  end loop;

  select pg_catalog.jsonb_agg(
    pg_catalog.jsonb_build_object(
      'investment_target_id', allocation.investment_target_id,
      'allocation_bps', allocation.allocation_bps,
      'position', allocation.position
    )
    order by allocation.position
  )
  into v_lines
  from public.strategy_allocations as allocation
  where allocation.strategy_version_id = v_cycle.strategy_version_id;

  if v_lines is null then
    raise exception using
      errcode = 'P0001',
      message = 'vesty.strategy_missing';
  end if;

  if exists (
    select 1
    from pg_catalog.jsonb_to_recordset(v_reports) as report(
      investment_target_id uuid,
      quantity numeric,
      execution_unit_price numeric
    )
    where not exists (
      select 1
      from private.allocate_minor_by_bps(
        v_participation.expected_amount_minor,
        v_lines
      ) as allocated
      where allocated.investment_target_id = report.investment_target_id
        and allocated.amount_minor > 0
    )
  ) then
    raise exception using
      errcode = 'P0001',
      message = 'vesty.invalid_target';
  end if;

  if exists (
    select 1
    from private.allocate_minor_by_bps(
      v_participation.expected_amount_minor,
      v_lines
    ) as allocated
    where allocated.amount_minor > 0
      and not exists (
        select 1
        from pg_catalog.jsonb_to_recordset(v_reports) as report(
          investment_target_id uuid,
          quantity numeric,
          execution_unit_price numeric
        )
        where report.investment_target_id = allocated.investment_target_id
      )
  ) then
    raise exception using
      errcode = 'P0001',
      message = 'vesty.execution_targets_incomplete';
  end if;

  insert into public.member_investment_transactions (
    club_id,
    membership_id,
    investment_cycle_id,
    investment_target_id,
    transaction_type,
    amount_minor,
    currency,
    quantity,
    unit_price_minor,
    execution_unit_price,
    execution_unit_price_currency,
    executed_at,
    reported_at,
    source,
    verification_status
  )
  select
    p_club_id,
    v_membership.id,
    p_cycle_id,
    allocated.investment_target_id,
    'buy',
    allocated.amount_minor,
    v_club.base_currency,
    report.quantity,
    null,
    report.execution_unit_price,
    case
      when report.execution_unit_price is null then null
      else target.currency
    end,
    v_now,
    v_now,
    'manual',
    'member_reported'
  from private.allocate_minor_by_bps(
    v_participation.expected_amount_minor,
    v_lines
  ) as allocated
  join pg_catalog.jsonb_to_recordset(v_reports) as report(
    investment_target_id uuid,
    quantity numeric,
    execution_unit_price numeric
  )
    on report.investment_target_id = allocated.investment_target_id
  join public.investment_targets as target
    on target.id = allocated.investment_target_id
  where allocated.amount_minor > 0
  on conflict on constraint member_investment_transactions_cycle_target_type_key
  do nothing;

  update public.member_investment_transactions as transaction
  set
    quantity = coalesce(transaction.quantity, report.quantity),
    execution_unit_price = coalesce(transaction.execution_unit_price, report.execution_unit_price),
    execution_unit_price_currency = coalesce(
      transaction.execution_unit_price_currency,
      case
        when report.execution_unit_price is null then null
        else target.currency
      end
    ),
    executed_at = case
      when transaction.quantity is null then v_now
      else transaction.executed_at
    end,
    reported_at = case
      when transaction.quantity is null then v_now
      else transaction.reported_at
    end
  from pg_catalog.jsonb_to_recordset(v_reports) as report(
    investment_target_id uuid,
    quantity numeric,
    execution_unit_price numeric
  )
  join public.investment_targets as target
    on target.id = report.investment_target_id
  where transaction.membership_id = v_membership.id
    and transaction.investment_cycle_id = p_cycle_id
    and transaction.club_id = p_club_id
    and transaction.investment_target_id = report.investment_target_id
    and transaction.transaction_type = 'buy';

  select pg_catalog.count(*)
  into v_mismatch_count
  from pg_catalog.jsonb_to_recordset(v_reports) as report(
    investment_target_id uuid,
    quantity numeric,
    execution_unit_price numeric
  )
  join public.member_investment_transactions as transaction
    on transaction.membership_id = v_membership.id
   and transaction.investment_cycle_id = p_cycle_id
   and transaction.club_id = p_club_id
   and transaction.investment_target_id = report.investment_target_id
   and transaction.transaction_type = 'buy'
  where transaction.quantity is distinct from report.quantity
     or (
       report.execution_unit_price is not null
       and transaction.execution_unit_price is distinct from report.execution_unit_price
     );

  if coalesce(v_mismatch_count, 0) > 0 then
    raise exception using
      errcode = 'P0001',
      message = 'vesty.execution_already_reported';
  end if;

  update public.member_cycle_participations as participation
  set
    outcome = 'confirmed',
    report_source = 'member_reported',
    reported_at = coalesce(participation.reported_at, v_now)
  where participation.id = v_participation.id
    and participation.outcome = 'expected';

  return query
  select *
  from private.investment_day_plan_v1(p_club_id, v_membership.id, p_cycle_id);
end;
$function$;

create function public.confirm_investment_day_v2(
  p_club_id uuid,
  p_cycle_id uuid,
  p_execution_reports jsonb
)
returns table (
  club_id uuid,
  club_name text,
  membership_id uuid,
  cycle_id uuid,
  investment_day_at timestamptz,
  cycle_status public.investment_cycle_status,
  participation_id uuid,
  participation_outcome public.participation_outcome,
  expected_amount_minor bigint,
  currency text,
  allocations jsonb,
  transactions jsonb
)
language sql
volatile
security invoker
set search_path = ''
as $function$
  select *
  from private.confirm_investment_day_v2(p_club_id, p_cycle_id, p_execution_reports);
$function$;

revoke all on function private.core_v1_etf_target_ids() from public, anon, authenticated;
revoke all on function private.strategy_is_curated_v1_etf(uuid) from public, anon, authenticated;
revoke all on function private.parse_positive_decimal_v1(jsonb, integer, integer, text) from public, anon, authenticated;
revoke all on function private.confirm_investment_day_v2(uuid, uuid, jsonb) from public, anon;
revoke all on function public.confirm_investment_day_v2(uuid, uuid, jsonb) from public, anon;

grant execute on function private.confirm_investment_day_v2(uuid, uuid, jsonb) to authenticated;
grant execute on function public.confirm_investment_day_v2(uuid, uuid, jsonb) to authenticated;
