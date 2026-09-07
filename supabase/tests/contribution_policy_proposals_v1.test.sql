begin;

create extension if not exists pgtap with schema extensions;

create schema if not exists tests;
grant usage on schema tests to authenticated;

create function tests.authenticate_as(p_user_id uuid)
returns void
language plpgsql
volatile
security invoker
set search_path = ''
as $function$
begin
  perform pg_catalog.set_config(
    'request.jwt.claim.sub',
    p_user_id::text,
    true
  );
  perform pg_catalog.set_config(
    'request.jwt.claims',
    pg_catalog.json_build_object(
      'sub', p_user_id,
      'role', 'authenticated'
    )::text,
    true
  );
end;
$function$;

create function tests.statement_sqlstate(p_statement text)
returns text
language plpgsql
volatile
security invoker
set search_path = ''
as $function$
begin
  execute p_statement;
  return null;
exception
  when others then
    return sqlstate;
end;
$function$;

create function tests.statement_message(p_statement text)
returns text
language plpgsql
volatile
security invoker
set search_path = ''
as $function$
begin
  execute p_statement;
  return null;
exception
  when others then
    return sqlerrm;
end;
$function$;

grant execute on function tests.authenticate_as(uuid) to authenticated;
grant execute on function tests.statement_sqlstate(text) to authenticated;
grant execute on function tests.statement_message(text) to authenticated;

select extensions.no_plan();

insert into auth.users (
  id,
  aud,
  role,
  email,
  encrypted_password,
  email_confirmed_at,
  raw_app_meta_data,
  raw_user_meta_data,
  created_at,
  updated_at
)
values
  (
    '73000000-0000-4000-8000-000000000001',
    'authenticated',
    'authenticated',
    'gov-owner@example.test',
    '',
    now(),
    '{}'::jsonb,
    '{}'::jsonb,
    now(),
    now()
  ),
  (
    '73000000-0000-4000-8000-000000000002',
    'authenticated',
    'authenticated',
    'gov-member@example.test',
    '',
    now(),
    '{}'::jsonb,
    '{}'::jsonb,
    now(),
    now()
  ),
  (
    '73000000-0000-4000-8000-000000000003',
    'authenticated',
    'authenticated',
    'gov-late@example.test',
    '',
    now(),
    '{}'::jsonb,
    '{}'::jsonb,
    now(),
    now()
  ),
  (
    '73000000-0000-4000-8000-000000000004',
    'authenticated',
    'authenticated',
    'gov-leaver@example.test',
    '',
    now(),
    '{}'::jsonb,
    '{}'::jsonb,
    now(),
    now()
  ),
  (
    '73000000-0000-4000-8000-000000000005',
    'authenticated',
    'authenticated',
    'gov-outsider@example.test',
    '',
    now(),
    '{}'::jsonb,
    '{}'::jsonb,
    now(),
    now()
  );

insert into public.profiles (id, display_name)
values
  ('73000000-0000-4000-8000-000000000001', 'Gov Owner'),
  ('73000000-0000-4000-8000-000000000002', 'Gov Member'),
  ('73000000-0000-4000-8000-000000000003', 'Gov Late'),
  ('73000000-0000-4000-8000-000000000004', 'Gov Leaver'),
  ('73000000-0000-4000-8000-000000000005', 'Gov Outsider');

set local role authenticated;
select tests.authenticate_as('73000000-0000-4000-8000-000000000001');

create temporary table equal_club as
select *
from public.create_club_v2(
  'Governance Equal Club',
  'simple_majority',
  'world_mix',
  'equal',
  200000,
  null,
  'NOK'
);

create temporary table equal_policy_v1 as
select *
from public.club_contribution_policy_v1((select club_id from equal_club));

create temporary table equal_invite as
select *
from public.create_club_invitation((select club_id from equal_club));

select tests.authenticate_as('73000000-0000-4000-8000-000000000002');

create temporary table equal_member as
select *
from public.accept_club_invitation((select invite_token from equal_invite));

select tests.authenticate_as('73000000-0000-4000-8000-000000000001');

create temporary table leaver_invite as
select *
from public.create_club_invitation((select club_id from equal_club));

select tests.authenticate_as('73000000-0000-4000-8000-000000000004');

create temporary table equal_leaver as
select *
from public.accept_club_invitation((select invite_token from leaver_invite));

select tests.authenticate_as('73000000-0000-4000-8000-000000000001');

