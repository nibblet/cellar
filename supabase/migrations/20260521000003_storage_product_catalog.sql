-- Public bucket for shared catalog images (hero photos of cigars and bourbons).
-- Distinct from `product-photos`, which is private and member-scoped for
-- tasting shots. Catalog imagery isn't sensitive — anyone with the obscure
-- key can fetch it, and the URL itself is set on products.image_url by the
-- seed enrichment script.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'product-catalog',
  'product-catalog',
  true,
  10 * 1024 * 1024,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do nothing;

-- Public bucket → reads need no policy. Writes happen via service-role only
-- (seed scripts), which bypasses RLS, so no insert policy needed either.
