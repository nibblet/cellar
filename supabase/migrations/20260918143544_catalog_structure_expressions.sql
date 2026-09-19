-- Catalog structure, part 2 (expressions, merges, unique index, verified-facts trigger). Applied 2026-09-18 as 20260918143544.

------------------------------------------------------------------------------------------------
-- 4. Expression = SKU within the family; clean the release labels the seed guessed from names
------------------------------------------------------------------------------------------------
update cellar.products set expression = nullif(trim(both ' ,—–-' from
  case when brand_family is not null and lower(name) like lower(brand_family) || '%'
       then substr(name, length(brand_family) + 1) else name end), '')
where type = 'bourbon';

update cellar.products set release_label = null
where type = 'bourbon' and (release_label ~ '^Batch (BOURBON|RYE|KENTUCKY|WHISKEY)' or release_label in ('1910', '1920', '1924'));

update cellar.products set expression = 'Small Batch' where type='bourbon' and brand_family = '1792' and expression = 'Small Batch Bourbon';
update cellar.products set expression = 'Very Small Batch' where type='bourbon' and brand_family = 'Jefferson''s' and expression = 'Very Small Batch Bourbon';
update cellar.products set expression = 'Old Americana Small Batch', release_label = 'Batch 2019-03' where type='bourbon' and brand_family = 'Luca Mariano' and name ~ 'Batch 2019-03';
update cellar.products set expression = null, release_label = '2023-03 ''Mighty Fine Batch''' where type='bourbon' and brand_family = 'Booker''s' and name ~ 'Mighty Fine';
update cellar.products set expression = null, release_label = 'Chapter 7 ''In Retrospect'' (2023)' where type='bourbon' and brand_family = 'Little Book' and name ~ 'Chapter 7';
update cellar.products set expression = 'Wood Finishing Series', release_label = 'The Heart Release (2024)' where type='bourbon' and brand_family = 'Maker''s Mark' and name ~ 'Heart Release';
update cellar.products set expression = '4 Year Old Bottled in Bond', release_label = 'Batch 10' where type='bourbon' and brand_family = 'Leiper''s Fork' and name ~ 'Batch 10';
update cellar.products set expression = 'OYO Double Cask Sherry Cask-Finished, 5 Year', release_label = 'Batch 11' where type='bourbon' and brand_family = 'Middle West' and name ~ 'Batch 11';
update cellar.products set expression = 'Four Grain Straight Bourbon', release_label = 'Batch 001' where type='bourbon' and brand_family = 'Spirit Works' and name ~ 'Batch 001';
update cellar.products set expression = 'Bottled in Bond Bourbon', release_label = 'Batch 1' where type='bourbon' and brand_family = 'Whiskey Acres' and name ~ 'Batch 1\)';
update cellar.products set expression = 'W. L. Weller', release_label = '1982' where type='bourbon' and brand_family = 'Stitzel-Weller' and name ~ '1982';
update cellar.products set expression = 'Founder Release', release_label = '2025' where type='bourbon' and brand_family = 'Trackside' and name ~ 'Founder Release';
update cellar.products set expression = 'Honey Toasted Reserve', release_label = '2026' where type='bourbon' and brand_family = 'Watch Hill Proper' and name ~ '2026';
update cellar.products set brand_family = 'Definitive Series', expression = null, release_label = 'Batch 11' where type='bourbon' and name = 'Definitive Series Batch 11';
update cellar.products set expression = 'Barrel Strength Rye' where type='bourbon' and name = 'Barrel Strength' and brand_family = 'Michter''s';

