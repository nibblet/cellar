/**
 * Audit bourbon catalog enrichment completeness.
 *   pnpm audit:bourbon-enrichment
 */

import { adminClient } from "./lib/supabase-admin";

type ProductRow = {
  id: string;
  name: string;
  brand: string | null;
  image_url: string | null;
  status: string;
  wheel_vector: unknown;
  trait_vector: unknown;
  specs: Record<string, unknown> | null;
};

const SEED_SOURCES = new Set([
  "halfwheel",
  "stickpicks",
  "cigar-api",
  "cigarbase",
  "bourbonExplorer",
  "seed",
]);

function has(v: unknown): boolean {
  return v !== null && v !== undefined && v !== "";
}

function spec(p: ProductRow, key: string): unknown {
  return p.specs?.[key];
}

function isSupabaseImage(url: string | null): boolean {
  if (!url) return false;
  return url.includes("supabase") || url.startsWith("catalog/") || !url.startsWith("http");
}

async function fetchAll(): Promise<ProductRow[]> {
  const supa = adminClient();
  const all: ProductRow[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supa
      .from("products")
      .select("id, name, brand, image_url, status, wheel_vector, trait_vector, specs")
      .eq("type", "bourbon")
      .range(from, from + 999);
    if (error) throw error;
    if (!data?.length) break;
    all.push(...(data as ProductRow[]));
  }
  return all;
}

async function fetchReviewStats(): Promise<Map<string, { total: number; apify: number; sources: string[] }>> {
  const supa = adminClient();
  const map = new Map<string, { total: number; apify: number; sources: string[] }>();
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supa
      .from("product_reviews")
      .select("product_id, source")
      .range(from, from + 999);
    if (error) throw error;
    if (!data?.length) break;
    for (const row of data) {
      const cur = map.get(row.product_id) ?? { total: 0, apify: 0, sources: [] };
      cur.total += 1;
      if (!SEED_SOURCES.has(row.source)) cur.apify += 1;
      if (!cur.sources.includes(row.source)) cur.sources.push(row.source);
      map.set(row.product_id, cur);
    }
  }
  return map;
}

