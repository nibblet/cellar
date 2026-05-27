-- Seed confirmed-missing NCCC staple cigar brands.
-- Audited 2026-05-21: My Father Cigars and Tatuaje were completely absent.
-- Other brands (Padron, Liga Privada, Oliva, Davidoff, Ashton) are already
-- present; only vitola gaps within those brands are added here.
--
-- Idempotent: uses ON CONFLICT DO NOTHING on (type, lower(name), lower(brand)).
-- No trait_vector seeded — will be computed by enrichment or user tastings.
-- status = 'confirmed' since these are well-established, easily-verified brands.
--
-- Vitola selection: the 3–5 most common sizes per line that an NCCC member
-- is likely to buy. Not exhaustive — enrichment fills the rest.

-- Helper: consistent INSERT shape
-- (type, name, brand, status, source, specs)

INSERT INTO public.products (type, name, brand, status, source, specs) VALUES

-- ============================================================
-- MY FATHER CIGARS (Esteli, Nicaragua)
-- ============================================================

('cigar', 'My Father Le Bijou 1922 Torpedo', 'My Father Cigars',
 'confirmed', 'seed',
 '{"vitola":"Torpedo","ring_gauge":54,"length_inches":6.125,"strength":"full","wrapper":"San Andres Mexican","binder":"Nicaraguan","filler":"Nicaraguan","country":"Nicaragua","notes":"Full-bodied, rich construction — arguably their flagship"}'::jsonb),

('cigar', 'My Father Le Bijou 1922 Toro', 'My Father Cigars',
 'confirmed', 'seed',
 '{"vitola":"Toro","ring_gauge":52,"length_inches":6.0,"strength":"full","wrapper":"San Andres Mexican","binder":"Nicaraguan","filler":"Nicaraguan","country":"Nicaragua"}'::jsonb),

('cigar', 'My Father Le Bijou 1922 Robusto', 'My Father Cigars',
 'confirmed', 'seed',
 '{"vitola":"Robusto","ring_gauge":50,"length_inches":5.5,"strength":"full","wrapper":"San Andres Mexican","binder":"Nicaraguan","filler":"Nicaraguan","country":"Nicaragua"}'::jsonb),

('cigar', 'My Father No. 1 Lonsdale', 'My Father Cigars',
 'confirmed', 'seed',
 '{"vitola":"Lonsdale","ring_gauge":44,"length_inches":7.0,"strength":"full","wrapper":"Ecuadorian Habano","binder":"Nicaraguan","filler":"Nicaraguan","country":"Nicaragua","notes":"Elegant, long-format showcase of the Ecuadorian Habano wrapper"}'::jsonb),

('cigar', 'My Father No. 1 Robusto', 'My Father Cigars',
 'confirmed', 'seed',
 '{"vitola":"Robusto","ring_gauge":50,"length_inches":5.5,"strength":"full","wrapper":"Ecuadorian Habano","binder":"Nicaraguan","filler":"Nicaraguan","country":"Nicaragua"}'::jsonb),

('cigar', 'My Father La Promesa Robusto', 'My Father Cigars',
 'confirmed', 'seed',
 '{"vitola":"Robusto","ring_gauge":50,"length_inches":5.5,"strength":"medium-full","wrapper":"Ecuadorian Habano","binder":"Nicaraguan","filler":"Nicaraguan","country":"Nicaragua"}'::jsonb),

('cigar', 'My Father La Promesa Toro', 'My Father Cigars',
 'confirmed', 'seed',
 '{"vitola":"Toro","ring_gauge":52,"length_inches":6.0,"strength":"medium-full","wrapper":"Ecuadorian Habano","binder":"Nicaraguan","filler":"Nicaraguan","country":"Nicaragua"}'::jsonb),

('cigar', 'My Father Flor de Las Antillas Toro', 'My Father Cigars',
 'confirmed', 'seed',
 '{"vitola":"Toro","ring_gauge":54,"length_inches":6.0,"strength":"full","wrapper":"Nicaraguan Natural","binder":"Nicaraguan","filler":"Nicaraguan","country":"Nicaragua","notes":"Cigar Aficionado #1 cigar of the year 2012"}'::jsonb),

