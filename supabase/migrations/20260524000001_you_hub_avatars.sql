-- WS4: avatar uploads for the /you hub.
-- Stores the storage object path (NOT a signed URL). Render layer signs on demand.

alter table public.users
  add column if not exists avatar_url text;

-- Storage bucket. Private; signed-URL access only.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'avatars',
  'avatars',
  false,
  4 * 1024 * 1024,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do nothing;

-- Path convention: <auth.uid>/<filename>. The first folder segment must
-- equal the uploader's uid — same pattern as product-photos.

create policy "members upload own avatar"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "members update own avatar"
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "members delete own avatar"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- All members can read any avatar (we render avatars in MemberTag etc.).
create policy "members read any avatar"
  on storage.objects for select
  to authenticated
  using (bucket_id = 'avatars');
