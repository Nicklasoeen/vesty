-- Profile Onboarding V1: display_name completeness, avatar_path, private avatars bucket.

alter table public.profiles
  add column if not exists avatar_path text;

alter table public.profiles
  drop constraint if exists profiles_display_name_check;

alter table public.profiles
  add constraint profiles_display_name_check
  check (
    display_name is null
    or (
      btrim(display_name) <> ''
      and char_length(display_name) <= 80
    )
  );

alter table public.profiles
  drop constraint if exists profiles_avatar_path_check;

alter table public.profiles
  add constraint profiles_avatar_path_check
  check (avatar_path is null or btrim(avatar_path) <> '');

revoke update on public.profiles from authenticated;
grant update (display_name, avatar_path) on public.profiles to authenticated;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'avatars',
  'avatars',
  false,
  2097152,
  array['image/jpeg']::text[]
)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists avatars_select_authorized on storage.objects;
drop policy if exists avatars_insert_own on storage.objects;
drop policy if exists avatars_update_own on storage.objects;
drop policy if exists avatars_delete_own on storage.objects;

create policy avatars_select_authorized
on storage.objects
for select
to authenticated
using (
  bucket_id = 'avatars'
  and (select private.can_read_profile(((storage.foldername(name))[1])::uuid))
);

create policy avatars_insert_own
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'avatars'
  and name = ((select auth.uid())::text || '/avatar.jpg')
);

create policy avatars_update_own
on storage.objects
for update
to authenticated
using (
  bucket_id = 'avatars'
  and name = ((select auth.uid())::text || '/avatar.jpg')
)
with check (
  bucket_id = 'avatars'
  and name = ((select auth.uid())::text || '/avatar.jpg')
);

create policy avatars_delete_own
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'avatars'
  and name = ((select auth.uid())::text || '/avatar.jpg')
);
