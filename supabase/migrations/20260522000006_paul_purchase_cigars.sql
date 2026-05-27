-- Seed cigars from Paul's recent purchase list (2026-05-22).
-- Diagnostic confirmed gaps:
--   • Drew Estate Nica Rustica: only a generic row existed; 3 wrapper-specific
--     Gordo vitolas are missing (Broadleaf, Shade, Adobe)
--   • Kristoff Ligero Maduro: existing row has vitola = 'Lancero' — incorrect;
--     the purchased stick is a Matador (6.5×52). Fix via UPDATE + add Matador row.
--   • Kristoff Kristania 7x70: completely absent
--   • 12 Angry Men: zero rows
--   • JC Newman (Brick House, Diamond Crown): zero rows
--   • Camacho Ecuador Robusto: already exists, image pending enrichment — skip
--
-- Idempotent: ON CONFLICT DO NOTHING on (type, lower(name), lower(brand)).
-- status = 'confirmed' for established lines; 'seed' source.

-- ============================================================
-- DREW ESTATE — Nica Rustica (wrapper-specific Gordo vitolas)
-- ============================================================
-- The Nica Rustica line uses a proprietary rustic construction.
-- Three wrapper expressions, all Gordo 6×60, all full-strength.

INSERT INTO public.products (type, name, brand, status, source, specs) VALUES

('cigar', 'Drew Estate Nica Rustica Broadleaf Gordo', 'Drew Estate',
 'confirmed', 'seed',
 '{"vitola":"Gordo","ring_gauge":60,"length_inches":6.0,"strength":"full","wrapper":"Connecticut Broadleaf Maduro","binder":"Nicaraguan Habano","filler":"Nicaraguan","country":"Nicaragua","notes":"Dark, oily broadleaf wrapper; earthy, bold, rustic character — Drew Estate flagship line"}'::jsonb),

('cigar', 'Drew Estate Nica Rustica Shade Gordo', 'Drew Estate',
 'confirmed', 'seed',
 '{"vitola":"Gordo","ring_gauge":60,"length_inches":6.0,"strength":"full","wrapper":"Connecticut Shade","binder":"Nicaraguan Habano","filler":"Nicaraguan","country":"Nicaragua","notes":"Lighter shade wrapper on the same Nica Rustica blend; creamier, slightly sweeter profile"}'::jsonb),

('cigar', 'Drew Estate Nica Rustica Adobe Gordo', 'Drew Estate',
 'confirmed', 'seed',
 '{"vitola":"Gordo","ring_gauge":60,"length_inches":6.0,"strength":"full","wrapper":"Sun-Grown Nicaraguan Natural","binder":"Nicaraguan Habano","filler":"Nicaraguan","country":"Nicaragua","notes":"Adobe (natural sun-grown) wrapper; rustic construction, woody and spicy finish"}'::jsonb),

-- ============================================================
-- KRISTOFF
-- ============================================================
-- Kristoff Ligero Maduro: the Matador vitola (6.5×52).
-- An existing row has vitola='Lancero' — that is incorrect; the product Paul
-- purchased is the Matador. We insert the correct row here; a separate UPDATE
-- below fixes the stale Lancero row if it matches that product.

('cigar', 'Kristoff Ligero Maduro Matador', 'Kristoff',
 'confirmed', 'seed',
 '{"vitola":"Matador","ring_gauge":52,"length_inches":6.5,"strength":"full","wrapper":"Ecuadorian Sumatra Maduro","binder":"Nicaraguan","filler":"Nicaraguan, Dominican Ligero","country":"Nicaragua","notes":"Box-pressed Matador; dark oily maduro with pronounced ligero core — one of Kristoff''s fullest expressions"}'::jsonb),

('cigar', 'Kristoff Kristania 7x70', 'Kristoff',
 'confirmed', 'seed',
 '{"vitola":"Giant","ring_gauge":70,"length_inches":7.0,"strength":"full","wrapper":"Connecticut Broadleaf Maduro","binder":"Nicaraguan","filler":"Nicaraguan, Dominican","country":"Nicaragua","notes":"Oversized 7×70 format; long slow burn showcase of the Kristania blend — deep espresso and dark chocolate notes"}'::jsonb),

