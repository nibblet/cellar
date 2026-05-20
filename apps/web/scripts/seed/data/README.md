# Seed Data Sources

## BourbonData.csv

**Source:** [Cred1747/bourbonExplorer](https://github.com/Cred1747/bourbonExplorer/blob/master/inst/shiny/BourbonData.csv)
**License:** MIT (see `BourbonData.LICENSE.md`)
**Records:** ~1,350 bourbons
**Columns:** Name, Price, Abv, Rating, Year_Made, Distillery, Mash_Bill, Flavor_Profile, Aging Period

This is the primary bourbon catalog seed. Ratings appear to be sourced from Whisky Advocate. The Flavor_Profile column gives a comma-separated descriptor list that maps cleanly onto our bourbon wheel via the synonym index — no LLM call needed for the seed pass.

## stickpicks-cigars.json

**Source:** [bguillow-rgb/StickPicks · scripts/data/cigars.json](https://github.com/bguillow-rgb/StickPicks/blob/main/scripts/data/cigars.json)
**License:** Not declared on upstream repo. Used here for a private 12-person club; credit the source if redistributed.
**Records:** ~2,020 cigars across 107 brands
**Fields per row:** brand, name, vitola, strength (1-5), body (1-5), price_tier (1-5), wrapper, binder, filler (array), origin, flavors (array of ~5 tags), description

The catalog is LLM-generated (the upstream repo contains `expand-catalog-llm.ts` and `enrich-catalog-llm.ts`), so expect ~5-15% blend errors on edge cases. Members can fix any wrong entries via the in-app product edit screen. The `flavors` array maps directly onto our cigar wheel via the synonym index — products in this catalog land with non-empty `wheel_vector` and `trait_vector` from day one, which lets the pairing engine start scoring cigars immediately.

Ingested via `pnpm seed:cigars-json` — fast (no network, no LLM), idempotent on `(type, name, brand)`.

## Cigar seeding strategy (three options, ranked by speed)

1. **`seed:cigars-json`** — bulk import from the StickPicks JSON above. Fastest (~5 sec for 2,020 cigars), gives free wheel-vector seeding. Use this for the initial bulk.
2. **`seed:cigars-api`** — RapidAPI cigar-api.com path. Structured JSON, but the upstream service is flaky (HTTP 503 at the time of writing). Useful only if RapidAPI revives the endpoint.
3. **`seed:cigars`** — Halfwheel RSS + per-item LLM extraction. Slowest (~1-2 sec/item), but pulls real review prose useful for descriptor enrichment. Use after the bulk seed to layer in editorial context for boutique releases.

Long-tail / brand-new releases get added automatically when a member captures a photo via the in-app AI identify flow.
