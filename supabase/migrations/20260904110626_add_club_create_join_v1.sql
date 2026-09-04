-- Create / Join Club V1: curated genesis targets, shareable invitation
-- tokens, and narrow trusted write paths. Direct client writes to clubs,
-- memberships, invitations, and strategy tables remain blocked.

create extension if not exists pgcrypto with schema extensions;

-- ---------------------------------------------------------------------------
-- Club name length (aligns client validation with the schema)
-- ---------------------------------------------------------------------------

alter table public.clubs
  drop constraint clubs_name_check;

alter table public.clubs
  add constraint clubs_name_check
  check (
    btrim(name) <> ''
    and char_length(name) <= 80
  );

-- ---------------------------------------------------------------------------
-- Invitation token
--
-- The original invitation row is either profile-bound or email-bound and
-- has no shareable secret. V1 TestFlight join is "possession of a code +
-- authenticated identity". Exposing invitation UUIDs would be guessable
-- if IDs leak, so the secret is a 12-byte random token stored only as a
-- SHA-256 hash.
--
-- Token-only invitations leave invitee_profile_id and invitee_email null.
-- Email- or profile-bound invitations may also carry a token; acceptance
-- then requires both possession and a matching authenticated identity.
-- ---------------------------------------------------------------------------

alter table public.club_invitations
  add column token_hash bytea;

alter table public.club_invitations
  drop constraint club_invitations_invitee_check;

alter table public.club_invitations
  add constraint club_invitations_invitee_check
  check (
    pg_catalog.num_nonnulls(invitee_profile_id, invitee_email) <= 1
    and pg_catalog.num_nonnulls(invitee_profile_id, invitee_email, token_hash) >= 1
  );

create unique index club_invitations_token_hash_key
  on public.club_invitations (token_hash)
  where token_hash is not null;

-- ---------------------------------------------------------------------------
-- Deterministic V1 genesis catalog (reuse; do not duplicate)
-- ---------------------------------------------------------------------------

insert into public.investment_targets (id, name, kind, status, ticker)
values
  (
    '31000000-0000-4000-8000-000000000001',
    'Global Index',
    'etf',
    'active',
    'GLOBAL'
  ),
  (
    '31000000-0000-4000-8000-000000000002',
    'Technology',
    'etf',
    'active',
    'TECH'
  ),
  (
    '31000000-0000-4000-8000-000000000003',
    'Norway',
    'etf',
    'active',
    'NORWAY'
  ),
  (
    '31000000-0000-4000-8000-000000000004',
    'Emerging Markets',
    'etf',
    'active',
    'EM'
  );

-- ---------------------------------------------------------------------------
-- Private helpers
-- ---------------------------------------------------------------------------

create function private.normalize_invite_token(p_token text)
returns text
language plpgsql
immutable
security invoker
set search_path = ''
as $function$
declare
  v_normalized text;
begin
  if p_token is null then
    return null;
  end if;

  v_normalized := pg_catalog.lower(
    pg_catalog.regexp_replace(pg_catalog.btrim(p_token), '[^0-9a-fA-F]', '', 'g')
  );

  if pg_catalog.char_length(v_normalized) <> 24 then
    return null;
  end if;

  return v_normalized;
end;
$function$;

create function private.hash_invite_token(p_normalized_token text)
returns bytea
language sql
immutable
security invoker
set search_path = ''
as $function$
  select extensions.digest(
    pg_catalog.convert_to(p_normalized_token, 'UTF8'),
    'sha256'
  );
$function$;

create function private.require_authenticated_profile_id()
returns uuid
language plpgsql
stable
security definer
set search_path = ''
as $function$
declare
  v_user_id uuid;
begin
  v_user_id := (select auth.uid());

  if v_user_id is null then
    raise exception using
      errcode = 'P0001',
      message = 'vesty.unauthenticated';
  end if;

  if not exists (
    select 1
    from public.profiles as profile
    where profile.id = v_user_id
  ) then
    raise exception using
      errcode = 'P0001',
      message = 'vesty.profile_required';
  end if;

  return v_user_id;
