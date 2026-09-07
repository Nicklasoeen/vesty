-- F01/F02: atomic Investment Day reporting.
--
-- Plan, member report, and purchase lines are distinct facts. Clients report
-- through one RPC. Direct participation updates and confirm v1/v2 are revoked
-- from authenticated. Existing v1/v2 amounts stay in place and are labelled
-- legacy_plan_assumed. Versioned correction is remaining work.

-- ---------------------------------------------------------------------------
-- Provenance and report mode
-- ---------------------------------------------------------------------------

create type public.investment_day_report_mode as enum (
  'as_planned',
  'with_changes'
);

comment on type public.investment_day_report_mode is
  'as_planned stores the frozen plan after explicit attestation. with_changes stores only the purchase lines the member submitted.';

create type public.investment_amount_provenance as enum (
  'member_attested_plan',
  'member_reported_actual',
  'legacy_plan_assumed',
  'broker_verified'
);

comment on type public.investment_amount_provenance is
  'How amount_minor was obtained. broker_verified is reserved. legacy_plan_assumed marks pre-reporting v1/v2 rows and must not be upgraded.';

-- ---------------------------------------------------------------------------
-- Member report identity (one completed report per membership+cycle)
-- ---------------------------------------------------------------------------

create table public.member_investment_day_reports (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null,
  membership_id uuid not null,
  investment_cycle_id uuid not null,
  client_report_id uuid not null,
  report_mode public.investment_day_report_mode not null,
  outcome public.participation_outcome not null,
  payload_fingerprint text not null,
  created_at timestamptz not null default now(),

  constraint member_investment_day_reports_membership_same_club_fkey
    foreign key (club_id, membership_id)
    references public.club_memberships (club_id, id)
    on delete restrict,
  constraint member_investment_day_reports_cycle_same_club_fkey
    foreign key (club_id, investment_cycle_id)
    references public.investment_cycles (club_id, id)
    on delete restrict,
  constraint member_investment_day_reports_cycle_membership_key
    unique (membership_id, investment_cycle_id),
  constraint member_investment_day_reports_client_id_key
    unique (membership_id, client_report_id),
  constraint member_investment_day_reports_outcome_check
    check (outcome in ('confirmed', 'skipped', 'failed')),
  constraint member_investment_day_reports_as_planned_check
    check (
      report_mode <> 'as_planned'
      or outcome = 'confirmed'
    ),
  constraint member_investment_day_reports_fingerprint_check
    check (payload_fingerprint ~ '^[0-9a-f]{64}$')
);

comment on table public.member_investment_day_reports is
  'One member report per cycle. Retry with the same client_report_id and fingerprint is idempotent. A different payload is rejected. Versioned correction is not implemented.';

comment on column public.member_investment_day_reports.client_report_id is
  'Client-generated idempotency key. The same id may be retried; a new id after completion is a conflict.';

create index member_investment_day_reports_cycle_idx
  on public.member_investment_day_reports (investment_cycle_id, membership_id);

alter table public.member_investment_day_reports enable row level security;
alter table public.member_investment_day_reports force row level security;

revoke all on public.member_investment_day_reports from public, anon, authenticated;
grant select on public.member_investment_day_reports to authenticated;

create policy member_investment_day_reports_select_self
on public.member_investment_day_reports
for select
to authenticated
using ((select private.owns_active_membership(membership_id)));

-- ---------------------------------------------------------------------------
-- Transaction provenance. Existing rows are plan-assumed, not upgraded.
-- ---------------------------------------------------------------------------

alter table public.member_investment_transactions
  add column report_id uuid references public.member_investment_day_reports (id) on delete restrict,
  add column amount_provenance public.investment_amount_provenance;

update public.member_investment_transactions
set amount_provenance = 'legacy_plan_assumed'
where amount_provenance is null;

alter table public.member_investment_transactions
  alter column amount_provenance set not null;