create temporary table equal_cycle_a as
select *
from public.ensure_open_investment_day_v1((select club_id from equal_club));

select extensions.is(
  (select expected_amount_minor from equal_cycle_a),
  200000::bigint,
  'Frozen equal cycle A starts at 2,000'
);

select extensions.ok(
  to_regprocedure(
    'public.create_contribution_policy_version_v1(uuid, public.contribution_policy_mode, bigint)'
  ) is null,
  'Public policy-version append RPC stays removed'
);

select extensions.is(
  tests.statement_sqlstate(
    format(
      $statement$
        select private.create_contribution_policy_version_v1(%L::uuid, 'equal'::public.contribution_policy_mode, 350000::bigint, null, null)
      $statement$,
      (select club_id from equal_club)
    )
  ),
  '42501',
  'Owner cannot execute trusted policy-version insert'
);

select tests.authenticate_as('73000000-0000-4000-8000-000000000002');

select extensions.is(
  tests.statement_sqlstate(
    format(
      $statement$
        select private.create_contribution_policy_version_v1(%L::uuid, 'equal'::public.contribution_policy_mode, 350000::bigint, null, null)
      $statement$,
      (select club_id from equal_club)
    )
  ),
  '42501',
  'Member cannot execute trusted policy-version insert'
);

select tests.authenticate_as('73000000-0000-4000-8000-000000000001');

select extensions.is(
  tests.statement_message(
    format(
      $statement$
        select public.create_contribution_policy_proposal_v1(
          %L::uuid,
          %L::uuid,
          'equal',
          null
        )
      $statement$,
      (select club_id from equal_club),
      (select policy_version_id from equal_policy_v1)
    )
  ),
  'vesty.contribution_proposal_invalid',
  'Equal proposal requires a positive amount'
);

select extensions.is(
  tests.statement_message(
    format(
      $statement$
        select public.create_contribution_policy_proposal_v1(
          %L::uuid,
          %L::uuid,
          'flexible',
          300000
        )
      $statement$,
      (select club_id from equal_club),
      (select policy_version_id from equal_policy_v1)
    )
  ),
  'vesty.contribution_proposal_invalid',
  'Flexible proposal forbids a shared amount'
);

select extensions.is(
  tests.statement_message(
    format(
      $statement$
        select public.create_contribution_policy_proposal_v1(
          %L::uuid,
          %L::uuid,
          'equal',
          200000
        )
      $statement$,
      (select club_id from equal_club),
      (select policy_version_id from equal_policy_v1)
    )
  ),
  'vesty.contribution_proposal_invalid',
  'Equal to Equal same amount is rejected'
);

select tests.authenticate_as('73000000-0000-4000-8000-000000000005');

create temporary table other_club as
select *
from public.create_club_v2(
  'Other Governance Club',
  'simple_majority',
  'world_mix',
  'equal',
  150000,
  null,
  'NOK'
);

select extensions.is(
  tests.statement_message(
    format(
      $statement$
        select public.create_contribution_policy_proposal_v1(
          %L::uuid,
          %L::uuid,
          'equal',
          300000
        )
      $statement$,
      (select club_id from other_club),
      (select policy_version_id from equal_policy_v1)
    )
  ),
  'vesty.contribution_proposal_invalid',
  'Cross-club base policy is rejected'
);

select tests.authenticate_as('73000000-0000-4000-8000-000000000002');

create temporary table raise_draft as
select *
from public.create_contribution_policy_proposal_v1(
  (select club_id from equal_club),
  (select policy_version_id from equal_policy_v1),
  'equal',
  300000
);

select extensions.is(
  (select status::text from raise_draft),
  'draft',
  'Any active member can create a contribution proposal draft'
);

select extensions.is(
  (
    select count(*)
    from public.contribution_policy_versions
    where club_id = (select club_id from equal_club)
  ),
  1::bigint,
  'Draft proposal does not create a policy version'
);

select *
from public.open_contribution_policy_proposal_v1((select proposal_id from raise_draft));

select extensions.is(
  (
    select count(*)
    from public.contribution_policy_versions
    where club_id = (select club_id from equal_club)
  ),
  1::bigint,
  'Open proposal does not create a policy version'
);

select extensions.is(
  (
    select count(*)
    from public.proposal_electorate_members
    where proposal_id = (select proposal_id from raise_draft)
  ),
  3::bigint,
  'Opening freezes current active memberships as the electorate'
);

