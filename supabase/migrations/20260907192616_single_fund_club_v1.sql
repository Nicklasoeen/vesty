-- Simple saving v1: explicit club investment mode, allowlisted single-fund
-- catalog, and idempotent create_club_v3. Does not change create_club or
-- create_club_v2. Existing clubs stay legacy_package.

-- ---------------------------------------------------------------------------
-- Club investment mode
-- ---------------------------------------------------------------------------

create type public.club_investment_mode as enum (
  'legacy_package',
  'single_fund',
  'custom_portfolio'
);

alter table public.clubs
  add column investment_mode public.club_investment_mode not null default 'legacy_package';

comment on column public.clubs.investment_mode is
  'Immutable v1 investment method. Existing and package-created clubs are legacy_package. Simple saving clubs are single_fund. custom_portfolio is reserved and not creatable in this release.';

create function private.reject_club_investment_mode_mutation()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
begin
  if new.investment_mode is distinct from old.investment_mode then
    raise exception using
      errcode = 'P0001',
      message = 'vesty.investment_mode_immutable';
  end if;

  return new;
end;
$function$;

create trigger clubs_investment_mode_immutable
before update on public.clubs
for each row
execute function private.reject_club_investment_mode_mutation();

-- ---------------------------------------------------------------------------
-- DNB Global Indeks A investment target
-- No ticker, exchange, provider symbol, NAV, or return series.
-- ---------------------------------------------------------------------------

insert into public.investment_targets (
  id,
  name,
  kind,
  status,
  currency,
  isin,
  ticker,
  exchange,
  provider_symbol
)
values (
  '31000000-0000-4000-8000-000000000021',
  'DNB Global Indeks A',
  'fund',
  'active',
  'NOK',
  'NO0010582984',
  null,
  null,
  null
);

-- ---------------------------------------------------------------------------
-- Server-owned single-fund catalog
-- ---------------------------------------------------------------------------

create type public.single_fund_product_status as enum (
  'active',
  'inactive'
);

create table private.single_fund_products (
  id uuid primary key,
  investment_target_id uuid not null unique
    references public.investment_targets (id) on delete restrict,
  legal_name text not null,
  display_name text not null,
  manager_name text not null,
  short_description text not null,
  risk_indicator text not null,
  recommended_horizon text not null,
  currency text not null,
  status public.single_fund_product_status not null,
  display_order smallint not null,
  allowed_investment_mode public.club_investment_mode not null,
  checked_on date not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint single_fund_products_legal_name_check
    check (btrim(legal_name) <> ''),
  constraint single_fund_products_display_name_check
    check (btrim(display_name) <> ''),
  constraint single_fund_products_manager_check
    check (btrim(manager_name) <> ''),
  constraint single_fund_products_description_check
    check (btrim(short_description) <> ''),
  constraint single_fund_products_risk_check
    check (btrim(risk_indicator) <> ''),
  constraint single_fund_products_horizon_check
    check (btrim(recommended_horizon) <> ''),
  constraint single_fund_products_currency_check
    check (currency ~ '^[A-Z]{3}$'),
  constraint single_fund_products_display_order_check
    check (display_order >= 1),
  constraint single_fund_products_display_order_key
    unique (display_order),
  constraint single_fund_products_allowed_mode_check
    check (allowed_investment_mode = 'single_fund'),
  constraint single_fund_products_updated_at_check
    check (updated_at >= created_at)
);

create table private.single_fund_broker_listings (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null
    references private.single_fund_products (id) on delete restrict,
  broker text not null,
  is_verified boolean not null,
  product_url text not null,
  annual_cost_label text not null,
  cost_source_label text not null,
  cost_source_url text not null,
  minimum_note text,

  constraint single_fund_broker_listings_product_broker_key
    unique (product_id, broker),
  constraint single_fund_broker_listings_broker_check
    check (broker in ('dnb', 'nordnet')),
  constraint single_fund_broker_listings_product_url_check
    check (product_url ~ '^https://'),
  constraint single_fund_broker_listings_cost_label_check
    check (btrim(annual_cost_label) <> ''),
  constraint single_fund_broker_listings_source_label_check
    check (btrim(cost_source_label) <> ''),
  constraint single_fund_broker_listings_source_url_check
    check (cost_source_url ~ '^https://'),
  constraint single_fund_broker_listings_minimum_note_check
    check (minimum_note is null or btrim(minimum_note) <> '')
);

comment on table private.single_fund_products is
  'Vesty-owned Simple saving catalog. Clients cannot read or write these rows. create_club_v3 resolves an allowlisted product id.';

