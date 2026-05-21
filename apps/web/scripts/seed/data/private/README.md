# Private seed inputs (not committed)

Drop personal/sensitive seed sources here. Everything in this directory is
gitignored except `README.md` and `.gitignore` itself.

## Cobb whiskey collection

The `seed:cobb-whiskey` script defaults to reading from:

```
scripts/seed/data/private/cobb-whiskey.xlsx
```

You can also pass a path explicitly:

```bash
pnpm seed:cobb-whiskey ~/Downloads/Cobb_Whiskey_Collection_Updated.xlsx
```

The xlsx must have a sheet named **"Whiskey Collection"** with the columns
seen in the original Cobb spreadsheet (Shelf, Distiller, DSP, Brand Name,
Expression / Detail, Type, Age, Proof, Additional Notes, Mash Bill,
Tasting Notes, ID Confidence, Tier, Style Family, Tall?).
