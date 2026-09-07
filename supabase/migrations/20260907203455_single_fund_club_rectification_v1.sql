-- Corrective Simple saving migration.
-- Tightens broker URL allowlisting, materializes the first Investment Day
-- inside create_club_v3, and asks PostgREST to reload its schema cache.
-- Does not edit 20260907192616_single_fund_club_v1.sql.

-- ---------------------------------------------------------------------------
-- Broker / source URL allowlist
-- ---------------------------------------------------------------------------

create function private.is_allowed_single_fund_source_url(p_url text)
returns boolean
language sql
immutable
strict
set search_path = ''
as $function$
  select
    p_url ~* '^https://'
    and position('@' in split_part(p_url, '/', 3)) = 0
    and lower(split_part(p_url, '/', 3)) in ('www.dnb.no', 'www.nordnet.no');
$function$;

comment on function private.is_allowed_single_fund_source_url(text) is
  'Accepts only HTTPS URLs whose host is exactly www.dnb.no or www.nordnet.no. Rejects HTTP, lookalike hosts, and userinfo disguises.';

revoke all on function private.is_allowed_single_fund_source_url(text)
  from public, anon, authenticated;

alter table private.single_fund_broker_listings
  drop constraint single_fund_broker_listings_product_url_check,
  drop constraint single_fund_broker_listings_source_url_check;

alter table private.single_fund_broker_listings
  add constraint single_fund_broker_listings_product_url_check
    check (private.is_allowed_single_fund_source_url(product_url)),
  add constraint single_fund_broker_listings_source_url_check
    check (private.is_allowed_single_fund_source_url(cost_source_url));

-- ---------------------------------------------------------------------------
-- Skip expired occurrences that have no historically valid strategy
-- ---------------------------------------------------------------------------

create or replace function private.advance_club_investment_cycles_v1(
  p_club_id uuid,
  p_now timestamptz
)
returns void
language plpgsql
volatile
security definer
set search_path = ''
set row_security = off
as $function$
declare
  v_now timestamptz := coalesce(p_now, pg_catalog.now());
  v_club public.clubs%rowtype;
  v_anchor_schedule public.investment_schedules%rowtype;
  v_strategy_id uuid;
  v_policy_id uuid;
  v_occurrence_strategy_id uuid;
  v_occurrence_policy_id uuid;
  v_local timestamp;
  v_month timestamp;
  v_end timestamp;
  v_year integer;
  v_month_no integer;
  v_key text;
  v_occurrence record;
  v_cycle public.investment_cycles%rowtype;