-- ============================================================
-- 12 ANGRY MEN
-- ============================================================
-- Honduran puro, made at the Plasencia factory.
-- Medium-full to full body; Ecuadorian natural wrapper.
-- Core line: Robusto, Toro, Gordo are the common retail sizes.

('cigar', '12 Angry Men Robusto', '12 Angry Men',
 'confirmed', 'seed',
 '{"vitola":"Robusto","ring_gauge":50,"length_inches":5.0,"strength":"medium-full","wrapper":"Ecuadorian Natural","binder":"Honduran","filler":"Honduran","country":"Honduras","notes":"Value-premium Honduran puro; made at Plasencia — cedar, leather, mild pepper"}'::jsonb),

('cigar', '12 Angry Men Toro', '12 Angry Men',
 'confirmed', 'seed',
 '{"vitola":"Toro","ring_gauge":52,"length_inches":6.0,"strength":"medium-full","wrapper":"Ecuadorian Natural","binder":"Honduran","filler":"Honduran","country":"Honduras"}'::jsonb),

('cigar', '12 Angry Men Gordo', '12 Angry Men',
 'confirmed', 'seed',
 '{"vitola":"Gordo","ring_gauge":60,"length_inches":6.0,"strength":"medium-full","wrapper":"Ecuadorian Natural","binder":"Honduran","filler":"Honduran","country":"Honduras"}'::jsonb),

-- ============================================================
-- JC NEWMAN — Brick House & Diamond Crown
-- ============================================================
-- JC Newman is Tampa's last hand-rolling factory (El Reloj).
-- Brick House: Honduran puro, value flagship, medium-full.
-- Diamond Crown: Dominican long-filler, mild-medium, premium flagship.

('cigar', 'JC Newman Brick House Robusto', 'JC Newman',
 'confirmed', 'seed',
 '{"vitola":"Robusto","ring_gauge":54,"length_inches":5.5,"strength":"medium-full","wrapper":"Honduran Natural","binder":"Honduran","filler":"Honduran","country":"Honduras","notes":"JC Newman''s best-selling line; rich cedar and leather at an everyday price"}'::jsonb),

('cigar', 'JC Newman Brick House Toro', 'JC Newman',
 'confirmed', 'seed',
 '{"vitola":"Toro","ring_gauge":54,"length_inches":6.0,"strength":"medium-full","wrapper":"Honduran Natural","binder":"Honduran","filler":"Honduran","country":"Honduras"}'::jsonb),

('cigar', 'JC Newman Brick House Gordo', 'JC Newman',
 'confirmed', 'seed',
 '{"vitola":"Gordo","ring_gauge":60,"length_inches":6.0,"strength":"medium-full","wrapper":"Honduran Natural","binder":"Honduran","filler":"Honduran","country":"Honduras"}'::jsonb),

('cigar', 'JC Newman Diamond Crown Robusto No. 4', 'JC Newman',
 'confirmed', 'seed',
 '{"vitola":"Robusto No. 4","ring_gauge":51,"length_inches":5.5,"strength":"mild-medium","wrapper":"Dominican Natural","binder":"Dominican","filler":"Dominican","country":"Dominican Republic","notes":"JC Newman''s premium flagship — hand-rolled at El Reloj in Tampa; refined, creamy, classic box-press"}'::jsonb),

('cigar', 'JC Newman Diamond Crown Toro No. 6', 'JC Newman',
 'confirmed', 'seed',
 '{"vitola":"Toro No. 6","ring_gauge":54,"length_inches":6.0,"strength":"mild-medium","wrapper":"Dominican Natural","binder":"Dominican","filler":"Dominican","country":"Dominican Republic"}'::jsonb)

ON CONFLICT DO NOTHING;

-- Fix stale Kristoff Ligero Maduro row that has vitola='Lancero'.
-- Only updates if the name matches and vitola is still the wrong value,
-- so this is safe to re-run.
UPDATE public.products
SET specs = jsonb_set(specs, '{vitola}', '"Matador"')
WHERE type = 'cigar'
  AND brand ILIKE '%kristoff%'
  AND name ILIKE '%ligero maduro%'
  AND specs->>'vitola' = 'Lancero';