------------------------------------------------------------------------------------------------
-- 5. Merges. Child keeps its id, points at the parent, and remembers the release the bottle inherits.
------------------------------------------------------------------------------------------------
create or replace function cellar.merge_product(child uuid, parent uuid, release text) returns void
language plpgsql as $$
begin
  if child = parent or parent is null or child is null then return; end if;

  insert into cellar.member_saves (member_id, product_id, have, want, tried, loved, created_at, updated_at)
  select member_id, parent, have, want, tried, loved, created_at, updated_at from cellar.member_saves where product_id = child
  on conflict (member_id, product_id) do update set
    have = cellar.member_saves.have or excluded.have,
    want = (cellar.member_saves.want or excluded.want) and not (cellar.member_saves.have or excluded.have),
    tried = cellar.member_saves.tried or excluded.tried, loved = cellar.member_saves.loved or excluded.loved,
    updated_at = greatest(cellar.member_saves.updated_at, excluded.updated_at);

  update cellar.tastings set product_id = parent, release_label = coalesce(tastings.release_label, release) where product_id = child;
  update cellar.product_reviews set product_id = parent where product_id = child;
  update cellar.product_images set product_id = parent, is_hero = false where product_id = child;
  update cellar.pairing_sessions set bourbon_id = parent where bourbon_id = child;

  -- A verified child outranks an unverified parent.
  update cellar.products p set
    proof = c.proof, age_years = c.age_years, age_label = c.age_label, nas = c.nas, expression_type = c.expression_type,
    mash_style = c.mash_style, bottled_in_bond = c.bottled_in_bond, barrel_proof = c.barrel_proof, rarity = c.rarity,
    facts_verified_at = c.facts_verified_at, facts_verified_by = c.facts_verified_by
  from cellar.products c where p.id = parent and c.id = child and c.facts_verified_at is not null and p.facts_verified_at is null;

  update cellar.products p set image_url = c.image_url from cellar.products c where p.id = parent and c.id = child and p.image_url is null;

  update cellar.products set merged_into = parent, catalog_included = false, release_label = coalesce(release, release_label) where id = child;
end $$;

-- Duplicate seeds: the May 21 row (no family prefix) folds into the May 27 row.
do $$
declare r record;
begin
  for r in
    select min(id::text) filter (where catalog_included) as parent, min(id::text) filter (where not catalog_included) as child
    from cellar.products where type = 'bourbon' and merged_into is null
      and not (brand_family = 'Heaven Hill' and expression = 'Grain to Glass')  -- two real releases; handled below
    group by brand_family, coalesce(expression, ''), coalesce(release_label, '')
    having count(*) = 2 and count(*) filter (where catalog_included) = 1
  loop
    perform cellar.merge_product(r.child::uuid, r.parent::uuid, null);
  end loop;
end $$;