comment on table private.single_fund_broker_listings is
  'Broker-specific availability, URLs, and sourced costs for a Simple saving product. Costs are not a universal fund fee.';

alter table private.single_fund_products enable row level security;
alter table private.single_fund_products force row level security;
alter table private.single_fund_broker_listings enable row level security;
alter table private.single_fund_broker_listings force row level security;

revoke all on table private.single_fund_products from public, anon, authenticated;
revoke all on table private.single_fund_broker_listings from public, anon, authenticated;

insert into private.single_fund_products (
  id,
  investment_target_id,
  legal_name,
  display_name,
  manager_name,
  short_description,
  risk_indicator,
  recommended_horizon,
  currency,
  status,
  display_order,
  allowed_investment_mode,
  checked_on
)
values (
  '32000000-0000-4000-8000-000000000001',
  '31000000-0000-4000-8000-000000000021',
  'DNB Global Indeks A',
  'DNB Global Indeks A',
  'DNB',
  'Global index-tracking equity fund focused on developed markets',
  '4 of 7',
  'At least 6 years',
  'NOK',
  'active',
  1,
  'single_fund',
  '2026-09-07'
);

insert into private.single_fund_broker_listings (
  product_id,
  broker,
  is_verified,
  product_url,
  annual_cost_label,
  cost_source_label,
  cost_source_url,
  minimum_note
)
values
  (
    '32000000-0000-4000-8000-000000000001',
    'dnb',
    true,
    'https://www.dnb.no/sparing/fond/fond-liste/d/dnb-global-indeks-a-NO0010582984',
    '0.20% annual price through DNB',
    'DNB fund page, checked 7 September 2026',
    'https://www.dnb.no/sparing/fond/fond-liste/d/dnb-global-indeks-a-NO0010582984',
    'DNB lists a 100 kr minimum on its own platform. Other brokers may differ.'
  ),
  (
    '32000000-0000-4000-8000-000000000001',
    'nordnet',
    true,
    'https://www.nordnet.no/fond/liste/dnb-global-indeks-a-nok-7b4b0894',
    '0.25% total annual price at Nordnet',
    'Nordnet fund page, checked 7 September 2026',
    'https://www.nordnet.no/fond/liste/dnb-global-indeks-a-nok-7b4b0894',
    null
  );

-- ---------------------------------------------------------------------------
-- Idempotent creation requests
-- ---------------------------------------------------------------------------

create table private.club_creation_requests (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles (id) on delete restrict,
  client_creation_id uuid not null,
  request_fingerprint text not null,
  club_id uuid not null references public.clubs (id) on delete restrict,
  membership_id uuid not null,
  strategy_version_id uuid not null,
  created_at timestamptz not null default now(),

  constraint club_creation_requests_profile_client_key
    unique (profile_id, client_creation_id),
  constraint club_creation_requests_fingerprint_check
    check (request_fingerprint ~ '^[0-9a-f]{64}$')
);

comment on table private.club_creation_requests is
  'Idempotency ledger for create_club_v3. Unique per (profile_id, client_creation_id). Same fingerprint returns the stored club; a different payload conflicts.';

alter table private.club_creation_requests enable row level security;
alter table private.club_creation_requests force row level security;

revoke all on table private.club_creation_requests from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Catalog RPC
-- ---------------------------------------------------------------------------

create function private.single_fund_catalog_v1()
returns table (
  product_id uuid,
  legal_name text,
  display_name text,
  manager_name text,
  short_description text,
  risk_indicator text,
  recommended_horizon text,
  currency text,
  isin text,
  kind public.investment_target_kind,
  status public.single_fund_product_status,
  display_order smallint,
  checked_on date,
  brokers jsonb
)
language sql
stable
security definer
set search_path = ''
set row_security = off
as $function$
  select
    product.id,
    product.legal_name,
    product.display_name,
    product.manager_name,
    product.short_description,
    product.risk_indicator,
    product.recommended_horizon,
    product.currency,
    target.isin,
    target.kind,
    product.status,
    product.display_order,
    product.checked_on,
    coalesce(
      (
        select pg_catalog.jsonb_agg(
          pg_catalog.jsonb_build_object(
            'broker', listing.broker,
            'is_verified', listing.is_verified,
            'product_url', listing.product_url,
            'annual_cost_label', listing.annual_cost_label,
            'cost_source_label', listing.cost_source_label,
            'cost_source_url', listing.cost_source_url,
            'minimum_note', listing.minimum_note
          )
          order by listing.broker
        )
        from private.single_fund_broker_listings as listing
        where listing.product_id = product.id
      ),
      '[]'::jsonb
    )
  from private.single_fund_products as product
  join public.investment_targets as target
    on target.id = product.investment_target_id
  where product.status = 'active'
    and target.status = 'active'
    and product.allowed_investment_mode = 'single_fund'
  order by product.display_order, product.id;