alter table public.member_investment_transactions
  add constraint member_investment_transactions_provenance_check
    check (
      (
        amount_provenance in (
          'member_attested_plan',
          'member_reported_actual',
          'legacy_plan_assumed'
        )
        and verification_status = 'member_reported'
      )
      or (
        amount_provenance = 'broker_verified'
        and verification_status = 'broker_verified'
      )
    );

comment on column public.member_investment_transactions.amount_provenance is
  'Trust of amount_minor. legacy_plan_assumed is historical v1/v2 plan fill. Quantity does not upgrade that amount.';

comment on column public.member_investment_transactions.report_id is
  'Owning member report. Null on historical v1/v2 rows that predate reporting.';

create index member_investment_transactions_report_idx
  on public.member_investment_transactions (report_id);

-- ---------------------------------------------------------------------------
-- Close the extra write path on participation.
-- ---------------------------------------------------------------------------

drop policy if exists member_cycle_participations_update_own_open_report
  on public.member_cycle_participations;

revoke update on public.member_cycle_participations from authenticated;

revoke execute on function private.can_update_participation(uuid) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------

create function private.parse_report_amount_minor_v1(p_value jsonb)
returns bigint
language plpgsql
immutable
security invoker
set search_path = ''
as $function$
declare
  v_text text;
  v_amount bigint;