-- Releases folded into their expression.
do $$
declare parent uuid; child uuid;
begin
  select id into parent from cellar.products where type='bourbon' and brand_family = 'Elijah Craig' and expression = 'Barrel Proof' and merged_into is null;
  for child in select id from cellar.products where type='bourbon' and brand_family = 'Elijah Craig' and name ~ 'Batch A125' loop perform cellar.merge_product(child, parent, 'Batch A125'); end loop;
  for child in select id from cellar.products where type='bourbon' and brand_family = 'Elijah Craig' and name ~ 'Private Barrel' loop perform cellar.merge_product(child, parent, 'Private Barrel'); end loop;

  select id into parent from cellar.products where type='bourbon' and brand_family = 'Maker''s Mark' and name = 'Maker''s Mark Private Selection';
  update cellar.products set catalog_included = true where id = parent;
  for child in select id from cellar.products where type='bourbon' and brand_family = 'Maker''s Mark' and name ~ 'Private Selection — 2022 Master Distiller' loop perform cellar.merge_product(child, parent, '2022 Master Distiller'); end loop;
  for child in select id from cellar.products where type='bourbon' and brand_family = 'Maker''s Mark' and name ~ 'Private Selection — 2022 Master of Maturation' loop perform cellar.merge_product(child, parent, '2022 Master of Maturation'); end loop;

  select id into parent from cellar.products where type='bourbon' and brand_family = 'Maker''s Mark' and expression = 'Wood Finishing Series';
  for child in select id from cellar.products where type='bourbon' and brand_family = 'Maker''s Mark' and name ~ '2020 Limited Release' loop perform cellar.merge_product(child, parent, '2020 Limited Release'); end loop;
  for child in select id from cellar.products where type='bourbon' and brand_family = 'Maker''s Mark' and name ~ '2023 Limited Release' loop perform cellar.merge_product(child, parent, '2023 Limited Release'); end loop;

  select id into parent from cellar.products where type='bourbon' and brand_family = 'Leiper''s Fork' and release_label = 'Batch 10';
  for child in select id from cellar.products where type='bourbon' and brand_family = 'Leiper''s Fork' and name ~ 'Batch 14' loop perform cellar.merge_product(child, parent, 'Batch 14'); end loop;

  select id into parent from cellar.products where type='bourbon' and brand_family = 'Michter''s' and expression = '10 Yr' and merged_into is null;
  for child in select id from cellar.products where type='bourbon' and brand_family = 'Michter''s' and name ~ 'Batch 23A0272' loop perform cellar.merge_product(child, parent, 'Batch 23A0272'); end loop;

  select id into parent from cellar.products where type='bourbon' and brand_family = 'Old Forester' and expression = '1924 — 10 Year';
  for child in select id from cellar.products where type='bourbon' and brand_family = 'Old Forester' and expression = '1924' loop perform cellar.merge_product(child, parent, null); end loop;

  select id into parent from cellar.products where type='bourbon' and brand_family = 'Angel''s Envy' and expression = 'Port Barrel Finish' and merged_into is null;
  for child in select id from cellar.products where type='bourbon' and brand_family = 'Angel''s Envy' and name ~ 'Private Selection' loop perform cellar.merge_product(child, parent, 'Private Selection'); end loop;

  select id into parent from cellar.products where type='bourbon' and brand_family = 'Heaven Hill' and expression = 'Grain to Glass' and catalog_included and merged_into is null;
  for child in select id from cellar.products where type='bourbon' and brand_family = 'Heaven Hill' and expression = 'Grain to Glass' and id <> parent and merged_into is null loop perform cellar.merge_product(child, parent, '6 Year, 128 proof'); end loop;
end $$;

update cellar.products set expression = '1924, 10 Year' where type='bourbon' and brand_family = 'Old Forester' and expression = '1924 — 10 Year';

------------------------------------------------------------------------------------------------
-- 6. One live row per (family, expression, release)
------------------------------------------------------------------------------------------------
create unique index products_bourbon_expression_unique
  on cellar.products (coalesce(brand_family, ''), coalesce(expression, ''), coalesce(release_label, ''))
  where type = 'bourbon' and merged_into is null;

------------------------------------------------------------------------------------------------
-- 7. Verified facts can only change with a fresh stamp
------------------------------------------------------------------------------------------------
create or replace function cellar.protect_verified_facts() returns trigger
language plpgsql as $$
begin
  if old.facts_verified_at is not null
     and new.facts_verified_at is not distinct from old.facts_verified_at
     and row(new.proof, new.age_years, new.age_label, new.expression_type, new.mash_style, new.bottled_in_bond,
             new.barrel_proof, new.rarity, new.spirit_type, new.finish, new.mash_bill, new.msrp_usd)
         is distinct from
         row(old.proof, old.age_years, old.age_label, old.expression_type, old.mash_style, old.bottled_in_bond,
             old.barrel_proof, old.rarity, old.spirit_type, old.finish, old.mash_bill, old.msrp_usd)
  then
    raise exception 'product % has verified facts; set facts_verified_at to change them', old.id;
  end if;
  return new;
end $$;

drop trigger if exists products_protect_verified_facts on cellar.products;
create trigger products_protect_verified_facts before update on cellar.products
  for each row execute function cellar.protect_verified_facts();
