# Bourbon catalog — the shelf

`bourbon-shelf.csv` is the **single source of truth** for what appears in the
member-facing bourbon catalog. One row = one bottle on the shelf. Open it in
Excel / Google Sheets / any editor.

## Edit loop

1. Edit `bourbon-shelf.csv`:
   - **Add a bottle** — add a row, leave the `id` column blank. A stable id is
     generated on apply and written back into the file.
   - **Remove from the shelf** — delete the row. The product is *hidden*, not
     deleted (its data/photos stay; re-add the row to bring it back).
   - **Rename / recategorize** — edit the cell (`name`, `expression`,
     `brand_family`, `is_core_range`, proof/abv/age/mash, etc.).
2. Apply: `pnpm seed:catalog --apply` (run `pnpm seed:catalog` first for a dry
   run that reports what will change).

That's the whole loop. Nothing else decides catalog visibility — `is_core_range`
and grouping can be re-derived by `backfill-catalog-spine`, but **only this file
turns a bottle on or off**.

## Columns

| column | meaning |
|---|---|
| `brand_family` | the divider it appears under (e.g. `Weller`, `Maker's Mark`) |
| `expression` | the specific bottle (e.g. `Weller 12 Year`, `Maker's Mark 46`) |
| `expression_type` | the **release type** for filtering across brands — see below |
| `name` | card title shown to members |
| `is_core_range` | `Y` = standard lineup, `N` = limited/special — see below |
| `tier` | catalog shelf tier `1`–`5` — see below |
| `availability` | how hard it is to get — see below |
| `price_usd` | approx. dollar price; drives the `$`–`$$$$` badge |
| `proof` `abv` `age` `mash` `spirit_type` | specs (optional) |
| `producer` | parent distillery/company |
| `brand` | maker-page identity (usually = `brand_family`) |
| `id` | product UUID — leave blank to add a new bottle |

### `expression_type` — the release type

A small, shared vocabulary so you can ask "how many Single Barrels do we
carry?" across every brand. Use one of:

`Single Barrel` · `Small Batch` · `Barrel Proof` · `Cask Strength` ·
`Full Proof` · `Bottled-in-Bond` · `Straight Rye` · `Four Grain` ·
`Limited Edition`

Leave it **blank** for a plain flagship (Maker's Mark, Buffalo Trace) — blank
means "no special type," which is correct. This is *not* where finishes go:
"Port Barrel Finish", "Amburana", "Sherry Cask" are descriptive variants and
live in the bottle's `name`, not here.

### `is_core_range` — everyday vs special

- `Y` = part of the brand's **standard, always-on-the-shelf lineup** (Maker's
  Mark, Weller Special Reserve, Woodford Distiller's Select, Four Roses Small
  Batch).
- `N` = **limited / special / allocated / one-off** (Birthday Bourbon, Master's
  Collection, store single-barrel picks, Booker's batches).

It's independent of `expression_type`: a Single Barrel can be core (Eagle Rare)
or limited (a store pick).

### `tier` — catalog shelf level (1–5)

How far up the allocation ladder a bottle sits. Members have a **Catalog Shelf**
slider in their preferences; a bottle shows only if its `tier` is at or below
the member's setting (the max setting, 5, shows everything; a blank tier always
shows). Rough guide:

- `1` everyday shelf · `2` common-but-nicer · `3` uncommon/harder ·
  `4` allocated · `5` unicorn/lottery

### `availability` — how hard to get

One of: `everyday` · `seasonal` · `allocated` · `lottery` · `secondary-only` ·
`discontinued`. Shown as a badge; blank hides it. (Related to `tier` but
separate — `tier` gates visibility, `availability` is descriptive.)

### `price_usd`

Approximate dollar price. The app turns it into a `$`–`$$$$` badge
(bourbon: `$` <\$35, `$$` <\$75, `$$$` <\$150, `$$$$` \$150+); the bucket is
derived, so you only enter the number. Blank = no price badge.

## What you'll typically edit

- **Add/remove bottles** (rows) — the main lever.
- **`is_core_range`** — flag everyday vs special.
- **`expression_type`** — fix a mis-bucketed release type.
- **`name`** — clean up a card title.

`proof`/`abv`/`age`/`mash` are optional metadata; `producer`/`brand` rarely need
touching. Edits to `expression_type` and specs sync to the database on the next
`pnpm seed:catalog --apply` (blank clears the value).

Images are **not** in this file — they come from the app photo flow. To find
bottles still missing a photo:
`select name from products where type='bourbon' and catalog_included and image_url is null;`