select tests.authenticate_as('73000000-0000-4000-8000-000000000001');

create temporary table late_invite as
select *
from public.create_club_invitation((select club_id from equal_club));

select tests.authenticate_as('73000000-0000-4000-8000-000000000003');

create temporary table late_join as
select *
from public.accept_club_invitation((select invite_token from late_invite));

select extensions.is(
  tests.statement_sqlstate(
    format(
      $statement$
        insert into public.votes (proposal_id, membership_id, choice)
        values (%L::uuid, %L::uuid, 'yes')
      $statement$,
      (select proposal_id from raise_draft),
      (select membership_id from late_join)
    )
  ),
  '42501',
  'Members who join after opening cannot vote'
);

select tests.authenticate_as('73000000-0000-4000-8000-000000000001');

insert into public.votes (proposal_id, membership_id, choice)
values (
  (select proposal_id from raise_draft),
  (select membership_id from equal_club),
  'yes'
);

select tests.authenticate_as('73000000-0000-4000-8000-000000000002');

select extensions.is(
  (
    select count(*)
    from public.votes
    where proposal_id = (select proposal_id from raise_draft)
  ),
  0::bigint,
  'Open contribution votes stay hidden'
);

insert into public.votes (proposal_id, membership_id, choice)
values (
  (select proposal_id from raise_draft),
  (select membership_id from equal_member),
  'yes'
);

create temporary table raise_result as
select *
from public.finalize_contribution_policy_proposal_v1((select proposal_id from raise_draft));

select extensions.is(
  (select status::text from raise_result),
  'approved',
  'Equal to Equal proposal is approved after the threshold'
);

select extensions.is(
  (
    select resolution_reason::text
    from public.contribution_policy_proposals
    where id = (select proposal_id from raise_draft)
  ),
  'vote_approved',
  'Approved Equal to Equal writes vote_approved'
);

select extensions.is(
  (
    select count(*)
    from public.contribution_policy_versions
    where club_id = (select club_id from equal_club)
  ),
  2::bigint,
  'Approved Equal to Equal creates exactly one new policy version'
);

select extensions.is(
  (
    select equal_amount_minor
    from public.contribution_policy_versions
    where club_id = (select club_id from equal_club)
      and version_number = 2
  ),
  300000::bigint,
  'Policy v2 stores Equal 3,000'
);

select extensions.is(
  (
    select source_proposal_id
    from public.contribution_policy_versions
    where club_id = (select club_id from equal_club)
      and version_number = 2
  ),
  (select proposal_id from raise_draft),
  'New policy version points at the approved proposal'
);

select tests.authenticate_as('73000000-0000-4000-8000-000000000001');

select extensions.is(
  (
    select expected_amount_minor
    from public.member_cycle_participations
    where investment_cycle_id = (select cycle_id from equal_cycle_a)
      and membership_id = (select membership_id from equal_club)
  ),
  200000::bigint,
  'Frozen cycle A stays 2,000 after Equal to Equal'
);

create temporary table raise_again as
select *
from public.finalize_contribution_policy_proposal_v1((select proposal_id from raise_draft));

select extensions.is(
  (select policy_version_id from raise_again),
  (select policy_version_id from raise_result),
  'Re-finalizing an approved proposal is idempotent'
);

select extensions.is(
  (
    select count(*)
    from public.contribution_policy_versions
    where club_id = (select club_id from equal_club)
  ),
  2::bigint,
  'Idempotent finalize does not create another policy version'
);

select extensions.is(
  (
    select count(*)
    from public.votes
    where proposal_id = (select proposal_id from raise_draft)
      and choice = 'yes'
  ),
  2::bigint,
  'Terminal contribution votes become readable'
);

select tests.authenticate_as('73000000-0000-4000-8000-000000000005');

select extensions.is(
  tests.statement_message(
    format(
      $statement$
        select public.club_contribution_policy_proposals_v1(%L::uuid)
      $statement$,
      (select club_id from equal_club)
    )
  ),
  'vesty.not_club_member',
  'Cross-club callers cannot read contribution proposals'
);

select tests.authenticate_as('73000000-0000-4000-8000-000000000001');

create temporary table stale_draft as
select *
from public.create_contribution_policy_proposal_v1(
  (select club_id from equal_club),
  (select policy_version_id from equal_policy_v1),
  'flexible',
  null
);

