-- Normalize distillery short-form strings left by the Paul xlsx import
-- into the canonical long-form names written by the enrichment migration.
-- Both forms existed: e.g. "Buffalo Trace" (101 Cobb rows) + "Buffalo Trace Distillery"
-- (162 enriched rows). Unify to the long form for consistent filtering.
--
-- Only touches the exact short-form strings — will not clobber any row that
-- already has the long form or a more descriptive value.

UPDATE public.products SET specs = jsonb_set(specs, '{distillery}', '"Buffalo Trace Distillery"')
WHERE type = 'bourbon' AND specs->>'distillery' = 'Buffalo Trace';

UPDATE public.products SET specs = jsonb_set(specs, '{distillery}', '"Jim Beam Distillery"')
WHERE type = 'bourbon' AND specs->>'distillery' IN ('Jim Beam', 'James B. Beam Distilling Co.', 'Beam distillery');

UPDATE public.products SET specs = jsonb_set(specs, '{distillery}', '"Heaven Hill Distillery"')
WHERE type = 'bourbon' AND specs->>'distillery' IN ('Heaven Hill', 'Heaven Hill Bardstown Kentucky', 'Heaven Hill/Bernheim Distillery');

UPDATE public.products SET specs = jsonb_set(specs, '{distillery}', '"Four Roses Distillery"')
WHERE type = 'bourbon' AND specs->>'distillery' IN ('Four Roses', '_four Roses Distillery');

UPDATE public.products SET specs = jsonb_set(specs, '{distillery}', '"Maker''s Mark Distillery"')
WHERE type = 'bourbon' AND specs->>'distillery' IN ('Maker''s Mark', 'Maker''s Mark Distillery ');

UPDATE public.products SET specs = jsonb_set(specs, '{distillery}', '"Brown-Forman Distillery"')
WHERE type = 'bourbon' AND specs->>'distillery' IN ('Brown-Forman', 'Brown Forman');
