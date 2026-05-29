/**
 * Member-facing catalog scope for enrichment CLIs.
 *
 * REVIEW_keep=N rows should already be removed by apply-*-review scripts.
 * Rows hidden via spine cut-back stay in DB with catalog_included=false — use
 * --catalog-only (or --keep) to enrich only the kept / member-visible set.
 */

export type EnrichCatalogScope = "all" | "catalog-only";

export function parseEnrichCatalogScope(argv: string[]): EnrichCatalogScope {
  if (argv.includes("--catalog-only") || argv.includes("--keep")) {
    return "catalog-only";
  }
  return "all";
}

export function enrichCatalogScopeLabel(scope: EnrichCatalogScope): string {
  return scope === "catalog-only" ? "catalog_included=true" : "all rows in DB";
}