async function main() {
  const [products, reviews] = await Promise.all([fetchAll(), fetchReviewStats()]);

  const confirmed = products.filter((p) => p.status === "confirmed");
  const draft = products.filter((p) => p.status === "draft");

  const withImage = products.filter((p) => has(p.image_url));
  const withSupabaseImage = products.filter((p) => isSupabaseImage(p.image_url));
  const withExternalImage = products.filter(
    (p) => has(p.image_url) && !isSupabaseImage(p.image_url),
  );
  const withApify = products.filter((p) => (reviews.get(p.id)?.apify ?? 0) > 0);
  const withAnyReview = products.filter((p) => (reviews.get(p.id)?.total ?? 0) > 0);
  const withWheel = products.filter((p) => p.wheel_vector && Object.keys(p.wheel_vector as object).length > 0);
  const withTrait = products.filter((p) => p.trait_vector && Object.keys(p.trait_vector as object).length > 0);
  const withTier = products.filter((p) => has(spec(p, "tier")));
  const pending = products.filter((p) => spec(p, "enrichment_pending") === true);

  const specFields = [
    "distillery",
    "proof",
    "abv",
    "mash_bill",
    "whiskey_type",
    "expression_type",
    "age_years",
    "age_label",
    "tier",
    "tier_source",
  ] as const;

  const specCoverage: Record<string, number> = {};
  for (const f of specFields) {
    specCoverage[f] = products.filter((p) => has(spec(p, f))).length;
  }

  // "Fully enriched" heuristic for confirmed catalog
  const fullyEnriched = confirmed.filter((p) => {
    const rev = reviews.get(p.id);
    return (
      has(p.image_url) &&
      (rev?.apify ?? 0) > 0 &&
      has(spec(p, "distillery")) &&
      has(spec(p, "proof")) &&
      has(spec(p, "tier")) &&
      spec(p, "enrichment_pending") !== true
    );
  });

  const missingImage = confirmed.filter((p) => !has(p.image_url));
  const missingApify = confirmed.filter((p) => (reviews.get(p.id)?.apify ?? 0) === 0);
  const missingDistillery = confirmed.filter((p) => !has(spec(p, "distillery")));
  const missingProof = confirmed.filter((p) => !has(spec(p, "proof")));
  const missingTier = confirmed.filter((p) => !has(spec(p, "tier")));
  const missingWheel = confirmed.filter(
    (p) => !p.wheel_vector || Object.keys(p.wheel_vector as object).length === 0,
  );

  const pct = (n: number, d: number) => `${n}/${d} (${((n / d) * 100).toFixed(1)}%)`;

  console.log("═══════════════════════════════════════════════════════");
  console.log("BOURBON CATALOG ENRICHMENT AUDIT");
  console.log("═══════════════════════════════════════════════════════");
  console.log(`Total bourbons:     ${products.length}`);
  console.log(`  confirmed:        ${confirmed.length}`);
  console.log(`  draft:            ${draft.length}`);
  console.log("");

  console.log("── Images ──");
  console.log(`  any image_url:    ${pct(withImage.length, products.length)}`);
  console.log(`  supabase/catalog: ${pct(withSupabaseImage.length, products.length)}`);
  console.log(`  external URL:     ${pct(withExternalImage.length, products.length)}`);
  console.log(`  confirmed missing image: ${missingImage.length}`);
  console.log("");

  console.log("── Reviews ──");
  console.log(`  any review:       ${pct(withAnyReview.length, products.length)}`);
  console.log(`  apify (web):      ${pct(withApify.length, products.length)}`);
  console.log(`  confirmed missing apify: ${missingApify.length}`);
  console.log("");

  console.log("── Vectors ──");
  console.log(`  wheel_vector:     ${pct(withWheel.length, products.length)}`);
  console.log(`  trait_vector:     ${pct(withTrait.length, products.length)}`);
  console.log(`  confirmed missing wheel: ${missingWheel.length}`);
  console.log("");

  console.log("── Specs field coverage (all bourbons) ──");
  for (const f of specFields) {
    console.log(`  ${f.padEnd(18)} ${pct(specCoverage[f], products.length)}`);
  }
  console.log(`  enrichment_pending flagged: ${pending.length}`);
  console.log("");

  console.log("── Full enrichment heuristic (confirmed only) ──");
  console.log(`  image + apify + distillery + proof + tier, not pending:`);
  console.log(`  ${pct(fullyEnriched.length, confirmed.length)}`);
  console.log("");

  const printSample = (label: string, rows: ProductRow[], limit = 15) => {
    if (rows.length === 0) {
      console.log(`── ${label}: none ✓`);
      return;
    }
    console.log(`── ${label} (${rows.length} total, showing ${Math.min(limit, rows.length)}) ──`);
    for (const p of rows.slice(0, limit)) {
      const rev = reviews.get(p.id);
      const tier = spec(p, "tier");
      const img = p.image_url ? (isSupabaseImage(p.image_url) ? "img✓" : "img(ext)") : "no-img";
      const apify = rev?.apify ? `apify×${rev.apify}` : "no-apify";
      console.log(`  [t${tier ?? "?"}] ${img} ${apify} | ${p.brand ?? "—"} / ${p.name}`);
    }
    console.log("");
  };

  printSample("Confirmed missing image", missingImage.sort((a, b) => a.name.localeCompare(b.name)));
  printSample(
    "Confirmed missing apify reviews",
    missingApify.sort((a, b) => a.name.localeCompare(b.name)),
  );
  printSample(
    "Confirmed missing distillery",
    missingDistillery.sort((a, b) => a.name.localeCompare(b.name)),
  );
  printSample(
    "Confirmed missing proof",
    missingProof.sort((a, b) => a.name.localeCompare(b.name)),
  );
  printSample(
    "Confirmed missing tier",
    missingTier.sort((a, b) => a.name.localeCompare(b.name)),
  );
  printSample(
    "Still enrichment_pending",
    pending.filter((p) => p.status === "confirmed").sort((a, b) => a.name.localeCompare(b.name)),
  );

  // Tier breakdown for confirmed
  const tierCounts = new Map<number | "none", number>();
  for (const p of confirmed) {
    const t = spec(p, "tier");
    const key = typeof t === "number" ? t : "none";
    tierCounts.set(key, (tierCounts.get(key) ?? 0) + 1);
  }
  console.log("── Confirmed tier distribution ──");
  for (const t of [1, 2, 3, 4, 5, "none"] as const) {
    const n = tierCounts.get(t);
    if (n) console.log(`  tier ${t}: ${n}`);
  }

  // Cobb collection coverage
  const cobb = confirmed.filter((p) => p.specs?.in_cobb_collection === true);
  const cobbFull = cobb.filter((p) => fullyEnriched.includes(p));
  console.log("");
  console.log(`── Cobb collection (${cobb.length} confirmed) ──`);
  console.log(`  fully enriched: ${pct(cobbFull.length, cobb.length)}`);
}

main().catch((err) => {
  console.error("[audit-bourbon-enrichment] fatal:", err);
  process.exit(1);
});