select extensions.is(
  tests.statement_message(
    format(
      $statement$
        select public.open_contribution_policy_proposal_v1(%L::uuid)
      $statement$,
      (select proposal_id from stale_draft)
    )
  ),
  'vesty.contribution_proposal_stale',
  'Opening a proposal against an old base is rejected'
);

select extensions.is(
  (
    select count(*)
    from public.contribution_policy_versions
    where club_id = (select club_id from equal_club)
  ),
  2::bigint,
  'Stale draft open does not create a policy version'
);

reset role;

update public.club_memberships
set status = 'left',
    ended_at = now()
where id = (select membership_id from equal_leaver);

set local role authenticated;
select tests.authenticate_as('73000000-0000-4000-8000-000000000001');

create temporary table equal_policy_v2 as
select *
from public.club_contribution_policy_v1((select club_id from equal_club));

create temporary table flex_draft as
select *
from public.create_contribution_policy_proposal_v1(
  (select club_id from equal_club),
  (select policy_version_id from equal_policy_v2),
  'flexible',
  null
);

select *
from public.open_contribution_policy_proposal_v1((select proposal_id from flex_draft));

reset role;

create temporary table competing_policy as
select *
from private.create_contribution_policy_version_v1(
  (select club_id from equal_club),
  'equal',
  400000
);

grant select on competing_policy to authenticated;

set local role authenticated;
select tests.authenticate_as('73000000-0000-4000-8000-000000000001');

insert into public.votes (proposal_id, membership_id, choice)
values (
  (select proposal_id from flex_draft),
  (select membership_id from equal_club),
  'yes'
);

select tests.authenticate_as('73000000-0000-4000-8000-000000000002');

insert into public.votes (proposal_id, membership_id, choice)
values (
  (select proposal_id from flex_draft),
  (select membership_id from equal_member),
  'yes'
);

create temporary table stale_apply as
select *
from public.finalize_contribution_policy_proposal_v1((select proposal_id from flex_draft));

select extensions.is(
  (select status::text from stale_apply),
  'rejected',
  'A reached threshold against a stale base closes as rejected'
);

select extensions.is(
  (select policy_version_id from stale_apply),
  null,
  'Stale approval does not create a policy version'
);

select extensions.is(
  (
    select resolution_reason::text
    from public.contribution_policy_proposals
    where id = (select proposal_id from flex_draft)
  ),
  'stale_base',
  'Reached threshold against a stale base writes stale_base'
);

select extensions.is(
  (
    select count(*)
    from public.contribution_policy_versions
    where club_id = (select club_id from equal_club)
  ),
  3::bigint,
  'Only the competing trusted v3 exists after stale apply'
);

select tests.authenticate_as('73000000-0000-4000-8000-000000000001');

create temporary table current_equal as
select *
from public.club_contribution_policy_v1((select club_id from equal_club));

create temporary table flex_pass as
select *
from public.create_contribution_policy_proposal_v1(
  (select club_id from equal_club),
  (select policy_version_id from current_equal),
  'flexible',
  null
);

select *
from public.open_contribution_policy_proposal_v1((select proposal_id from flex_pass));

insert into public.votes (proposal_id, membership_id, choice)
values (
  (select proposal_id from flex_pass),
  (select membership_id from equal_club),
  'yes'
);

select tests.authenticate_as('73000000-0000-4000-8000-000000000002');

insert into public.votes (proposal_id, membership_id, choice)
values (
  (select proposal_id from flex_pass),
  (select membership_id from equal_member),
  'yes'
);

create temporary table flex_result as
select *
from public.finalize_contribution_policy_proposal_v1((select proposal_id from flex_pass));

select extensions.is(
  (select status::text from flex_result),
  'approved',
  'Equal to Flexible proposal is approved'
);

reset role;

select extensions.is(
  (
    select mode::text
    from public.contribution_policy_versions
    where id = (select policy_version_id from flex_result)
  ),
  'flexible',
  'Approved Equal to Flexible writes a Flexible policy version'
);

select extensions.is(
  (
    select amount_minor
    from public.member_contribution_commitment_versions
    where membership_id = (select membership_id from equal_club)
    order by version_number desc
    limit 1
  ),
  400000::bigint,
  'Owner initial Flexible commitment comes from the current Equal amount'
);

select extensions.is(
  (
    select amount_minor
    from public.member_contribution_commitment_versions
    where membership_id = (select membership_id from equal_member)
    order by version_number desc
    limit 1
  ),
  400000::bigint,
  'Active voter receives the Equal amount as a private commitment'
);