begin
  if p_value is null or p_value = 'null'::jsonb then
    raise exception using
      errcode = 'P0001',
      message = 'vesty.purchase_lines_invalid';
  end if;

  if pg_catalog.jsonb_typeof(p_value) not in ('number', 'string') then
    raise exception using
      errcode = 'P0001',
      message = 'vesty.purchase_lines_invalid';
  end if;

  v_text := pg_catalog.btrim(p_value #>> '{}');
  if v_text is null or v_text !~ '^(0|[1-9][0-9]{0,11})$' then
    raise exception using
      errcode = 'P0001',
      message = 'vesty.purchase_lines_invalid';
  end if;

  v_amount := v_text::bigint;
  if v_amount < 0 or v_amount > 10000000000 then
    raise exception using
      errcode = 'P0001',
      message = 'vesty.purchase_lines_invalid';
  end if;

  return v_amount;
end;
$function$;

create function private.investment_day_report_fingerprint_v1(
  p_report_mode public.investment_day_report_mode,
  p_outcome public.participation_outcome,
  p_lines jsonb
)
returns text
language sql
immutable
security invoker
set search_path = ''
as $function$
  select pg_catalog.encode(
    pg_catalog.sha256(
      pg_catalog.convert_to(
        p_report_mode::text
          || chr(10)
          || p_outcome::text
          || chr(10)
          || coalesce(p_lines::text, '[]'),
        'UTF8'
      )
    ),
    'hex'
  );
$function$;

create function private.optional_execution_fields_v1(
  p_elem jsonb,
  p_instrument_currency text,
  out p_quantity numeric,
  out p_execution_unit_price numeric,
  out p_execution_unit_price_currency text
)
language plpgsql
immutable
security invoker
set search_path = ''
as $function$
begin
  p_quantity := null;
  p_execution_unit_price := null;
  p_execution_unit_price_currency := null;

  if p_elem ? 'quantity'
    and p_elem->'quantity' is not null
    and p_elem->'quantity' <> 'null'::jsonb
    and not (
      pg_catalog.jsonb_typeof(p_elem->'quantity') = 'string'
      and pg_catalog.btrim(p_elem->>'quantity') = ''
    )
  then
    p_quantity := private.parse_positive_decimal_v1(
      p_elem->'quantity',
      20,
      8,
      'vesty.quantity_invalid'
    );
  end if;

  if p_elem ? 'execution_unit_price'
    and p_elem->'execution_unit_price' is not null
    and p_elem->'execution_unit_price' <> 'null'::jsonb
    and not (
      pg_catalog.jsonb_typeof(p_elem->'execution_unit_price') = 'string'
      and pg_catalog.btrim(p_elem->>'execution_unit_price') = ''
    )
  then
    p_execution_unit_price := private.parse_positive_decimal_v1(
      p_elem->'execution_unit_price',
      12,
      8,
      'vesty.execution_price_invalid'
    );
  end if;

  if p_execution_unit_price is not null and p_quantity is null then
    raise exception using
      errcode = 'P0001',
      message = 'vesty.execution_price_invalid';
  end if;

  if p_execution_unit_price is not null then
    if p_elem ? 'execution_unit_price_currency'
      and p_elem->'execution_unit_price_currency' is not null
      and p_elem->'execution_unit_price_currency' <> 'null'::jsonb
      and pg_catalog.btrim(p_elem->>'execution_unit_price_currency') <> ''
      and pg_catalog.btrim(p_elem->>'execution_unit_price_currency')
        is distinct from p_instrument_currency
    then
      raise exception using
        errcode = 'P0001',
        message = 'vesty.execution_price_invalid';
    end if;
    p_execution_unit_price_currency := p_instrument_currency;
  end if;
end;
$function$;

create function private.normalize_report_purchase_lines_v1(
  p_report_mode public.investment_day_report_mode,
  p_purchase_lines jsonb,
  p_planned jsonb
)
returns jsonb
language plpgsql
stable
security invoker
set search_path = ''
as $function$
declare
  v_elem jsonb;
  v_target_id uuid;
  v_amount bigint;
  v_planned jsonb;
  v_quantity numeric;
  v_price numeric;
  v_price_currency text;
  v_instrument_currency text;
  v_seen uuid[] := '{}';
  v_normalized jsonb := '[]'::jsonb;
  v_line jsonb;
begin
  if p_purchase_lines is null
    or pg_catalog.jsonb_typeof(p_purchase_lines) <> 'array'
  then
    raise exception using
      errcode = 'P0001',
      message = 'vesty.purchase_lines_invalid';
  end if;

  for v_elem in
    select report.value
    from pg_catalog.jsonb_array_elements(p_purchase_lines) as report(value)
  loop
    if pg_catalog.jsonb_typeof(v_elem) <> 'object' then
      raise exception using
        errcode = 'P0001',
        message = 'vesty.purchase_lines_invalid';
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

    if v_target_id = any (v_seen) then
      raise exception using
        errcode = 'P0001',
        message = 'vesty.duplicate_execution_report';
    end if;
    v_seen := pg_catalog.array_append(v_seen, v_target_id);

    select line.value
    into v_planned
    from pg_catalog.jsonb_array_elements(p_planned) as line(value)
    where (line.value->>'investment_target_id')::uuid = v_target_id
      and (line.value->>'amount_minor')::bigint > 0;

    if not found then
      raise exception using
        errcode = 'P0001',
        message = 'vesty.invalid_target';
    end if;

    v_instrument_currency := v_planned->>'instrument_currency';
    select
      fields.p_quantity,
      fields.p_execution_unit_price,
      fields.p_execution_unit_price_currency
    into v_quantity, v_price, v_price_currency
    from private.optional_execution_fields_v1(
      v_elem,
      v_instrument_currency
    ) as fields;

    if p_report_mode = 'as_planned' then
      if v_elem ? 'amount_minor'
        and v_elem->'amount_minor' is not null
        and v_elem->'amount_minor' <> 'null'::jsonb
        and not (
          pg_catalog.jsonb_typeof(v_elem->'amount_minor') = 'string'
          and pg_catalog.btrim(v_elem->>'amount_minor') = ''
        )
      then
        raise exception using
          errcode = 'P0001',
          message = 'vesty.purchase_lines_invalid';
      end if;

      v_normalized := v_normalized || pg_catalog.jsonb_build_array(
        pg_catalog.jsonb_strip_nulls(
          pg_catalog.jsonb_build_object(
            'investment_target_id', v_target_id,
            'quantity', v_quantity,
            'execution_unit_price', v_price,
            'execution_unit_price_currency', v_price_currency
          )
        )
      );
    else
      v_amount := private.parse_report_amount_minor_v1(v_elem->'amount_minor');
      if v_amount = 0 then
        continue;
      end if;

      v_normalized := v_normalized || pg_catalog.jsonb_build_array(
        pg_catalog.jsonb_strip_nulls(
          pg_catalog.jsonb_build_object(
            'investment_target_id', v_target_id,
            'amount_minor', v_amount,
            'quantity', v_quantity,
            'execution_unit_price', v_price,
            'execution_unit_price_currency', v_price_currency
          )
        )
      );
    end if;
  end loop;

  return v_normalized;
end;
$function$;

create function private.compose_report_lines_v1(
  p_report_mode public.investment_day_report_mode,
  p_outcome public.participation_outcome,
  p_normalized jsonb,
  p_planned jsonb
)
returns jsonb
language plpgsql
immutable
security invoker
set search_path = ''
as $function$
declare
  v_lines jsonb := '[]'::jsonb;
  v_planned jsonb;
  v_match jsonb;
  v_target_id uuid;
begin
  if p_outcome in ('skipped', 'failed') then
    if pg_catalog.jsonb_array_length(p_normalized) <> 0 then
      raise exception using
        errcode = 'P0001',
        message = 'vesty.purchase_lines_invalid';
    end if;
    return '[]'::jsonb;
  end if;

  if p_report_mode = 'as_planned' then
    for v_planned in
      select line.value
      from pg_catalog.jsonb_array_elements(p_planned) as line(value)
      where (line.value->>'amount_minor')::bigint > 0
      order by line.value->>'investment_target_id'
    loop
      v_target_id := (v_planned->>'investment_target_id')::uuid;
      select line.value
      into v_match
      from pg_catalog.jsonb_array_elements(p_normalized) as line(value)
      where (line.value->>'investment_target_id')::uuid = v_target_id;

      v_lines := v_lines || pg_catalog.jsonb_build_array(
        pg_catalog.jsonb_strip_nulls(
          pg_catalog.jsonb_build_object(
            'investment_target_id', v_target_id,
            'amount_minor', (v_planned->>'amount_minor')::bigint,
            'quantity', v_match->'quantity',
            'execution_unit_price', v_match->'execution_unit_price',
            'execution_unit_price_currency', v_match->'execution_unit_price_currency'
          )
        )
      );
    end loop;

    if pg_catalog.jsonb_array_length(v_lines) = 0 then
      raise exception using
        errcode = 'P0001',
        message = 'vesty.amount_invalid';
    end if;
    return v_lines;
  end if;

  if pg_catalog.jsonb_array_length(p_normalized) = 0 then
    raise exception using
      errcode = 'P0001',
      message = 'vesty.purchase_lines_invalid';
  end if;

  select coalesce(
    pg_catalog.jsonb_agg(line.value order by line.value->>'investment_target_id'),
    '[]'::jsonb
  )
  into v_lines
  from pg_catalog.jsonb_array_elements(p_normalized) as line(value);

  return v_lines;
end;
$function$;

-- ---------------------------------------------------------------------------
-- Trusted reporter. Private execute is not granted to authenticated.
-- ---------------------------------------------------------------------------

create function private.report_investment_day_v1(
  p_club_id uuid,
  p_cycle_id uuid,
  p_client_report_id uuid,
  p_report_mode public.investment_day_report_mode,
  p_outcome public.participation_outcome,
  p_purchase_lines jsonb
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
  v_existing public.member_investment_day_reports%rowtype;
  v_strategy_lines jsonb;
  v_planned jsonb;
  v_normalized jsonb;
  v_final_lines jsonb;
  v_fingerprint text;
  v_report_id uuid;
  v_now timestamptz := pg_catalog.now();
  v_provenance public.investment_amount_provenance;
begin
  v_user_id := private.require_authenticated_profile_id();

  if p_client_report_id is null then
    raise exception using
      errcode = 'P0001',
      message = 'vesty.client_report_id_invalid';
  end if;

  if p_report_mode is null then
    raise exception using
      errcode = 'P0001',
      message = 'vesty.report_mode_invalid';
  end if;

  if p_outcome is null or p_outcome not in ('confirmed', 'skipped', 'failed') then
    raise exception using
      errcode = 'P0001',
      message = 'vesty.outcome_invalid';
  end if;

  if p_report_mode = 'as_planned' and p_outcome <> 'confirmed' then
    raise exception using
      errcode = 'P0001',
      message = 'vesty.report_mode_invalid';
  end if;

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
    and participation.club_id = p_club_id
  for update;

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

  select *
  into v_existing
  from public.member_investment_day_reports as report
  where report.membership_id = v_membership.id
    and report.investment_cycle_id = p_cycle_id
  for update;

  select pg_catalog.jsonb_agg(
    pg_catalog.jsonb_build_object(
      'investment_target_id', allocation.investment_target_id,
      'allocation_bps', allocation.allocation_bps,
      'position', allocation.position
    )
    order by allocation.position
  )
  into v_strategy_lines
  from public.strategy_allocations as allocation
  where allocation.strategy_version_id = v_cycle.strategy_version_id;

  if v_strategy_lines is null then
    raise exception using
      errcode = 'P0001',
      message = 'vesty.strategy_missing';
  end if;

  select pg_catalog.jsonb_agg(
    pg_catalog.jsonb_build_object(
      'investment_target_id', allocated.investment_target_id,
      'amount_minor', allocated.amount_minor,
      'instrument_currency', target.currency
    )
    order by allocated.investment_target_id
  )
  into v_planned
  from private.allocate_minor_by_bps(
    v_participation.expected_amount_minor,
    v_strategy_lines
  ) as allocated
  join public.investment_targets as target
    on target.id = allocated.investment_target_id;

  v_normalized := private.normalize_report_purchase_lines_v1(
    p_report_mode,
    coalesce(p_purchase_lines, '[]'::jsonb),
    v_planned
  );
  v_final_lines := private.compose_report_lines_v1(
    p_report_mode,
    p_outcome,
    v_normalized,
    v_planned
  );
  v_fingerprint := private.investment_day_report_fingerprint_v1(
    p_report_mode,
    p_outcome,
    v_final_lines
  );

  if v_existing.id is not null then
    if v_existing.client_report_id = p_client_report_id
      and v_existing.payload_fingerprint = v_fingerprint
    then
      return query
      select *
      from private.investment_day_plan_v1(p_club_id, v_membership.id, p_cycle_id);
      return;
    end if;

    raise exception using
      errcode = 'P0001',
      message = 'vesty.report_conflict';
  end if;

  if v_participation.outcome <> 'expected' then
    raise exception using
      errcode = 'P0001',
      message = 'vesty.report_conflict';
  end if;

  if v_cycle.status <> 'open' then
    raise exception using
      errcode = 'P0001',
      message = 'vesty.cycle_not_open';
  end if;

  v_provenance := case
    when p_report_mode = 'as_planned' then 'member_attested_plan'::public.investment_amount_provenance
    else 'member_reported_actual'::public.investment_amount_provenance
  end;

  insert into public.member_investment_day_reports (
    club_id,
    membership_id,
    investment_cycle_id,
    client_report_id,
    report_mode,
    outcome,
    payload_fingerprint
  )
  values (
    p_club_id,
    v_membership.id,
    p_cycle_id,
    p_client_report_id,
    p_report_mode,
    p_outcome,
    v_fingerprint
  )
  returning id into v_report_id;

  if p_outcome = 'confirmed' then
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
      verification_status,
      report_id,
      amount_provenance
    )
    select
      p_club_id,
      v_membership.id,
      p_cycle_id,
      (line.value->>'investment_target_id')::uuid,
      'buy',
      (line.value->>'amount_minor')::bigint,
      v_club.base_currency,
      (line.value->>'quantity')::numeric,
      null,
      (line.value->>'execution_unit_price')::numeric,
      line.value->>'execution_unit_price_currency',
      v_now,
      v_now,
      'manual',
      'member_reported',
      v_report_id,
      v_provenance
    from pg_catalog.jsonb_array_elements(v_final_lines) as line(value);
  end if;

  update public.member_cycle_participations as participation
  set
    outcome = p_outcome,
    report_source = 'member_reported',
    reported_at = v_now
  where participation.id = v_participation.id
    and participation.outcome = 'expected';

  if not found then
    raise exception using
      errcode = 'P0001',
      message = 'vesty.report_conflict';
  end if;

  return query
  select *
  from private.investment_day_plan_v1(p_club_id, v_membership.id, p_cycle_id);
end;
$function$;

create function public.report_investment_day_v1(
  p_club_id uuid,
  p_cycle_id uuid,
  p_client_report_id uuid,
  p_report_mode public.investment_day_report_mode,
  p_outcome public.participation_outcome,
  p_purchase_lines jsonb
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
security definer
set search_path = ''
as $function$
  select *
  from private.report_investment_day_v1(
    p_club_id,
    p_cycle_id,
    p_client_report_id,
    p_report_mode,
    p_outcome,
    p_purchase_lines
  );
$function$;

comment on function public.report_investment_day_v1(uuid, uuid, uuid, public.investment_day_report_mode, public.participation_outcome, jsonb) is
  'Authenticated Investment Day reporter. SECURITY DEFINER only so the private implementation is not executable by the client role.';

-- ---------------------------------------------------------------------------
-- Plan projection includes amount provenance.
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
        'amount_provenance', transaction.amount_provenance,
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
-- Grants: public reporter only. Old confirm paths and private impl stay closed.
-- ---------------------------------------------------------------------------

revoke all on function private.parse_report_amount_minor_v1(jsonb) from public, anon, authenticated;
revoke all on function private.investment_day_report_fingerprint_v1(public.investment_day_report_mode, public.participation_outcome, jsonb) from public, anon, authenticated;
revoke all on function private.optional_execution_fields_v1(jsonb, text) from public, anon, authenticated;
revoke all on function private.normalize_report_purchase_lines_v1(public.investment_day_report_mode, jsonb, jsonb) from public, anon, authenticated;
revoke all on function private.compose_report_lines_v1(public.investment_day_report_mode, public.participation_outcome, jsonb, jsonb) from public, anon, authenticated;
revoke all on function private.report_investment_day_v1(uuid, uuid, uuid, public.investment_day_report_mode, public.participation_outcome, jsonb) from public, anon, authenticated;
revoke all on function public.report_investment_day_v1(uuid, uuid, uuid, public.investment_day_report_mode, public.participation_outcome, jsonb) from public, anon;

grant execute on function public.report_investment_day_v1(uuid, uuid, uuid, public.investment_day_report_mode, public.participation_outcome, jsonb) to authenticated;

revoke all on function public.confirm_investment_day_v1(uuid, uuid) from public, anon, authenticated;
revoke all on function public.confirm_investment_day_v2(uuid, uuid, jsonb) from public, anon, authenticated;
revoke all on function private.confirm_investment_day_v1(uuid, uuid) from public, anon, authenticated;
revoke all on function private.confirm_investment_day_v2(uuid, uuid, jsonb) from public, anon, authenticated;

grant usage on type public.investment_day_report_mode to authenticated;
grant usage on type public.investment_amount_provenance to authenticated;

-- ---------------------------------------------------------------------------
-- Own-position read models expose amount provenance without mixing trust.
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
  end as quantity_status,
  case
    when pg_catalog.count(distinct transaction.amount_provenance) = 1
    then pg_catalog.min(transaction.amount_provenance::text)
    else 'mixed'
  end as amount_provenance
from public.member_investment_transactions as transaction
where transaction.transaction_type = 'buy'
group by
  transaction.membership_id,
  transaction.club_id,
  transaction.investment_target_id,
  transaction.currency;

comment on view public.member_investment_positions is
  'Derived own cost basis from member-reported buy transactions. amount_provenance is mixed when lots disagree. total_quantity sums only rows with quantity.';

revoke all on public.member_investment_positions from public, anon, authenticated;
grant select on public.member_investment_positions to authenticated;

create or replace view public.member_position_valuations_v1
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
  end as current_value_currency,
  position.amount_provenance
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
  'Own position quantity times latest fresh Marketstack close, in instrument currency only. amount_provenance is inherited from the position lots.';

revoke all on public.member_position_valuations_v1 from public, anon, authenticated;
grant select on public.member_position_valuations_v1 to authenticated;

create or replace view public.member_investment_lots_v1
with (security_invoker = true)
as
select
  lot.transaction_id,
  lot.membership_id,
  lot.club_id,
  lot.investment_cycle_id,
  lot.investment_target_id,
  lot.amount_minor,
  lot.contribution_currency,
  lot.exact_quantity,
  lot.reference_date,
  lot.is_core_v1_etf,
  fx.rate as reference_fx_rate,
  fx.rate_date as reference_fx_date,
  close.price as reference_eur_price,
  close.price_date as reference_price_date,
  close.currency as reference_price_currency,
  case
    when lot.exact_quantity is not null then null
    when lot.is_core_v1_etf
      and fx.rate is not null
      and fx.rate > 0
      and close.price is not null
      and close.price > 0
    then (lot.amount_minor::numeric / 100) / fx.rate / close.price
    else null
  end as modelled_quantity,
  case
    when lot.exact_quantity is not null then lot.exact_quantity
    when lot.is_core_v1_etf
      and fx.rate is not null
      and fx.rate > 0
      and close.price is not null
      and close.price > 0
    then (lot.amount_minor::numeric / 100) / fx.rate / close.price
    else null
  end as lot_quantity,
  case
    when lot.exact_quantity is not null then 'exact'
    when lot.is_core_v1_etf
      and fx.rate is not null
      and fx.rate > 0
      and close.price is not null
      and close.price > 0
    then 'estimated'
    else 'unavailable'
  end as lot_quantity_source,
  lot.amount_provenance
from (
  select
    transaction.id as transaction_id,
    transaction.membership_id,
    transaction.club_id,
    transaction.investment_cycle_id,
    transaction.investment_target_id,
    transaction.amount_minor,
    transaction.currency as contribution_currency,
    transaction.quantity as exact_quantity,
    public.cycle_reference_date_v1(cycle.investment_day_at, cycle.timezone) as reference_date,
    transaction.investment_target_id = any (private.core_v1_etf_target_ids()) as is_core_v1_etf,
    transaction.amount_provenance
  from public.member_investment_transactions as transaction
  join public.investment_cycles as cycle
    on cycle.id = transaction.investment_cycle_id
  where transaction.transaction_type = 'buy'
) as lot
left join lateral public.fx_rate_as_of_v1(
  'EUR',
  'NOK',
  lot.reference_date,
  public.reference_lookup_max_age_days_v1()
) as fx on lot.is_core_v1_etf and lot.exact_quantity is null
left join lateral public.marketstack_close_as_of_v1(
  lot.investment_target_id,
  lot.reference_date,
  public.reference_lookup_max_age_days_v1()
) as close on lot.is_core_v1_etf and lot.exact_quantity is null;

comment on view public.member_investment_lots_v1 is
  'Per-buy lot with exact member-reported quantity or a derived modelled_quantity. amount_provenance is the stored trust of amount_minor. Modelled quantity is never written back.';

revoke all on public.member_investment_lots_v1 from public, anon, authenticated;
grant select on public.member_investment_lots_v1 to authenticated;

create or replace view public.member_estimated_positions_v1
with (security_invoker = true)
as
select
  lot.membership_id,
  lot.club_id,
  lot.investment_target_id,
  target.name as target_name,
  target.kind as target_kind,
  target.ticker as target_ticker,
  target.currency as instrument_currency,
  lot.contribution_currency,
  pg_catalog.sum(lot.amount_minor) as total_invested_minor,
  pg_catalog.count(*)::integer as lot_count,
  pg_catalog.count(*) filter (where lot.lot_quantity_source = 'exact')::integer as exact_lot_count,
  pg_catalog.count(*) filter (where lot.lot_quantity_source = 'estimated')::integer as estimated_lot_count,
  pg_catalog.count(*) filter (where lot.lot_quantity_source = 'unavailable')::integer as unavailable_lot_count,
  pg_catalog.sum(lot.exact_quantity) as exact_quantity,
  pg_catalog.sum(lot.modelled_quantity) as modelled_quantity,
  pg_catalog.sum(lot.lot_quantity) as valued_quantity,
  case
    when pg_catalog.count(*) = 0 then 'unavailable'
    when pg_catalog.count(*) filter (where lot.lot_quantity_source = 'unavailable') > 0 then 'unavailable'
    when pg_catalog.count(*) filter (where lot.lot_quantity_source = 'exact') = pg_catalog.count(*) then 'exact'
    when pg_catalog.count(*) filter (where lot.lot_quantity_source = 'estimated') = pg_catalog.count(*) then 'estimated'
    else 'mixed'
  end as valuation_confidence,
  latest_price.price as latest_eur_price,
  latest_price.price_date as latest_eur_price_date,
  latest_price.freshness as latest_eur_price_freshness,
  latest_fx.rate as latest_eur_nok,
  latest_fx.rate_date as latest_eur_nok_date,
  latest_fx.freshness as latest_eur_nok_freshness,
  case
    when pg_catalog.count(*) filter (where lot.lot_quantity_source = 'unavailable') > 0 then null
    when pg_catalog.sum(lot.lot_quantity) is null then null
    when latest_price.price is null or latest_price.price <= 0 then null
    when latest_price.freshness is distinct from 'fresh' then null
    when latest_price.currency is distinct from target.currency then null
    when latest_fx.rate is null or latest_fx.rate <= 0 then null
    when latest_fx.freshness is distinct from 'fresh' then null
    else pg_catalog.sum(lot.lot_quantity) * latest_price.price * latest_fx.rate
  end as estimated_current_value_nok,
  case
    when pg_catalog.count(*) filter (where lot.lot_quantity_source = 'unavailable') > 0 then null
    when pg_catalog.sum(lot.lot_quantity) is null then null
    when latest_price.price is null or latest_price.price <= 0 then null
    when latest_price.freshness is distinct from 'fresh' then null
    when latest_price.currency is distinct from target.currency then null
    when latest_fx.rate is null or latest_fx.rate <= 0 then null
    when latest_fx.freshness is distinct from 'fresh' then null
    else pg_catalog.round(pg_catalog.sum(lot.lot_quantity) * latest_price.price * latest_fx.rate * 100)
  end as estimated_current_value_minor,
  case
    when pg_catalog.count(distinct lot.amount_provenance) = 1
    then pg_catalog.min(lot.amount_provenance::text)
    else 'mixed'
  end as amount_provenance
from public.member_investment_lots_v1 as lot
join public.investment_targets as target
  on target.id = lot.investment_target_id
left join public.latest_market_price_status as latest_price
  on latest_price.investment_target_id = lot.investment_target_id
 and latest_price.provider = 'marketstack'
 and latest_price.price_type = 'close'
left join public.latest_fx_rate_status as latest_fx
  on latest_fx.base_currency = 'EUR'
 and latest_fx.quote_currency = 'NOK'
 and latest_fx.provider = 'norges_bank'
group by
  lot.membership_id,
  lot.club_id,
  lot.investment_target_id,
  lot.contribution_currency,
  target.name,
  target.kind,
  target.ticker,
  target.currency,
  latest_price.price,
  latest_price.price_date,
  latest_price.freshness,
  latest_price.currency,
  latest_fx.rate,
  latest_fx.rate_date,
  latest_fx.freshness;

comment on view public.member_estimated_positions_v1 is
  'Own-position estimated NOK value. amount_provenance is mixed when lots disagree. Modelled quantity is never treated as owned quantity.';

revoke all on public.member_estimated_positions_v1 from public, anon, authenticated;
grant select on public.member_estimated_positions_v1 to authenticated;
