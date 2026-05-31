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
| `expression` | canonical expression (e.g. `Weller 12 Year`) |
| `name` | card title shown to members |
| `is_core_range` | `Y` = standard lineup, `N` = limited/special |
| `proof` `abv` `age` `mash` `spirit_type` | specs (optional) |
| `producer` | parent distillery/company |
| `brand` | maker-page identity (usually = `brand_family`) |
| `id` | product UUID — leave blank to add a new bottle |

Images are **not** in this file — they come from the app photo flow. To find
bottles still missing a photo:
`select name from products where type='bourbon' and catalog_included and image_url is null;`