begin
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(p_club_id::text, 17)
  );

  select *
  into v_club
  from public.clubs as club
  where club.id = p_club_id
    and club.status = 'active';

  if not found then
    return;
  end if;

  perform private.ensure_club_investment_schedule_v1(p_club_id);

  select *
  into v_anchor_schedule
  from public.investment_schedules as schedule
  where schedule.club_id = p_club_id
  order by schedule.revision_number desc, schedule.id desc
  limit 1;

  if not found then
    return;
  end if;

  select version.id
  into v_strategy_id
  from public.strategy_versions as version
  where version.club_id = p_club_id
  order by version.version_number desc, version.id desc
  limit 1;

  v_policy_id := private.latest_contribution_policy_version_id_v1(p_club_id);

  if v_strategy_id is null or v_policy_id is null then
    return;
  end if;

  v_local := v_now at time zone v_anchor_schedule.timezone;
  v_month := pg_catalog.date_trunc('month', v_local) - interval '2 months';
  v_end := pg_catalog.date_trunc('month', v_local) + interval '2 months';

  while v_month <= v_end loop
    v_year := pg_catalog.date_part('year', v_month)::integer;
    v_month_no := pg_catalog.date_part('month', v_month)::integer;

    select *
    into v_occurrence
    from private.investment_schedule_occurrence_v1(
      p_club_id,
      v_year,
      v_month_no
    );

    if found
      and v_occurrence.schedule_status in ('active', 'replaced', 'ended')
    then
      v_key := private.investment_occurrence_key_v1(
        v_occurrence.investment_day_at,
        v_occurrence.timezone
      );

      select version.id
      into v_occurrence_strategy_id
      from public.strategy_versions as version
      where version.club_id = p_club_id
        and version.effective_at <= v_occurrence.configuration_deadline_at
      order by
        version.effective_at desc,
        version.version_number desc,
        version.id desc
      limit 1;

      v_occurrence_policy_id := private.latest_contribution_policy_version_id_at_v1(
        p_club_id,
        v_occurrence.configuration_deadline_at
      );

      -- A brand-new genesis strategy is effective at now(). Materializing an
      -- already expired month would later freeze with vesty.strategy_missing
      -- and roll back create_club_v3. Skip those months; keep months that
      -- still have a historically valid strategy, or whose deadline is open.
      if v_occurrence.configuration_deadline_at > v_now
        or v_occurrence_strategy_id is not null
      then
        insert into public.investment_cycles (
          club_id,
          investment_schedule_id,
          strategy_version_id,
          contribution_policy_version_id,
          occurrence_key,
          investment_day_at,
          configuration_deadline_at,
          reporting_opens_at,
          reporting_closes_at,
          timezone,
          status
        )
        values (
          p_club_id,
          v_occurrence.investment_schedule_id,
          coalesce(v_occurrence_strategy_id, v_strategy_id),
          coalesce(v_occurrence_policy_id, v_policy_id),
          v_key,
          v_occurrence.investment_day_at,
          v_occurrence.configuration_deadline_at,
          v_occurrence.reporting_opens_at,
          v_occurrence.reporting_closes_at,
          v_occurrence.timezone,
          'upcoming'
        )
        on conflict on constraint investment_cycles_club_occurrence_key do nothing;
      end if;
    end if;

    v_month := v_month + interval '1 month';
  end loop;

  for v_cycle in
    select *
    from public.investment_cycles as cycle
    where cycle.club_id = p_club_id
      and cycle.status <> 'cancelled'
    order by cycle.investment_day_at
    for update
  loop
    perform private.freeze_investment_cycle_roster_v1(v_cycle.id, v_now);

    select *
    into v_cycle
    from public.investment_cycles as cycle
    where cycle.id = v_cycle.id;

    if v_cycle.status = 'upcoming'
      and v_cycle.roster_frozen_at is not null
      and v_now >= v_cycle.reporting_opens_at
      and v_now < v_cycle.reporting_closes_at
    then
      update public.investment_cycles as cycle
      set
        status = 'open',
        opened_at = v_cycle.reporting_opens_at
      where cycle.id = v_cycle.id
        and cycle.status = 'upcoming';
    elsif v_cycle.status = 'upcoming'
      and v_now >= v_cycle.reporting_closes_at
    then
      perform private.freeze_investment_cycle_roster_v1(v_cycle.id, v_now);
      update public.investment_cycles as cycle
      set
        status = 'completed',
        opened_at = cycle.reporting_opens_at,
        closed_at = cycle.reporting_closes_at
      where cycle.id = v_cycle.id
        and cycle.status = 'upcoming';
    elsif v_cycle.status = 'open'
      and v_now >= v_cycle.reporting_closes_at
    then
      update public.investment_cycles as cycle
      set
        status = 'completed',
        closed_at = v_cycle.reporting_closes_at
      where cycle.id = v_cycle.id
        and cycle.status = 'open';
    end if;
  end loop;
end;
$function$;

comment on function private.advance_club_investment_cycles_v1(uuid, timestamptz) is
  'Trusted lifecycle. Idempotently materializes schedule occurrences, skipping expired months that have no historically valid strategy so a mid-month create does not reopen a closed period.';

revoke all on function private.advance_club_investment_cycles_v1(uuid, timestamptz)
  from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- create_club_v3 writes schedule + first valid period in the same transaction
-- ---------------------------------------------------------------------------

