-- Typed bourbon facts: promote the filter-worthy attributes out of `specs` jsonb into
-- constrained columns so iOS and web stop guessing from name text (each with different
-- rules) and a human edit has somewhere to live.
--
-- `specs` is left untouched: the web app still reads proof / age_label / expression_type /
-- mash_bill / availability_rarity from it. Enrichment scripts must skip rows where
-- facts_verified_at is set — that stamp means a person confirmed the row in the app.

create type cellar.expression_type as enum ('standard', 'small_batch', 'single_barrel', 'store_pick', 'limited');
create type cellar.mash_style as enum ('traditional', 'wheated', 'high_rye', 'four_grain', 'rye', 'unknown');
create type cellar.rarity as enum ('shelf', 'limited', 'allocated', 'lottery', 'unicorn');

alter table cellar.products
  add column if not exists proof numeric(5,1),
  add column if not exists age_years numeric(5,2),
  add column if not exists age_label text,
  add column if not exists expression_type cellar.expression_type,
  add column if not exists mash_style cellar.mash_style,
  add column if not exists bottled_in_bond boolean not null default false,
  add column if not exists barrel_proof boolean not null default false,
  add column if not exists rarity cellar.rarity,
  add column if not exists facts_verified_at timestamptz,
  add column if not exists facts_verified_by uuid references cellar.users(id);

alter table cellar.products
  add constraint products_proof_range check (proof is null or (proof > 0 and proof <= 200)),
  add constraint products_age_years_range check (age_years is null or (age_years > 0 and age_years <= 50));

comment on column cellar.products.proof is 'Bottling proof as printed. Typed twin of specs.proof.';
comment on column cellar.products.age_years is 'Age statement in years (4.5 allowed). Null = NAS or unknown; see `nas`.';
comment on column cellar.products.age_label is 'Age statement as printed on the label ("10 yr", "NAS"). Display only.';
comment on column cellar.products.expression_type is 'How the bottling is drawn: standard / small_batch / single_barrel / store_pick / limited. Drives the Single Barrel shelf chip.';
comment on column cellar.products.mash_style is 'Mash-bill family. `unknown` is honest; never guess from proof or price.';
comment on column cellar.products.bottled_in_bond is 'Label says Bottled-in-Bond / Bonded.';
comment on column cellar.products.barrel_proof is 'Label says barrel/cask strength, full proof, or uncut; or proof >= 115.';
comment on column cellar.products.rarity is 'How hard it is to find at retail. shelf / limited / allocated / lottery / unicorn. Drives the Allocated chip.';
comment on column cellar.products.facts_verified_at is 'Set when a member edits facts in the app. Enrichment scripts must not overwrite rows where this is set.';

-- Backfill from specs for bourbons. Same derivation as the dry-run reviewed on 2026-09-18.
with p as (
  select id, release_pattern, specs,
         lower(coalesce(name,'')||' '||coalesce(expression,'')||' '||coalesce(specs->>'expression_type','')) as hay
  from cellar.products
  where type = 'bourbon' and facts_verified_at is null
),
d as (
  select id,
    nullif(specs->>'proof','')::numeric as proof,
    nullif(trim(specs->>'age_label'),'') as age_label,
    case when upper(trim(specs->>'age_label')) = 'NAS' then null
         else (regexp_match(trim(specs->>'age_label'), '^(\d+(\.\d+)?)'))[1]::numeric end as age_years,
    case
      when hay ~ 'single[ -]?(barrel|cask)' or hay ~ 'single rack' then 'single_barrel'
      when release_pattern = 'pick' or hay ~ '(store|private|house) (pick|select|barrel)' then 'store_pick'
      when hay ~ 'small[ -]?batch' then 'small_batch'
      when hay ~ '(limited|commemorative|anniversary)' then 'limited'
      else 'standard' end::cellar.expression_type as expression_type,
    (hay ~ '(barrel|cask) (proof|strength)' or hay ~ 'full proof' or hay ~ 'uncut'
       or nullif(specs->>'proof','')::numeric >= 115) as barrel_proof,
    (hay ~ 'bottled[ -]?in[ -]?bond' or hay ~ '\mbonded\M' or hay ~ '\mbib\M') as bottled_in_bond,
    case
      when specs->>'style_family' = 'RYE' or specs->>'whiskey_type' = 'Rye' then 'rye'
      when specs->>'style_family' = 'BWH' then 'wheated'
      when specs->>'style_family' = 'BHR' then 'high_rye'
      when hay ~ 'four[ -]?grain' or lower(specs->>'mash_bill') ~ 'four[ -]?grain' then 'four_grain'
      when hay ~ 'wheat' or lower(specs->>'mash_bill') ~ 'wheat' then 'wheated'
      when hay ~ 'high[ -]?rye' then 'high_rye'
      when ((regexp_match(specs->>'mash_bill', '(\d{1,2})\s*%\s*rye', 'i'))[1])::int >= 20 then 'high_rye'
      when lower(specs->>'mash_bill') ~ 'rye' and lower(specs->>'mash_bill') ~ 'corn' then 'traditional'
      when specs->>'style_family' = 'BST' then 'traditional'
      else 'unknown' end::cellar.mash_style as mash_style,
    -- Tier settles the clear bands; within tier 3 the curated rarity is the better signal.
    case (specs->>'tier')::int
      when 1 then 'shelf' when 2 then 'shelf' when 4 then 'allocated' when 5 then 'lottery'
      when 3 then case specs->>'availability_rarity'
                    when 'allocated' then 'allocated' when 'lottery' then 'lottery'
                    when 'secondary-only' then 'lottery' else 'limited' end
      else case specs->>'availability_rarity'
             when 'everyday' then 'shelf' when 'allocated' then 'allocated'
             when 'lottery' then 'lottery' when 'secondary-only' then 'lottery'
             when 'seasonal' then 'limited' when 'discontinued' then 'limited' end
    end::cellar.rarity as rarity
  from p
)
update cellar.products x set
  proof = d.proof,
  age_label = d.age_label,
  age_years = d.age_years,
  nas = (d.age_years is null),
  expression_type = d.expression_type,
  barrel_proof = coalesce(d.barrel_proof, false),
  bottled_in_bond = d.bottled_in_bond,
  mash_style = d.mash_style,
  rarity = d.rarity
from d where d.id = x.id;
