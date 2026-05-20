-- Phase 2: storage bucket for product photos (cigar bands, bourbon labels).
-- Original photos always preserved at full color; sepia is applied client-side.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'product-photos',
  'product-photos',
  false,
  10 * 1024 * 1024,             -- 10 MB cap per upload
  array['image/jpeg', 'image/png', 'image/webp', 'image/heic']
)
on conflict (id) do nothing;

-- Members can upload to their own folder (path prefix: {auth.uid}/).
create policy "members upload to own folder"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'product-photos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- Members can read any product photo (the catalog is shared).
create policy "members read any product photo"
  on storage.objects for select
  to authenticated
  using (bucket_id = 'product-photos');

-- Members can delete their own uploads (e.g., to redo a misidentified shot).
create policy "members delete own uploads"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'product-photos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