create or replace function private.create_club_v3(
  p_name text,
  p_investment_mode public.club_investment_mode,
  p_catalog_product_id uuid,
  p_governance_threshold_kind public.governance_threshold_kind,
  p_contribution_mode public.contribution_policy_mode,
  p_client_creation_id uuid,
  p_equal_amount_minor bigint,
  p_creator_flexible_amount_minor bigint,
  p_base_currency text
)
returns table (
  club_id uuid,
  membership_id uuid,
  strategy_version_id uuid
)
language plpgsql
volatile
security definer
set search_path = ''
set row_security = off
as $function$
declare
  v_user_id uuid;
  v_name text;
  v_currency text;
  v_fingerprint text;
  v_existing private.club_creation_requests%rowtype;
  v_product private.single_fund_products%rowtype;
  v_target public.investment_targets%rowtype;
  v_club_id uuid;
  v_membership_id uuid;
  v_strategy_id uuid;
begin
  v_user_id := private.require_authenticated_profile_id();

  if p_client_creation_id is null then
    raise exception using
      errcode = 'P0001',
      message = 'vesty.client_creation_id_invalid';
  end if;

  v_name := pg_catalog.btrim(coalesce(p_name, ''));
  if v_name = '' or pg_catalog.char_length(v_name) > 80 then
    raise exception using
      errcode = 'P0001',
      message = 'vesty.club_name_invalid';
  end if;

  v_currency := pg_catalog.upper(pg_catalog.btrim(coalesce(p_base_currency, 'NOK')));
  if v_currency <> 'NOK' then
    raise exception using
      errcode = 'P0001',
      message = 'vesty.base_currency_unsupported';
  end if;

  if p_investment_mode is distinct from 'single_fund' then
    raise exception using
      errcode = 'P0001',
      message = 'vesty.investment_mode_unavailable';
  end if;

  if p_contribution_mode is null then
    raise exception using
      errcode = 'P0001',
      message = 'vesty.contribution_policy_invalid';
  end if;

  if p_contribution_mode = 'equal' then
    if p_equal_amount_minor is null or p_equal_amount_minor <= 0 then
      raise exception using
        errcode = 'P0001',
        message = 'vesty.contribution_policy_invalid';
    end if;
    if p_creator_flexible_amount_minor is not null then
      raise exception using
        errcode = 'P0001',
        message = 'vesty.contribution_policy_invalid';
    end if;
  else
    if p_contribution_mode is distinct from 'flexible' then
      raise exception using
        errcode = 'P0001',
        message = 'vesty.contribution_policy_invalid';
    end if;
    if p_equal_amount_minor is not null then
      raise exception using
        errcode = 'P0001',
        message = 'vesty.contribution_policy_invalid';
    end if;
    if p_creator_flexible_amount_minor is null or p_creator_flexible_amount_minor <= 0 then
      raise exception using
        errcode = 'P0001',
        message = 'vesty.contribution_commitment_invalid';
    end if;
  end if;

  v_fingerprint := private.club_creation_fingerprint_v1(
    v_name,
    p_investment_mode,
    p_catalog_product_id,
    p_governance_threshold_kind,
    p_contribution_mode,
    p_equal_amount_minor,
    p_creator_flexible_amount_minor,
    v_currency
  );

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(
      v_user_id::text || chr(31) || p_client_creation_id::text,
      17
    )
  );

  select *
  into v_existing
  from private.club_creation_requests as request
  where request.profile_id = v_user_id
    and request.client_creation_id = p_client_creation_id;

  if found then
    if v_existing.request_fingerprint = v_fingerprint then
      club_id := v_existing.club_id;
      membership_id := v_existing.membership_id;
      strategy_version_id := v_existing.strategy_version_id;
      return next;
      return;
    end if;

    raise exception using
      errcode = 'P0001',
      message = 'vesty.creation_conflict';
  end if;

  if p_catalog_product_id is null then
    raise exception using
      errcode = 'P0001',
      message = 'vesty.catalog_product_unavailable';
  end if;

  select *
  into v_product
  from private.single_fund_products as product
  where product.id = p_catalog_product_id
  for update;

  if not found
    or v_product.status <> 'active'
    or v_product.allowed_investment_mode <> 'single_fund'
    or v_product.currency <> v_currency
  then
    raise exception using
      errcode = 'P0001',
      message = 'vesty.catalog_product_unavailable';
  end if;

  select *
  into v_target
  from public.investment_targets as target
  where target.id = v_product.investment_target_id
  for update;

  if not found
    or v_target.status <> 'active'
    or v_target.kind <> 'fund'
    or v_target.isin is null
    or btrim(v_target.isin) = ''
    or v_target.currency <> v_currency
  then
    raise exception using
      errcode = 'P0001',
      message = 'vesty.catalog_product_unavailable';
  end if;

  v_club_id := pg_catalog.gen_random_uuid();
  v_membership_id := pg_catalog.gen_random_uuid();
  v_strategy_id := pg_catalog.gen_random_uuid();

  insert into public.clubs (
    id,
    name,
    status,
    base_currency,
    governance_threshold_kind,
    current_owner_membership_id,
    investment_mode
  )
  values (
    v_club_id,
    v_name,
    'active',
    v_currency,
    p_governance_threshold_kind,
    v_membership_id,
    'single_fund'
  );

  insert into public.club_memberships (
    id,
    club_id,
    profile_id,
    status
  )
  values (
    v_membership_id,
    v_club_id,
    v_user_id,
    'active'
  );

  insert into public.strategy_versions (
    id,
    club_id,
    version_number,
    created_by_membership_id,
    origin,
    source_proposal_id,
    approved_at,
    effective_at
  )
  values (
    v_strategy_id,
    v_club_id,
    1,
    v_membership_id,
    'genesis',
    null,
    null,
    pg_catalog.now()
  );

  insert into public.strategy_allocations (
    strategy_version_id,
    investment_target_id,
    allocation_bps,
    position,
    target_name,
    target_kind,
    target_isin,
    target_ticker,
    target_exchange
  )
  values (
    v_strategy_id,
    v_target.id,
    10000,
    1,
    v_target.name,
    v_target.kind,
    v_target.isin,
    v_target.ticker,
    v_target.exchange
  );

  insert into public.contribution_policy_versions (
    club_id,
    version_number,
    mode,
    currency,
    equal_amount_minor,
    created_by_membership_id
  )
  values (
    v_club_id,
    1,
    p_contribution_mode,
    v_currency,
    case
      when p_contribution_mode = 'equal' then p_equal_amount_minor
      else null
    end,
    v_membership_id
  );

  if p_contribution_mode = 'flexible' then
    insert into public.member_contribution_commitment_versions (
      club_id,
      membership_id,
      version_number,
      amount_minor,
      currency
    )
    values (
      v_club_id,
      v_membership_id,
      1,
      p_creator_flexible_amount_minor,
      v_currency
    );

    perform private.ensure_legacy_saving_plan_for_amount_v1(
      v_club_id,
      v_membership_id,
      p_creator_flexible_amount_minor,
      v_currency
    );
  end if;

  perform private.ensure_club_investment_schedule_v1(v_club_id);
  perform private.advance_club_investment_cycles_v1(v_club_id, pg_catalog.now());

  insert into private.club_creation_requests (
    profile_id,
    client_creation_id,
    request_fingerprint,
    club_id,
    membership_id,
    strategy_version_id
  )
  values (
    v_user_id,
    p_client_creation_id,
    v_fingerprint,
    v_club_id,
    v_membership_id,
    v_strategy_id
  );

  club_id := v_club_id;
  membership_id := v_membership_id;
  strategy_version_id := v_strategy_id;
  return next;
end;
$function$;

comment on function private.create_club_v3(
  text,
  public.club_investment_mode,
  uuid,
  public.governance_threshold_kind,
  public.contribution_policy_mode,
  uuid,
  bigint,
  bigint,
  text
) is
  'Trusted Simple saving create. After club, membership, genesis strategy, and policy exist, it writes the default Investment Day schedule and advances the club with the server clock in the same transaction. Clients cannot supply a clock or investment_target_id.';

revoke all on function private.create_club_v3(
  text,
  public.club_investment_mode,
  uuid,
  public.governance_threshold_kind,
  public.contribution_policy_mode,
  uuid,
  bigint,
  bigint,
  text
) from public, anon, authenticated;

-- Deploy order after this migration:
-- 1. Apply the migration.
-- 2. Confirm or reload the PostgREST schema cache.
-- 3. Verify catalog and create RPCs.
-- 4. Ship the client.
-- The client still shows a retryable error if an RPC is temporarily missing.
notify pgrst, 'reload schema';