select extensions.is(
  (
    select amount_minor
    from public.member_contribution_commitment_versions
    where membership_id = (select membership_id from late_join)
    order by version_number desc
    limit 1
  ),
  400000::bigint,
  'Member who joined after opening still gets an initial commitment if active at activation'
);

select extensions.is(
  (
    select count(*)
    from public.member_contribution_commitment_versions
    where membership_id = (select membership_id from equal_leaver)
  ),
  0::bigint,
  'Left memberships are not given a Flexible commitment'
);

select extensions.is(
  (
    select expected_amount_minor
    from public.member_cycle_participations
    where investment_cycle_id = (select cycle_id from equal_cycle_a)
      and membership_id = (select membership_id from equal_club)
  ),
  200000::bigint,
  'Frozen Equal cycle stays 2,000 after switching to Flexible'
);

set local role authenticated;
select tests.authenticate_as('73000000-0000-4000-8000-000000000002');

select extensions.is(
  (
    select count(*)
    from public.member_contribution_commitment_versions
    where membership_id = (select membership_id from equal_club)
  ),
  0::bigint,
  'Member cannot read the owner private commitment'
);

select extensions.is(
  (
    select base_equal_amount_minor
    from public.club_contribution_policy_proposals_v1((select club_id from equal_club))
    where proposal_id = (select proposal_id from flex_pass)
  ),
  400000::bigint,
  'Read model shows the shared Equal base, not private amounts'
);

select tests.authenticate_as('73000000-0000-4000-8000-000000000001');

select extensions.is(
  (
    select count(*)
    from public.member_contribution_commitment_versions
    where membership_id = (select membership_id from equal_member)
  ),
  0::bigint,
  'Owner cannot read another member private commitment'
);

select *
from public.create_member_contribution_commitment_v1(
  (select club_id from equal_club),
  300000
);

select extensions.is(
  (
    select expected_amount_minor
    from public.member_cycle_participations
    where investment_cycle_id = (select cycle_id from equal_cycle_a)
      and membership_id = (select membership_id from equal_club)
  ),
  200000::bigint,
  'Private Flexible edit does not rewrite the frozen Equal cycle'
);

select tests.authenticate_as('73000000-0000-4000-8000-000000000001');

create temporary table flexible_club as
select *
from public.create_club_v2(
  'Governance Flexible Club',
  'simple_majority',
  'world_mix',
  'flexible',
  null,
  180000,
  'NOK'
);

create temporary table flexible_policy_v1 as
select *
from public.club_contribution_policy_v1((select club_id from flexible_club));

create temporary table flexible_invite as
select *
from public.create_club_invitation((select club_id from flexible_club));

select tests.authenticate_as('73000000-0000-4000-8000-000000000002');

create temporary table flexible_member as
select *
from public.accept_club_invitation((select invite_token from flexible_invite));

select *
from public.create_member_contribution_commitment_v1(
  (select club_id from flexible_club),
  120000
);

select tests.authenticate_as('73000000-0000-4000-8000-000000000001');

create temporary table flexible_cycle as
select *
from public.ensure_open_investment_day_v1((select club_id from flexible_club));

select extensions.is(
  (select expected_amount_minor from flexible_cycle),
  180000::bigint,
  'Frozen Flexible cycle uses the owner private amount'
);

select extensions.is(
  tests.statement_message(
    format(
      $statement$
        select public.create_contribution_policy_proposal_v1(
          %L::uuid,
          %L::uuid,
          'flexible',
          null
        )
      $statement$,
      (select club_id from flexible_club),
      (select policy_version_id from flexible_policy_v1)
    )
  ),
  'vesty.contribution_proposal_invalid',
  'Flexible to Flexible is rejected'
);

create temporary table to_equal_draft as
select *
from public.create_contribution_policy_proposal_v1(
  (select club_id from flexible_club),
  (select policy_version_id from flexible_policy_v1),
  'equal',
  250000
);

select *
from public.open_contribution_policy_proposal_v1((select proposal_id from to_equal_draft));

insert into public.votes (proposal_id, membership_id, choice)
values (
  (select proposal_id from to_equal_draft),
  (select membership_id from flexible_club),
  'yes'
);

select tests.authenticate_as('73000000-0000-4000-8000-000000000002');

