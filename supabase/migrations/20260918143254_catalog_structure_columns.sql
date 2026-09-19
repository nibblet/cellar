-- Catalog structure, part 1 (columns, makers). Applied 2026-09-18 as 20260918143254.
-- Catalog structure pass: products are expressions, releases ride on the bottle, producers are
-- makers, and the typed columns become the only source of truth (the web app is retired).
--
--  * merged_into: a row folded into another. Never deleted, so ids held by phones stay resolvable;
--    the app re-points bottles and copies release_label / proof onto the bottle.
--  * spirit_type / finish / msrp_usd / mash_bill / aliases: promoted out of specs or new.
--  * producer_id → makers, with owner and house mash style on the maker.
--  * expression is the SKU within the family ("12 Year", "Barrel Proof"); null = the flagship.
--  * one row per (family, expression, release_label) among live bourbons, enforced.
--  * a trigger refuses to change typed facts on a verified row unless the write re-stamps it.

------------------------------------------------------------------------------------------------
-- 1. Columns
------------------------------------------------------------------------------------------------
create type cellar.spirit_type as enum ('bourbon', 'rye', 'tennessee', 'american_single_malt', 'wheat_whiskey', 'blend', 'other');

alter table cellar.products
  add column if not exists merged_into uuid references cellar.products(id),
  add column if not exists spirit_type cellar.spirit_type,
  add column if not exists finish text,
  add column if not exists msrp_usd numeric(8,2),
  add column if not exists mash_bill text,
  add column if not exists aliases text[] not null default '{}',
  add column if not exists producer_id uuid references cellar.makers(id);

comment on column cellar.products.merged_into is 'This row was folded into another product. Kept so ids already on devices resolve; clients re-point to the target and carry release_label/proof onto the bottle.';
comment on column cellar.products.spirit_type is 'What is in the bottle. `type` stays bourbon for everything on the whiskey shelf; this says rye / Tennessee / single malt / blend.';
comment on column cellar.products.finish is 'Secondary finish as marketed: Double Oaked, Toasted Barrel, Port, Sherry, Cognac… Distinct from expression.';
comment on column cellar.products.msrp_usd is 'Suggested retail in USD for the standard 750 ml.';
comment on column cellar.products.mash_bill is 'Recipe as disclosed ("75% corn, 13% rye, 12% malted barley"). mash_style is the family.';
comment on column cellar.products.aliases is 'Label abbreviations and nicknames the matcher should accept: ECBP, OWA, Weller SR.';
comment on column cellar.products.release_label is 'Release this row was seeded from (batch, year, pick). On a merged row it is what the bottle inherits. Null for the canonical bottling.';

alter table cellar.makers
  add column if not exists owner text,
  add column if not exists house_mash_style cellar.mash_style,
  add column if not exists dsp text;
comment on column cellar.makers.owner is 'Parent company (Sazerac, Beam Suntory). Null when independent.';
comment on column cellar.makers.house_mash_style is 'Default mash family for this maker''s bourbons when a product does not say otherwise.';

create index if not exists products_merged_into_idx on cellar.products (merged_into) where merged_into is not null;
create index if not exists products_producer_id_idx on cellar.products (producer_id);

------------------------------------------------------------------------------------------------
-- 2. Typed columns from specs (unverified rows only; verified rows already carry app-written values)
------------------------------------------------------------------------------------------------
update cellar.products set
  mash_bill = coalesce(mash_bill, nullif(trim(specs->>'mash_bill'), '')),
  msrp_usd = coalesce(msrp_usd, nullif(specs->>'msrp_usd','')::numeric, nullif(specs->>'price_usd','')::numeric)
where type = 'bourbon' and facts_verified_at is null;
update cellar.products set mash_bill = null where type = 'bourbon' and lower(mash_bill) in ('undisclosed', 'n/a', 'unknown', 'cheated mashbill');