('cigar', 'My Father Flor de Las Antillas Robusto', 'My Father Cigars',
 'confirmed', 'seed',
 '{"vitola":"Robusto","ring_gauge":52,"length_inches":5.5,"strength":"full","wrapper":"Nicaraguan Natural","binder":"Nicaraguan","filler":"Nicaraguan","country":"Nicaragua"}'::jsonb),

-- ============================================================
-- TATUAJE (Pete Johnson / My Father factory, Nicaragua)
-- ============================================================

('cigar', 'Tatuaje Black Label Corona Gorda', 'Tatuaje',
 'confirmed', 'seed',
 '{"vitola":"Corona Gorda","ring_gauge":46,"length_inches":5.625,"strength":"full","wrapper":"Ecuadorian Habano","binder":"Nicaraguan","filler":"Nicaraguan","country":"Nicaragua","notes":"Tatuaje''s flagship; made at My Father''s factory in Esteli"}'::jsonb),

('cigar', 'Tatuaje Black Label Robusto', 'Tatuaje',
 'confirmed', 'seed',
 '{"vitola":"Robusto","ring_gauge":50,"length_inches":5.0,"strength":"full","wrapper":"Ecuadorian Habano","binder":"Nicaraguan","filler":"Nicaraguan","country":"Nicaragua"}'::jsonb),

('cigar', 'Tatuaje Black Label Toro', 'Tatuaje',
 'confirmed', 'seed',
 '{"vitola":"Toro","ring_gauge":52,"length_inches":6.0,"strength":"full","wrapper":"Ecuadorian Habano","binder":"Nicaraguan","filler":"Nicaraguan","country":"Nicaragua"}'::jsonb),

('cigar', 'Tatuaje Black Label Torpedo', 'Tatuaje',
 'confirmed', 'seed',
 '{"vitola":"Torpedo","ring_gauge":52,"length_inches":6.125,"strength":"full","wrapper":"Ecuadorian Habano","binder":"Nicaraguan","filler":"Nicaraguan","country":"Nicaragua"}'::jsonb),

('cigar', 'Tatuaje Brown Label Robusto', 'Tatuaje',
 'confirmed', 'seed',
 '{"vitola":"Robusto","ring_gauge":50,"length_inches":5.0,"strength":"full","wrapper":"Nicaraguan Habano","binder":"Nicaraguan","filler":"Nicaraguan","country":"Nicaragua","notes":"Slightly darker, earthier profile than the Black Label"}'::jsonb),

('cigar', 'Tatuaje Brown Label Toro', 'Tatuaje',
 'confirmed', 'seed',
 '{"vitola":"Toro","ring_gauge":52,"length_inches":6.0,"strength":"full","wrapper":"Nicaraguan Habano","binder":"Nicaraguan","filler":"Nicaraguan","country":"Nicaragua"}'::jsonb),

('cigar', 'Tatuaje Havana VI Robusto', 'Tatuaje',
 'confirmed', 'seed',
 '{"vitola":"Robusto","ring_gauge":50,"length_inches":5.125,"strength":"medium-full","wrapper":"Ecuadorian Habano","binder":"Nicaraguan","filler":"Nicaraguan","country":"Nicaragua","notes":"Made in Miami''s Little Havana — old-school Cuban-influenced construction"}'::jsonb),

('cigar', 'Tatuaje Cabaiguan Guapos', 'Tatuaje',
 'confirmed', 'seed',
 '{"vitola":"Petit Robusto","ring_gauge":48,"length_inches":4.5,"strength":"medium-full","wrapper":"Ecuadorian Habano","binder":"Nicaraguan","filler":"Nicaraguan","country":"Nicaragua"}'::jsonb),

('cigar', 'Tatuaje Monster Series', 'Tatuaje',
 'confirmed', 'seed',
 '{"vitola":"Various","strength":"full","wrapper":"Ecuadorian Habano","binder":"Nicaraguan","filler":"Nicaraguan","country":"Nicaragua","notes":"Annual Halloween limited releases — The Frank, The Mummy, Wolfman, etc."}'::jsonb),

-- ============================================================
-- PADRON gaps: 1926 Serie and Family Reserve (1964 already present)
-- ============================================================