insert into public.votes (proposal_id, membership_id, choice)
values (
  (select proposal_id from to_equal_draft),
  (select membership_id from flexible_member),
  'yes'
);

create temporary table to_equal_result as
select *
from public.finalize_contribution_policy_proposal_v1((select proposal_id from to_equal_draft));

select extensions.is(
  (select status::text from to_equal_result),
  'approved',
  'Flexible to Equal proposal is approved'
);

reset role;

select extensions.is(
  (
    select mode::text
    from public.contribution_policy_versions
    where id = (select policy_version_id from to_equal_result)
  ),
  'equal',
  'Flexible to Equal writes an Equal policy version'
);

select extensions.is(
  (
    select equal_amount_minor
    from public.contribution_policy_versions
    where id = (select policy_version_id from to_equal_result)
  ),
  250000::bigint,
  'Flexible to Equal stores the proposed shared amount'
);

select extensions.is(
  (
    select amount_minor
    from public.member_contribution_commitment_versions
    where membership_id = (select membership_id from flexible_club)
      and version_number = 1
  ),
  180000::bigint,
  'Old private Flexible commitments are retained after switching to Equal'
);

select extensions.is(
  (
    select expected_amount_minor
    from public.member_cycle_participations
    where investment_cycle_id = (select cycle_id from flexible_cycle)
      and membership_id = (select membership_id from flexible_club)
  ),
  180000::bigint,
  'Frozen Flexible cycle keeps original private amounts'
);

set local role authenticated;
select tests.authenticate_as('73000000-0000-4000-8000-000000000002');

select extensions.is(
  (
    select base_equal_amount_minor
    from public.club_contribution_policy_proposals_v1((select club_id from flexible_club))
    where proposal_id = (select proposal_id from to_equal_draft)
  ),
  null,
  'Flexible to Equal read model does not expose private current amounts'
);

select tests.authenticate_as('73000000-0000-4000-8000-000000000001');

reset role;

update public.investment_cycles
set status = 'completed',
    closed_at = now(),
    occurrence_key = occurrence_key || '-done'
where id = (select cycle_id from flexible_cycle);

set local role authenticated;
select tests.authenticate_as('73000000-0000-4000-8000-000000000001');

create temporary table equal_after_flex as
select *
from public.ensure_open_investment_day_v1((select club_id from flexible_club));

select extensions.is(
  (select expected_amount_minor from equal_after_flex),
  250000::bigint,
  'Next cycle after Flexible to Equal uses the shared amount'
);

create temporary table latest_equal as
select *
from public.club_contribution_policy_v1((select club_id from flexible_club));

create temporary table back_to_flex as
select *
from public.create_contribution_policy_proposal_v1(
  (select club_id from flexible_club),
  (select policy_version_id from latest_equal),
  'flexible',
  null
);

select *
from public.open_contribution_policy_proposal_v1((select proposal_id from back_to_flex));

insert into public.votes (proposal_id, membership_id, choice)
values (
  (select proposal_id from back_to_flex),
  (select membership_id from flexible_club),
  'yes'
);

select tests.authenticate_as('73000000-0000-4000-8000-000000000002');

insert into public.votes (proposal_id, membership_id, choice)
values (
  (select proposal_id from back_to_flex),
  (select membership_id from flexible_member),
  'yes'
);

create temporary table back_to_flex_result as
select *
from public.finalize_contribution_policy_proposal_v1((select proposal_id from back_to_flex));

select extensions.is(
  (select status::text from back_to_flex_result),
  'approved',
  'Equal to Flexible after a Flexible history is approved'
);

reset role;

select extensions.is(
  (
    select amount_minor
    from public.member_contribution_commitment_versions
    where membership_id = (select membership_id from flexible_club)
    order by version_number desc
    limit 1
  ),
  250000::bigint,
  'Returning to Flexible initializes from the current Equal amount, not old Flexible history'
);

select extensions.is(
  (
    select amount_minor
    from public.member_contribution_commitment_versions
    where membership_id = (select membership_id from flexible_member)
    order by version_number desc
    limit 1
  ),
  250000::bigint,
  'Other active members also initialize from the current Equal amount'
);

select extensions.is(
  (
    select amount_minor
    from public.member_contribution_commitment_versions
    where membership_id = (select membership_id from flexible_club)
      and version_number = 1
  ),
  180000::bigint,
  'Historical Flexible amounts remain stored and unused'
);

