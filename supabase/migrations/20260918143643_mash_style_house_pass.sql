-- Mash style for every bourbon still `unknown`: brand-level recipes first (a wheated brand at a
-- traditional house), then the maker's house style. Blends and undisclosed sourcing stay unknown.
-- Verified rows are untouched (and the trigger would refuse anyway). Applied 2026-09-18.

update cellar.products p set mash_style = v.style::cellar.mash_style
from (values
  ('Weller','wheated'), ('W. L. Weller','wheated'), ('Larceny','wheated'), ('Old Fitzgerald','wheated'), ('Rebel','wheated'),
  ('Maker''s Mark','wheated'), ('Pappy Van Winkle','wheated'), ('Old Rip Van Winkle','wheated'), ('Van Winkle','wheated'),
  ('Wyoming Whiskey','wheated'),
  ('Basil Hayden','high_rye'), ('Old Grand-Dad','high_rye'), ('Bulleit','high_rye'), ('Four Roses','high_rye'), ('1792','high_rye'),
  ('Redemption','high_rye'), ('Smooth Ambler','high_rye'), ('Old Elk','high_rye'), ('Boone County','high_rye'), ('Backbone Bourbon','high_rye'),
  ('Rabbit Hole Heigold','high_rye'), ('Penelope','four_grain'), ('Rabbit Hole Cavehill','four_grain')
) v(family, style)
where p.type = 'bourbon' and p.mash_style = 'unknown' and p.facts_verified_at is null and p.spirit_type = 'bourbon'
  and p.brand_family = v.family;

update cellar.products p set mash_style = m.house_mash_style
from cellar.makers m
where p.producer_id = m.id and m.house_mash_style is not null
  and p.type = 'bourbon' and p.mash_style = 'unknown' and p.facts_verified_at is null and p.spirit_type = 'bourbon';

-- Ryes are ryes whatever the maker's bourbon recipe is.
update cellar.products set mash_style = 'rye'
where type = 'bourbon' and spirit_type = 'rye' and mash_style <> 'rye' and facts_verified_at is null;