('cigar', 'Padron 1926 Serie No. 1 Natural', 'Padron',
 'confirmed', 'seed',
 '{"vitola":"No. 1","ring_gauge":54,"length_inches":6.125,"strength":"full","wrapper":"Nicaraguan Natural","binder":"Nicaraguan","filler":"Nicaraguan","country":"Nicaragua","notes":"Padron''s top-shelf line; aged 5 years minimum"}'::jsonb),

('cigar', 'Padron 1926 Serie No. 35 Natural', 'Padron',
 'confirmed', 'seed',
 '{"vitola":"No. 35","ring_gauge":52,"length_inches":5.0,"strength":"full","wrapper":"Nicaraguan Natural","binder":"Nicaraguan","filler":"Nicaraguan","country":"Nicaragua"}'::jsonb),

('cigar', 'Padron 1926 Serie No. 2 Natural', 'Padron',
 'confirmed', 'seed',
 '{"vitola":"No. 2","ring_gauge":54,"length_inches":5.5,"strength":"full","wrapper":"Nicaraguan Natural","binder":"Nicaraguan","filler":"Nicaraguan","country":"Nicaragua"}'::jsonb),

('cigar', 'Padron Family Reserve No. 45 Natural', 'Padron',
 'confirmed', 'seed',
 '{"vitola":"No. 45","ring_gauge":54,"length_inches":6.0,"strength":"full","wrapper":"Nicaraguan Natural","binder":"Nicaraguan","filler":"Nicaraguan","country":"Nicaragua","notes":"Ultra-premium; limited annual release"}'::jsonb),

('cigar', 'Padron Family Reserve No. 50 Natural', 'Padron',
 'confirmed', 'seed',
 '{"vitola":"No. 50","ring_gauge":54,"length_inches":5.5,"strength":"full","wrapper":"Nicaraguan Natural","binder":"Nicaraguan","filler":"Nicaraguan","country":"Nicaragua"}'::jsonb),

-- ============================================================
-- LIGA PRIVADA: T52 (No. 9 partial coverage — add T52)
-- ============================================================

('cigar', 'Liga Privada T52 Corona Viva', 'Drew Estate',
 'confirmed', 'seed',
 '{"vitola":"Corona Viva","ring_gauge":48,"length_inches":6.0,"strength":"full","wrapper":"Connecticut Broadleaf Habano","binder":"Brazilian Mata Fina","filler":"Nicaraguan, Honduran","country":"Nicaragua","notes":"The T52 uses a twisted cap and a slightly different blend than the No. 9"}'::jsonb),

('cigar', 'Liga Privada T52 Robusto', 'Drew Estate',
 'confirmed', 'seed',
 '{"vitola":"Robusto","ring_gauge":52,"length_inches":5.5,"strength":"full","wrapper":"Connecticut Broadleaf Habano","binder":"Brazilian Mata Fina","filler":"Nicaraguan, Honduran","country":"Nicaragua"}'::jsonb),

('cigar', 'Liga Privada T52 Toro', 'Drew Estate',
 'confirmed', 'seed',
 '{"vitola":"Toro","ring_gauge":52,"length_inches":6.0,"strength":"full","wrapper":"Connecticut Broadleaf Habano","binder":"Brazilian Mata Fina","filler":"Nicaraguan, Honduran","country":"Nicaragua"}'::jsonb),

-- ============================================================
-- MY FATHER / AGING ROOM: Quattro (Aging Room already has rows but no images;
-- add the flagship vitola as a confirmed entry if it somehow fell through)
-- ============================================================

('cigar', 'Aging Room Quattro F55 Concerto', 'Aging Room',
 'confirmed', 'seed',
 '{"vitola":"Toro","ring_gauge":55,"length_inches":6.0,"strength":"medium-full","wrapper":"Ecuadorian Habano","binder":"Dominican","filler":"Dominican, Nicaraguan","country":"Dominican Republic","notes":"CF55 wrapper; blended by Rafael Nodal"}'::jsonb),

('cigar', 'Aging Room Quattro Nicaragua Maestro', 'Aging Room',
 'confirmed', 'seed',
 '{"vitola":"Robusto","ring_gauge":50,"length_inches":5.5,"strength":"full","wrapper":"Nicaraguan Habano","binder":"Nicaraguan","filler":"Nicaraguan","country":"Nicaragua"}'::jsonb)

ON CONFLICT DO NOTHING;