select extensions.is(
  (
    select expected_amount_minor
    from public.member_cycle_participations
    where investment_cycle_id = (select cycle_id from equal_after_flex)
      and membership_id = (select membership_id from flexible_club)
  ),
  250000::bigint,
  'Already-open Equal cycle stays on the Equal amount after returning to Flexible'
);

set local role authenticated;
select tests.authenticate_as('73000000-0000-4000-8000-000000000005');

select extensions.is(
  tests.statement_message(
    format(
      $statement$
        select public.create_contribution_policy_proposal_v1(
          %L::uuid,
          %L::uuid,
          'equal',
          300000
        )
      $statement$,
      (select club_id from flexible_club),
      (select policy_version_id from latest_equal)
    )
  ),
  'vesty.not_club_member',
  'Outsiders cannot propose on another club'
);

select tests.authenticate_as('73000000-0000-4000-8000-000000000005');

create temporary table other_policy as
select *
from public.club_contribution_policy_v1((select club_id from other_club));

create temporary table cancel_draft as
select *
from public.create_contribution_policy_proposal_v1(
  (select club_id from other_club),
  (select policy_version_id from other_policy),
  'equal',
  180000
);

select *
from public.cancel_contribution_policy_proposal_v1((select proposal_id from cancel_draft));

select extensions.is(
  (
    select status::text
    from public.contribution_policy_proposals
    where id = (select proposal_id from cancel_draft)
  ),
  'cancelled',
  'Cancelled draft keeps cancelled status'
);

select extensions.is(
  (
    select resolution_reason::text
    from public.contribution_policy_proposals
    where id = (select proposal_id from cancel_draft)
  ),
  'cancelled',
  'Cancelled draft writes cancelled resolution_reason'
);

create temporary table reject_draft as
select *
from public.create_contribution_policy_proposal_v1(
  (select club_id from other_club),
  (select policy_version_id from other_policy),
  'equal',
  190000
);

select *
from public.open_contribution_policy_proposal_v1((select proposal_id from reject_draft));

insert into public.votes (proposal_id, membership_id, choice)
values (
  (select proposal_id from reject_draft),
  (select membership_id from other_club),
  'no'
);

create temporary table reject_result as
select *
from public.finalize_contribution_policy_proposal_v1((select proposal_id from reject_draft));

select extensions.is(
  (select status::text from reject_result),
  'rejected',
  'A failed vote closes as rejected'
);

select extensions.is(
  (
    select resolution_reason::text
    from public.contribution_policy_proposals
    where id = (select proposal_id from reject_draft)
  ),
  'vote_rejected',
  'A failed vote writes vote_rejected, not stale_base'
);

select extensions.is(
  (select policy_version_id from reject_result),
  null,
  'A failed vote does not create a policy version'
);

create temporary table expire_draft as
select *
from public.create_contribution_policy_proposal_v1(
  (select club_id from other_club),
  (select policy_version_id from other_policy),
  'equal',
  210000
);

select *
from public.open_contribution_policy_proposal_v1((select proposal_id from expire_draft));

reset role;

update public.contribution_policy_proposals
set opened_at = now() - interval '8 days',
    deadline_at = now() - interval '1 minute'
where id = (select proposal_id from expire_draft);

set local role authenticated;
select tests.authenticate_as('73000000-0000-4000-8000-000000000005');

create temporary table expire_result as
select *
from public.finalize_contribution_policy_proposal_v1((select proposal_id from expire_draft));

select extensions.is(
  (select status::text from expire_result),
  'expired',
  'A lapsed deadline closes as expired'
);

select extensions.is(
  (
    select resolution_reason::text
    from public.contribution_policy_proposals
    where id = (select proposal_id from expire_draft)
  ),
  'expired',
  'A lapsed deadline writes expired resolution_reason'
);

select extensions.isnt(
  (
    select resolution_reason::text
    from public.contribution_policy_proposals
    where id = (select proposal_id from expire_draft)
  ),
  (
    select resolution_reason::text
    from public.contribution_policy_proposals
    where id = (select proposal_id from cancel_draft)
  ),
  'Expired and cancelled stay distinguishable'
);

select extensions.is(
  (
    select resolution_reason
    from public.club_contribution_policy_proposals_v1((select club_id from other_club))
    where proposal_id = (select proposal_id from reject_draft)
  )::text,
  'vote_rejected',
  'Read model exposes vote_rejected without client tally math'
);

select * from extensions.finish();

rollback;