end;
$function$;

-- ---------------------------------------------------------------------------
-- create_club
-- ---------------------------------------------------------------------------

create function private.create_club(
  p_name text,
  p_governance_threshold_kind public.governance_threshold_kind,
  p_allocations jsonb,
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
as $function$
declare
  v_user_id uuid;
  v_name text;
  v_currency text;
  v_club_id uuid;
  v_membership_id uuid;
  v_strategy_id uuid;
  v_sum integer := 0;
  v_elem jsonb;
  v_target_id uuid;
  v_bps integer;
  v_position integer;
  v_seen_targets uuid[] := '{}';
  v_seen_positions integer[] := '{}';
  v_target public.investment_targets%rowtype;
  v_prepared jsonb := '[]'::jsonb;
begin
  v_user_id := private.require_authenticated_profile_id();

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

  if p_allocations is null or pg_catalog.jsonb_typeof(p_allocations) <> 'array' then
    raise exception using
      errcode = 'P0001',
      message = 'vesty.invalid_allocations';
  end if;

  for v_elem in
    select value
    from pg_catalog.jsonb_array_elements(p_allocations) as elements(value)
  loop
    if coalesce(v_elem->>'investment_target_id', '') !~
         '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$'
    then
      raise exception using
        errcode = 'P0001',
        message = 'vesty.invalid_allocations';
    end if;

    if coalesce(v_elem->>'allocation_bps', '') !~ '^[0-9]+$'
      or coalesce(v_elem->>'position', '') !~ '^[0-9]+$'
    then
      raise exception using
        errcode = 'P0001',
        message = 'vesty.invalid_allocations';
    end if;

    v_target_id := (v_elem->>'investment_target_id')::uuid;
    v_bps := (v_elem->>'allocation_bps')::integer;
    v_position := (v_elem->>'position')::integer;

    if v_bps < 1 or v_bps > 10000 or v_position < 1 then
      raise exception using
        errcode = 'P0001',
        message = 'vesty.invalid_allocations';
    end if;

    if v_target_id = any (v_seen_targets) or v_position = any (v_seen_positions) then
      raise exception using
        errcode = 'P0001',
        message = 'vesty.invalid_allocations';
    end if;

    select *
    into v_target
    from public.investment_targets as target
    where target.id = v_target_id;

    if not found or v_target.status <> 'active' then
      raise exception using
        errcode = 'P0001',
        message = 'vesty.invalid_target';
    end if;

    v_seen_targets := pg_catalog.array_append(v_seen_targets, v_target_id);
    v_seen_positions := pg_catalog.array_append(v_seen_positions, v_position);
    v_sum := v_sum + v_bps;
    v_prepared := v_prepared || pg_catalog.jsonb_build_array(
      pg_catalog.jsonb_build_object(
        'investment_target_id', v_target.id,
        'allocation_bps', v_bps,
        'position', v_position,
        'target_name', v_target.name,
        'target_kind', v_target.kind,
        'target_isin', v_target.isin,
        'target_ticker', v_target.ticker,
        'target_exchange', v_target.exchange
      )
    );
  end loop;

  if v_sum <> 10000 then
    raise exception using
      errcode = 'P0001',
      message = 'vesty.invalid_allocation_sum';
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
    current_owner_membership_id
  )
  values (
    v_club_id,
    v_name,
    'active',
    v_currency,
    p_governance_threshold_kind,
    v_membership_id
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
  select
    v_strategy_id,
    (row.value->>'investment_target_id')::uuid,
    (row.value->>'allocation_bps')::smallint,
    (row.value->>'position')::smallint,
    row.value->>'target_name',
    (row.value->>'target_kind')::public.investment_target_kind,
    row.value->>'target_isin',
    row.value->>'target_ticker',
    row.value->>'target_exchange'
  from pg_catalog.jsonb_array_elements(v_prepared) as row(value);

  club_id := v_club_id;
  membership_id := v_membership_id;
  strategy_version_id := v_strategy_id;
  return next;
end;
$function$;

-- ---------------------------------------------------------------------------
-- create_club_invitation (owner only, after StrategyVersion 1)
-- ---------------------------------------------------------------------------

create function private.create_club_invitation(p_club_id uuid)
returns table (
  invitation_id uuid,
  invite_token text,
  expires_at timestamptz,
  club_name text
)
language plpgsql
volatile
security definer
set search_path = ''
as $function$
declare
  v_user_id uuid;
  v_membership_id uuid;
  v_invitation_id uuid;
  v_token text;
  v_expires_at timestamptz;
  v_club_name text;
  v_club_status public.club_status;
begin
  v_user_id := private.require_authenticated_profile_id();

  if p_club_id is null then
    raise exception using
      errcode = 'P0001',
      message = 'vesty.invite_forbidden';
  end if;

  select club.name, club.status, club.current_owner_membership_id
  into v_club_name, v_club_status, v_membership_id
  from public.clubs as club
  where club.id = p_club_id;

  if not found or v_club_status <> 'active' then
    raise exception using
      errcode = 'P0001',
      message = 'vesty.invite_forbidden';
  end if;

  if not exists (
    select 1
    from public.club_memberships as membership
    where membership.id = v_membership_id
      and membership.club_id = p_club_id
      and membership.profile_id = v_user_id
      and membership.status = 'active'
  ) then
    raise exception using
      errcode = 'P0001',
      message = 'vesty.invite_forbidden';
  end if;

  if not exists (
    select 1
    from public.strategy_versions as version
    where version.club_id = p_club_id
      and version.version_number = 1
      and version.origin = 'genesis'
  ) then
    raise exception using
      errcode = 'P0001',
      message = 'vesty.invite_forbidden';
  end if;

  v_token := pg_catalog.encode(extensions.gen_random_bytes(12), 'hex');
  v_invitation_id := pg_catalog.gen_random_uuid();
  v_expires_at := pg_catalog.now() + interval '14 days';

  insert into public.club_invitations (
    id,
    club_id,
    invited_by_membership_id,
    invitee_profile_id,
    invitee_email,
    token_hash,
    status,
    expires_at
  )
  values (
    v_invitation_id,
    p_club_id,
    v_membership_id,
    null,
    null,
    private.hash_invite_token(v_token),
    'pending',
    v_expires_at
  );

  invitation_id := v_invitation_id;
  invite_token := v_token;
  expires_at := v_expires_at;
  club_name := v_club_name;
  return next;
end;
$function$;

-- ---------------------------------------------------------------------------
-- accept_club_invitation
-- ---------------------------------------------------------------------------

create function private.accept_club_invitation(p_token text)
returns table (
  club_id uuid,
  membership_id uuid
)
language plpgsql
volatile
security definer
set search_path = ''
as $function$
declare
  v_user_id uuid;
  v_normalized text;
  v_hash bytea;
  v_invitation public.club_invitations%rowtype;
  v_membership_id uuid;
  v_caller_email text;
  v_email_confirmed_at timestamptz;
begin
  v_user_id := private.require_authenticated_profile_id();

  v_normalized := private.normalize_invite_token(p_token);
  if v_normalized is null then
    raise exception using
      errcode = 'P0001',
      message = 'vesty.invite_invalid';
  end if;

  v_hash := private.hash_invite_token(v_normalized);

  select *
  into v_invitation
  from public.club_invitations as invitation
  where invitation.token_hash = v_hash
  for update;

  if not found then
    raise exception using
      errcode = 'P0001',
      message = 'vesty.invite_invalid';
  end if;

  if v_invitation.status <> 'pending' then
    raise exception using
      errcode = 'P0001',
      message = 'vesty.invite_invalid';
  end if;

  if v_invitation.expires_at <= pg_catalog.now() then
    raise exception using
      errcode = 'P0001',
      message = 'vesty.invite_expired';
  end if;

  if v_invitation.invitee_profile_id is not null
    and v_invitation.invitee_profile_id <> v_user_id
  then
    raise exception using
      errcode = 'P0001',
      message = 'vesty.invite_not_recipient';
  end if;

  if v_invitation.invitee_email is not null then
    select users.email, users.email_confirmed_at
    into v_caller_email, v_email_confirmed_at
    from auth.users as users
    where users.id = v_user_id;

    if v_email_confirmed_at is null
      or v_caller_email is null
      or pg_catalog.lower(pg_catalog.btrim(v_caller_email))
        <> pg_catalog.lower(pg_catalog.btrim(v_invitation.invitee_email))
    then
      raise exception using
        errcode = 'P0001',
        message = 'vesty.invite_not_recipient';
    end if;
  end if;

  if exists (
    select 1
    from public.club_memberships as membership
    where membership.club_id = v_invitation.club_id
      and membership.profile_id = v_user_id
      and membership.status = 'active'
  ) then
    raise exception using
      errcode = 'P0001',
      message = 'vesty.already_member';
  end if;

  if not exists (
    select 1
    from public.clubs as club
    where club.id = v_invitation.club_id
      and club.status = 'active'
  ) then
    raise exception using
      errcode = 'P0001',
      message = 'vesty.invite_invalid';
  end if;

  v_membership_id := pg_catalog.gen_random_uuid();

  insert into public.club_memberships (
    id,
    club_id,
    profile_id,
    status
  )
  values (
    v_membership_id,
    v_invitation.club_id,
    v_user_id,
    'active'
  );

  update public.club_invitations as invitation
  set
    status = 'accepted',
    accepted_membership_id = v_membership_id,
    accepted_at = pg_catalog.now()
  where invitation.id = v_invitation.id
    and invitation.status = 'pending';

  if not found then
    raise exception using
      errcode = 'P0001',
      message = 'vesty.invite_invalid';
  end if;

  club_id := v_invitation.club_id;
  membership_id := v_membership_id;
  return next;
end;
$function$;

-- ---------------------------------------------------------------------------
-- Public invoker wrappers (PostgREST). Implementations stay private.
-- ---------------------------------------------------------------------------

create function public.create_club(
  p_name text,
  p_governance_threshold_kind public.governance_threshold_kind,
  p_allocations jsonb,
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
    p_allocations,
    p_base_currency
  );
$function$;

create function public.create_club_invitation(p_club_id uuid)
returns table (
  invitation_id uuid,
  invite_token text,
  expires_at timestamptz,
  club_name text
)
language sql
volatile
security invoker
set search_path = ''
as $function$
  select *
  from private.create_club_invitation(p_club_id);
$function$;

create function public.accept_club_invitation(p_token text)
returns table (
  club_id uuid,
  membership_id uuid
)
language sql
volatile
security invoker
set search_path = ''
as $function$
  select *
  from private.accept_club_invitation(p_token);
$function$;

revoke all on function private.normalize_invite_token(text) from public, anon, authenticated;
revoke all on function private.hash_invite_token(text) from public, anon, authenticated;
revoke all on function private.require_authenticated_profile_id() from public, anon, authenticated;
revoke all on function private.create_club(text, public.governance_threshold_kind, jsonb, text) from public, anon, authenticated;
revoke all on function private.create_club_invitation(uuid) from public, anon, authenticated;
revoke all on function private.accept_club_invitation(text) from public, anon, authenticated;

grant execute on function private.create_club(text, public.governance_threshold_kind, jsonb, text) to authenticated;
grant execute on function private.create_club_invitation(uuid) to authenticated;
grant execute on function private.accept_club_invitation(text) to authenticated;

revoke all on function public.create_club(text, public.governance_threshold_kind, jsonb, text) from public, anon;
revoke all on function public.create_club_invitation(uuid) from public, anon;
revoke all on function public.accept_club_invitation(text) from public, anon;

grant execute on function public.create_club(text, public.governance_threshold_kind, jsonb, text) to authenticated;
grant execute on function public.create_club_invitation(uuid) to authenticated;
grant execute on function public.accept_club_invitation(text) to authenticated;
