# Seed Data Sources

## BourbonData.csv

**Source:** [Cred1747/bourbonExplorer](https://github.com/Cred1747/bourbonExplorer/blob/master/inst/shiny/BourbonData.csv)
**License:** MIT (see `BourbonData.LICENSE.md`)
**Records:** ~1,350 bourbons
**Columns:** Name, Price, Abv, Rating, Year_Made, Distillery, Mash_Bill, Flavor_Profile, Aging Period

This is the primary bourbon catalog seed. Ratings appear to be sourced from Whisky Advocate. The Flavor_Profile column gives a comma-separated descriptor list that maps cleanly onto our bourbon wheel via the synonym index — no LLM call needed for the seed pass.

## Cigar data (future)

Cigar seeding is more involved (no comparable single dataset exists). The plan is:

1. Ingest Halfwheel RSS for ~3 years of reviews → ~500 boutique cigars with rich tasting prose.
2. Ingest cigar-api.com listings → mainstream SKUs + product imagery.
3. AI fills the long tail on first scan.

See `seed-cigars.ts` for the skeleton.
