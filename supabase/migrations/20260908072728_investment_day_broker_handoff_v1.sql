-- Read-only Investment Day broker handoff.
-- Authenticated members in a frozen cycle can fetch a verified Nordnet
-- product page. The function never writes participation, reports, or buys.
-- Does not edit earlier migrations.

-- ---------------------------------------------------------------------------
-- Nordnet product-page allowlist (stricter than catalog source URLs)
-- ---------------------------------------------------------------------------

create function private.is_allowed_nordnet_handoff_url(p_url text)
returns boolean
language sql
immutable
strict
set search_path = ''
as $function$
  select
    p_url ~* '^https://'
    and position('@' in split_part(p_url, '/', 3)) = 0
    and lower(split_part(p_url, '/', 3)) = 'www.nordnet.no';
$function$;

comment on function private.is_allowed_nordnet_handoff_url(text) is
  'Accepts only HTTPS URLs whose host is exactly www.nordnet.no. Rejects HTTP, lookalike hosts, userinfo disguises, and undocumented app schemes.';

revoke all on function private.is_allowed_nordnet_handoff_url(text)
  from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Private implementation
-- ---------------------------------------------------------------------------

create function private.investment_day_broker_handoff_v1(
  p_club_id uuid,
  p_cycle_id uuid,
  p_broker text
)
returns table (
  status text,
  broker text,
  fund_name text,
  isin text,
  product_url text,
  checked_on date
)
language plpgsql
stable
security definer
set search_path = ''
set row_security = off
as $function$
declare
  v_user_id uuid;
  v_membership public.club_memberships%rowtype;
  v_cycle public.investment_cycles%rowtype;
  v_allocation_count integer := 0;
  v_fund_name text;
  v_isin text;
  v_product_url text;
  v_checked_on date;
begin
  v_user_id := private.require_authenticated_profile_id();

  if p_club_id is null or p_cycle_id is null then
    raise exception using
      errcode = 'P0001',
      message = 'vesty.cycle_invalid';
  end if;

  if not exists (
    select 1
    from public.clubs as club
    where club.id = p_club_id
      and club.status = 'active'
  ) then
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

  select *
  into v_cycle
  from public.investment_cycles as cycle
  where cycle.id = p_cycle_id
    and cycle.club_id = p_club_id
    and cycle.status <> 'cancelled';

  if not found then
    raise exception using
      errcode = 'P0001',
      message = 'vesty.cycle_invalid';
  end if;

  if not exists (
    select 1
    from public.member_cycle_participations as participation
    where participation.investment_cycle_id = v_cycle.id
      and participation.membership_id = v_membership.id
      and participation.club_id = p_club_id
  ) then
    raise exception using
      errcode = 'P0001',
      message = 'vesty.not_in_snapshot';
  end if;

  select
    count(*)::integer,
    min(coalesce(product.display_name, allocation.target_name, target.name)),
    min(coalesce(allocation.target_isin, target.isin))
  into v_allocation_count, v_fund_name, v_isin
  from public.strategy_allocations as allocation
  join public.investment_targets as target
    on target.id = allocation.investment_target_id
  left join private.single_fund_products as product
    on product.investment_target_id = allocation.investment_target_id
  where allocation.strategy_version_id = v_cycle.strategy_version_id;

  if
    lower(btrim(coalesce(p_broker, ''))) = 'nordnet'
    and v_allocation_count = 1
  then
    select
      listing.product_url,
      product.checked_on
    into v_product_url, v_checked_on
    from public.strategy_allocations as allocation
    join private.single_fund_products as product
      on product.investment_target_id = allocation.investment_target_id
     and product.status = 'active'
    join private.single_fund_broker_listings as listing
      on listing.product_id = product.id
     and listing.broker = 'nordnet'
     and listing.is_verified
    where allocation.strategy_version_id = v_cycle.strategy_version_id
      and private.is_allowed_nordnet_handoff_url(listing.product_url);
  end if;

  if v_product_url is not null then
    status := 'ready';
    broker := 'nordnet';
    fund_name := v_fund_name;
    isin := v_isin;
    product_url := v_product_url;
    checked_on := v_checked_on;
    return next;
    return;
  end if;

  status := 'unavailable';
  broker := null;
  fund_name := case when v_allocation_count = 1 then v_fund_name else null end;
  isin := case when v_allocation_count = 1 then v_isin else null end;
  product_url := null;
  checked_on := null;
  return next;
end;
$function$;

comment on function private.investment_day_broker_handoff_v1(uuid, uuid, text) is
  'Read-only broker handoff for a frozen Investment Day. Returns a verified Nordnet product page or an unavailable row. Never writes.';

revoke all on function private.investment_day_broker_handoff_v1(uuid, uuid, text)
  from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Public wrapper
-- ---------------------------------------------------------------------------

create function public.investment_day_broker_handoff_v1(
  p_club_id uuid,
  p_cycle_id uuid,
  p_broker text
)
returns table (
  status text,
  broker text,
  fund_name text,
  isin text,
  product_url text,
  checked_on date
)
language sql
stable
security definer
set search_path = ''
set row_security = off
as $function$
  select *
  from private.investment_day_broker_handoff_v1(p_club_id, p_cycle_id, p_broker);
$function$;

comment on function public.investment_day_broker_handoff_v1(uuid, uuid, text) is
  'Authenticated read of a verified Nordnet product page for the caller''s frozen Investment Day. Does not return amounts, catalog ids, or other members. Opening the URL is a client action and writes nothing.';

revoke all on function public.investment_day_broker_handoff_v1(uuid, uuid, text)
  from public, anon;

grant execute on function public.investment_day_broker_handoff_v1(uuid, uuid, text)
  to authenticated;

notify pgrst, 'reload schema';
