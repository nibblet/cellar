-- Admins may add catalog images from the app: a label photo fills a product that has none.
-- Public read already exists (the bucket is public); this only adds insert for cellar admins.
create policy "cellar admins upload catalog images" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'product-catalog'
    and exists (select 1 from cellar.users u where u.id = auth.uid() and u.role = 'admin')
  );
