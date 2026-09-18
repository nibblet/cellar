-- Mash-style gap pass over the catalog-included bourbons the facts backfill left `unknown`.
-- House recipes where the distillery is known; a plain corn/rye/barley default for sourced
-- brands that don't disclose. Blends and genuinely undisclosed bottlings stay `unknown`.
-- Guarded by facts_verified_at so an in-app edit is never overwritten.

-- Two catalog slips the pass surfaced.
update cellar.products set brand_family = 'Old Fitzgerald'
  where type = 'bourbon' and name ilike '%old fitzgerald%' and brand_family = 'Old Grand-Dad';
update cellar.products set brand_family = 'Michter''s'
  where type = 'bourbon' and brand_family is null
    and coalesce(producer, specs->>'distillery') ilike 'michter%';

with pick as (
  select id,
    case
      when name ilike '%rye%' and (coalesce(producer, specs->>'distillery') ilike 'michter%' or brand_family in ('Willett','Journeyman')) then 'rye'
      when name = 'Barrel Strength' and coalesce(producer, specs->>'distillery') ilike 'michter%' then 'rye'
      when name ilike '%corsets, whips%' then 'rye'
      when brand_family in ('Larceny','Old Fitzgerald','Weller','Maker''s Mark','Garrison Brothers','Rebel','Wilderness Trail') then 'wheated'
      when name ilike '%old fitzgerald%' then 'wheated'
      when name ilike '%dareringer%' then 'wheated'
      when brand_family in ('Four Roses','1792','Backbone Bourbon','Boone County','Woodinville') then 'high_rye'
      when name ilike '%basil hayden%' or name ilike '%heigold%' then 'high_rye'
      when name ilike '%cavehill%' or brand_family = 'Penelope' then 'four_grain'
      when producer in ('Jim Beam','Jim Beam (Beam Suntory)') and name not ilike '%single malt%' then 'traditional'
      when producer = 'Brown-Forman' then 'traditional'
      when producer = 'Heaven Hill' and name not ilike '%grain to glass%' then 'traditional'
      when producer = 'Buffalo Trace' then 'traditional'
      when producer ilike 'wild turkey%' then 'traditional'
      when coalesce(producer, specs->>'distillery') ilike 'michter%' then 'traditional'
      when brand_family in ('Uncle Nearest','Angel''s Envy','I.W. Harper','Town Branch','Old Ezra','Yellowstone') then 'traditional'
      when brand_family in ('Willett','Jefferson''s','Daviess County','Calumet Farm','Blue Note','Heaven''s Door','RD One') then 'traditional'
      else null
    end::cellar.mash_style as style
  from cellar.products
  where type = 'bourbon' and catalog_included and mash_style = 'unknown' and facts_verified_at is null
)
update cellar.products p set mash_style = pick.style
from pick where pick.id = p.id and pick.style is not null;