$function$;

create function public.single_fund_catalog_v1()
returns table (
  product_id uuid,
  legal_name text,
  display_name text,
  manager_name text,
  short_description text,
  risk_indicator text,
  recommended_horizon text,
  currency text,
  isin text,
  kind public.investment_target_kind,
  status public.single_fund_product_status,
  display_order smallint,
  checked_on date,
  brokers jsonb
)
language sql
stable
security definer
set search_path = ''
set row_security = off
as $function$
  select *
  from private.single_fund_catalog_v1();
$function$;

comment on function public.single_fund_catalog_v1() is
  'Authenticated read of active Simple saving products. Returns sourced product facts only. Does not expose investment_target_id, NAV, or private catalog rows.';

-- ---------------------------------------------------------------------------
-- create_club_v3
-- ---------------------------------------------------------------------------

create function private.club_creation_fingerprint_v1(
  p_name text,
  p_investment_mode public.club_investment_mode,
  p_catalog_product_id uuid,
  p_governance_threshold_kind public.governance_threshold_kind,
  p_contribution_mode public.contribution_policy_mode,
  p_equal_amount_minor bigint,
  p_creator_flexible_amount_minor bigint,
  p_base_currency text
)
returns text
language sql
immutable
security definer
set search_path = ''
as $function$
  select encode(
    pg_catalog.sha256(
      convert_to(
        concat_ws(
          chr(31),
          coalesce(p_name, ''),
          coalesce(p_investment_mode::text, ''),
          coalesce(p_catalog_product_id::text, ''),
          coalesce(p_governance_threshold_kind::text, ''),
          coalesce(p_contribution_mode::text, ''),
          coalesce(p_equal_amount_minor::text, ''),
          coalesce(p_creator_flexible_amount_minor::text, ''),
          coalesce(p_base_currency, '')
        ),
        'utf8'
      )
    ),
    'hex'
  );
$function$;

create function private.create_club_v3(
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

create function public.create_club_v3(
  p_name text,
  p_investment_mode public.club_investment_mode,
  p_catalog_product_id uuid,
  p_governance_threshold_kind public.governance_threshold_kind,
  p_contribution_mode public.contribution_policy_mode,
  p_client_creation_id uuid,
  p_equal_amount_minor bigint default null,
  p_creator_flexible_amount_minor bigint default null,
  p_base_currency text default 'NOK'
)
returns table (
  club_id uuid,
  membership_id uuid,
  strategy_version_id uuid
)
language sql
volatile
security definer
set search_path = ''
set row_security = off
as $function$
  select *
  from private.create_club_v3(
    p_name,
    p_investment_mode,
    p_catalog_product_id,
    p_governance_threshold_kind,
    p_contribution_mode,
    p_client_creation_id,
    p_equal_amount_minor,
    p_creator_flexible_amount_minor,
    p_base_currency
  );
$function$;

comment on function public.create_club_v3(
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
  'Creates a Simple saving club from an allowlisted catalog product. Writes club, owner membership, StrategyVersion 1 with one 10000-bps allocation, ContributionPolicyVersion 1, and an optional private Flexible commitment. Idempotent on (caller, client_creation_id). Does not accept client allocations or investment_target_id.';

-- ---------------------------------------------------------------------------
-- Privileges
-- ---------------------------------------------------------------------------

revoke all on function private.reject_club_investment_mode_mutation()
  from public, anon, authenticated;
revoke all on function private.single_fund_catalog_v1()
  from public, anon, authenticated;
revoke all on function private.club_creation_fingerprint_v1(
  text,
  public.club_investment_mode,
  uuid,
  public.governance_threshold_kind,
  public.contribution_policy_mode,
  bigint,
  bigint,
  text
) from public, anon, authenticated;
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

revoke all on function public.single_fund_catalog_v1() from public, anon;
grant execute on function public.single_fund_catalog_v1() to authenticated;

revoke all on function public.create_club_v3(
  text,
  public.club_investment_mode,
  uuid,
  public.governance_threshold_kind,
  public.contribution_policy_mode,
  uuid,
  bigint,
  bigint,
  text
) from public, anon;
grant execute on function public.create_club_v3(
  text,
  public.club_investment_mode,
  uuid,
  public.governance_threshold_kind,
  public.contribution_policy_mode,
  uuid,
  bigint,
  bigint,
  text
) to authenticated;