update cellar.products set spirit_type = case
    when mash_style = 'rye' or specs->>'whiskey_type' = 'Rye' or (name ~* '\mrye\M' and name !~* 'high[ -]rye') then 'rye'
    when specs->>'whiskey_type' = 'Tennessee Whiskey' or brand_family in ('Jack Daniel''s', 'George Dickel', 'Uncle Nearest', 'Nelson''s Green Brier') then 'tennessee'
    when specs->>'whiskey_type' = 'Single Malt' or name ~* 'single malt' then 'american_single_malt'
    when specs->>'whiskey_type' in ('Blend', 'Whisky') or name ~* '\mblend' then 'blend'
    when name ~* 'wheat whiskey' then 'wheat_whiskey'
    else 'bourbon' end::cellar.spirit_type
where type = 'bourbon';

update cellar.products set finish = case
    when name ~* 'double double oaked' then 'Double Double Oaked'
    when name ~* 'double oaked' then 'Double Oaked'
    when name ~* 'toasted' then 'Toasted Barrel'
    when name ~* 'port' and name ~* '(barrel|cask|finish)' then 'Port Cask'
    when name ~* 'sherry' then 'Sherry Cask'
    when name ~* 'cognac' then 'Cognac Cask'
    when name ~* 'rum' and name ~* '(cask|finish)' then 'Rum Cask'
    when name ~* 'wine' and name ~* '(cask|finish)' then 'Wine Cask'
    when name ~* 'maple' then 'Maple'
    when name ~* 'honey' then 'Honey'
    when name ~* 'amburana' then 'Amburana'
    else null end
where type = 'bourbon' and finish is null;

------------------------------------------------------------------------------------------------
-- 3. Makers: one row per distillery/brand of record, owner from the parenthetical
------------------------------------------------------------------------------------------------
update cellar.products set producer = null where producer ilike '%printed on label%';
update cellar.products set producer = 'Michter''s' where producer ~ 'Michter';
update cellar.products set producer = 'Peerless' where producer = 'Kentucky Peerless';
update cellar.products set producer = 'Middle West' where producer = 'Middle West Spirits';

insert into cellar.makers (slug, name, type, owner)
select distinct on (slug) slug, distillery, 'bourbon', owner from (
  select regexp_replace(lower(regexp_replace(producer, '\s*\(.*\)\s*$', '')), '[^a-z0-9]+', '-', 'g') as slug,
         regexp_replace(producer, '\s*\(.*\)\s*$', '') as distillery,
         nullif(substring(producer from '\((.*)\)'), '') as owner
  from cellar.products where type = 'bourbon' and producer is not null
) s
on conflict (slug) do update set owner = coalesce(cellar.makers.owner, excluded.owner);

update cellar.products p set producer = regexp_replace(producer, '\s*\(.*\)\s*$', '') where type = 'bourbon' and producer like '%(%';
update cellar.products p set producer_id = m.id
from cellar.makers m where p.type = 'bourbon' and m.slug = regexp_replace(lower(p.producer), '[^a-z0-9]+', '-', 'g');

update cellar.makers set house_mash_style = v.style::cellar.mash_style from (values
  ('buffalo-trace','traditional'), ('heaven-hill','traditional'), ('jim-beam','traditional'), ('brown-forman','traditional'),
  ('wild-turkey','traditional'), ('michter-s','traditional'), ('willett','traditional'), ('barton-1792','high_rye'),
  ('four-roses','high_rye'), ('maker-s-mark','wheated'), ('garrison-brothers','wheated'), ('new-riff','high_rye'),
  ('woodinville','high_rye'), ('castle-key','traditional'), ('lux-row','traditional'), ('uncle-nearest','traditional'),
  ('george-dickel','traditional'), ('yellowstone','traditional'), ('a-smith-bowman','traditional'), ('bulleit','high_rye'),
  ('smooth-ambler','high_rye'), ('redemption','high_rye'), ('old-elk','high_rye'), ('town-branch','traditional'),
  ('peerless','traditional'), ('green-river','traditional'), ('wilderness-trail','wheated'), ('jefferson-s','traditional'),
  ('calumet-farm','traditional'), ('blue-note','traditional'), ('heaven-s-door','traditional'), ('backbone-bourbon','high_rye'),
  ('stellum-spirits','high_rye'), ('four-gate-whiskey-company','traditional'), ('angel-s-envy','traditional'), ('penelope','four_grain')
) v(slug, style) where cellar.makers.slug = v.slug;

