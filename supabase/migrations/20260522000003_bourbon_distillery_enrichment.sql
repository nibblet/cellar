-- Backfill the `distillery` key in products.specs for the six target
-- distillery families. Only writes where distillery is currently absent
-- so re-runs are safe and won't overwrite hand-curated values.
--
-- Patterns are intentionally broad (ILIKE) to catch alternate spellings
-- and sub-brands. The six target families:
--   1. Buffalo Trace Distillery
--   2. Jim Beam Distillery  (+ Booker Noe Plant)
--   3. Heaven Hill Distillery
--   4. Four Roses Distillery
--   5. Angel's Envy (Louisville Distilling Company)
--   6. Brown-Forman (Woodford Reserve + Old Forester)

-- Guard: only touch rows where distillery is not already set.
-- We use a CTE to avoid re-evaluating the guard per row.

-- 1. Buffalo Trace Distillery
UPDATE public.products
SET specs = specs || '{"distillery":"Buffalo Trace Distillery"}'::jsonb
WHERE type = 'bourbon'
  AND (specs->>'distillery') IS NULL
  AND (
    brand ILIKE '%buffalo trace%'
    OR brand ILIKE '%eagle rare%'
    OR brand ILIKE '%blanton%'
    OR brand ILIKE '%w.l. weller%'
    OR brand ILIKE '%weller%'
    OR brand ILIKE '%e.h. taylor%'
    OR brand ILIKE '%e. h. taylor%'
    OR brand ILIKE '%george t. stagg%'
    OR brand ILIKE '%stagg jr%'
    OR brand ILIKE '%benchmark%'
    OR brand ILIKE '%colonel e.h. taylor%'
  );

-- 2. Jim Beam Distillery
UPDATE public.products
SET specs = specs || '{"distillery":"Jim Beam Distillery"}'::jsonb
WHERE type = 'bourbon'
  AND (specs->>'distillery') IS NULL
  AND (
    brand ILIKE '%jim beam%'
    OR brand ILIKE '%knob creek%'
    OR brand ILIKE '%basil hayden%'
    OR brand ILIKE '%booker%'
    OR brand ILIKE '%baker%27s%'
    OR brand ILIKE '%baker''s%'
    OR brand ILIKE '%old grand-dad%'
    OR brand ILIKE '%old granddad%'
    OR brand ILIKE '%old crow%'
    OR brand ILIKE '%little book%'
  );

-- 2b. Maker's Mark Distillery (Beam Suntory family but distinct distillery)
UPDATE public.products
SET specs = specs || '{"distillery":"Maker''s Mark Distillery"}'::jsonb
WHERE type = 'bourbon'
  AND (specs->>'distillery') IS NULL
  AND brand ILIKE '%maker%s mark%';

-- 3. Heaven Hill Distillery
UPDATE public.products
SET specs = specs || '{"distillery":"Heaven Hill Distillery"}'::jsonb
WHERE type = 'bourbon'
  AND (specs->>'distillery') IS NULL
  AND (
    brand ILIKE '%heaven hill%'
    OR brand ILIKE '%elijah craig%'
    OR brand ILIKE '%evan williams%'
    OR brand ILIKE '%larceny%'
    OR brand ILIKE '%rittenhouse%'
    OR brand ILIKE '%old fitzgerald%'
    OR brand ILIKE '%henry mckenna%'
    OR brand ILIKE '%mellow corn%'
    OR brand ILIKE '%pikesville%'
    OR brand ILIKE '%bernheim%'
  );

-- 4. Four Roses Distillery
UPDATE public.products
SET specs = specs || '{"distillery":"Four Roses Distillery"}'::jsonb
WHERE type = 'bourbon'
  AND (specs->>'distillery') IS NULL
  AND brand ILIKE '%four roses%';

-- 5. Angel's Envy (Louisville Distilling Company)
UPDATE public.products
SET specs = specs || '{"distillery":"Louisville Distilling Company"}'::jsonb
WHERE type = 'bourbon'
  AND (specs->>'distillery') IS NULL
  AND brand ILIKE '%angel%s envy%';

-- 6. Brown-Forman — Woodford Reserve Distillery
UPDATE public.products
SET specs = specs || '{"distillery":"Woodford Reserve Distillery"}'::jsonb
WHERE type = 'bourbon'
  AND (specs->>'distillery') IS NULL
  AND brand ILIKE '%woodford reserve%';

-- 6b. Brown-Forman — Early Times / Old Forester / Gentleman Jack / Jack Daniel's
UPDATE public.products
SET specs = specs || '{"distillery":"Brown-Forman Distillery"}'::jsonb
WHERE type = 'bourbon'
  AND (specs->>'distillery') IS NULL
  AND (
    brand ILIKE '%old forester%'
    OR brand ILIKE '%early times%'
    OR brand ILIKE '%gentleman jack%'
    OR brand ILIKE '%jack daniel%'
    OR brand ILIKE '%sinatra%'   -- Jack Daniel's Frank Sinatra Select
  );
