/**
 * Backfill the catalog hierarchy columns added in
 * 20260527000001_catalog_hierarchy.sql, and apply the member-facing cut-back.
 *
 * For every bourbon product: resolve producer → brand_family → expression via
 * the shared spine classifier, fold near-duplicates to one survivor per
 * expression, and set catalog_included. Nothing is deleted — hidden rows keep
 * all their enrichment and can be promoted later by flipping catalog_included.
 *
 * Keep set = curated core/limited survivors + the entire Cobb collection
 * (bottles Paul owns, specs.in_cobb_collection). Everything else is hidden.
 *
 *   pnpm tsx --env-file=.env.local scripts/seed/backfill-catalog-spine.ts            # dry run (default)
 *   pnpm tsx --env-file=.env.local scripts/seed/backfill-catalog-spine.ts --apply    # write to DB
 *
 * Requires NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY (via --env-file).
 */

import { readCobbBrandFamilies } from "./lib/cobb-brands";
import { classifyProduct, planCutback, type SpineInput } from "./lib/spine-match";
import { adminClient } from "./lib/supabase-admin";

type ProductRow = {
  id: string;
  name: string;
  brand: string | null;
  specs: Record<string, unknown> | null;
  wheel_vector: unknown;
  image_url: string | null;
};

const APPLY = process.argv.includes("--apply");
const COBB_XLSX = process.argv.find((a) => a.startsWith("--cobb="))?.slice("--cobb=".length);

async function fetchAllBourbons(supabase: ReturnType<typeof adminClient>): Promise<ProductRow[]> {
  const rows: ProductRow[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabase
      .from("products")
      .select("id, name, brand, specs, wheel_vector, image_url")
      .eq("type", "bourbon")
      .order("name", { ascending: true })
      .range(from, from + 999);
    if (error) throw error;
    if (!data?.length) break;
    rows.push(...(data as ProductRow[]));
  }
  return rows;
}

function toInput(p: ProductRow): SpineInput {
  const specs = (p.specs ?? {}) as Record<string, unknown>;
  return {
    id: p.id,
    name: p.name,
    distillery: p.brand ?? (typeof specs.distillery === "string" ? specs.distillery : ""),
    specs,
    rating: typeof specs.score === "number" ? specs.score : null,
    inCobb: specs.in_cobb_collection === true,
    enriched: p.wheel_vector != null || p.image_url != null,
  };
}

async function updateRow(
  supabase: ReturnType<typeof adminClient>,
  id: string,
  patch: Record<string, unknown>,
): Promise<void> {
  const { error } = await supabase.from("products").update(patch).eq("id", id);
  if (error) throw new Error(`update ${id}: ${error.message}`);
}

async function runPool<T>(items: T[], size: number, fn: (t: T) => Promise<void>): Promise<void> {
  let i = 0;
  const workers = Array.from({ length: size }, async () => {
    while (i < items.length) {
      const idx = i++;
      await fn(items[idx]);
    }
  });
  await Promise.all(workers);
}

async function main() {
  const supabase = adminClient();
  const products = await fetchAllBourbons(supabase);
  if (products.length === 0) {
    console.log("No bourbon products found. Seed the catalog first.");
    return;
  }

  const items = products.map((p) => {
    const input = toInput(p);
    return { p, input, fields: classifyProduct(input) };
  });

  // Open up the catalog to the brands the club engages with. The set is derived
  // from rows already flagged in_cobb_collection; --cobb=<xlsx> adds more in case
  // the Cobb seed hasn't been run yet.
  const extraCobbBrandFamilies = COBB_XLSX ? await readCobbBrandFamilies(COBB_XLSX) : new Set<string>();
  if (COBB_XLSX) console.log(`Cobb xlsx: opened ${extraCobbBrandFamilies.size} brand families.`);

  const decisions = planCutback(
    items.map(({ input, fields }) => ({ input, fields })),
    { extraCobbBrandFamilies },
  );

  const patches = items.map(({ p, fields }, idx) => {
    const dec = decisions.get(idx);
    return {
      id: p.id,
      name: p.name,
      include: Boolean(dec?.include),
      reason: dec?.reason ?? "",
      patch: {
        // Grouping fields only. `catalog_included` is intentionally NOT written
        // here: member-facing visibility is owned exclusively by the authored
        // catalog manifest (data/catalog/bourbon-shelf.json) applied via
        // seed-catalog.ts. The old cut-back re-decided visibility on every run
        // and fought human curation, which is why shelf bottles kept vanishing.
        // `dec.include` below is used only for the dry-run preview.
        producer: fields.producer,
        brand_family: fields.brand_family,
        expression: fields.expression,
        release_label: fields.release_label,
        is_core_range: fields.is_core_range,
        discontinued: fields.discontinued,
        nas: fields.nas,
      },
    };
  });

  const kept = patches.filter((p) => p.include).length;
  const cobb = items.filter(({ input }) => input.inCobb).length;
  console.log(`\nBourbon products:    ${products.length}`);
  console.log(`Cobb (Paul owns):    ${cobb}  (always kept)`);
  console.log(`KEPT member-facing:  ${kept}`);
  console.log(`HIDDEN (promotable): ${products.length - kept}`);

  // Show a few of each decision class for sanity.
  const sample = (pred: (r: (typeof patches)[number]) => boolean, label: string) => {
    const rows = patches.filter(pred).slice(0, 6);
    console.log(`\n  ${label} (${patches.filter(pred).length}):`);
    for (const r of rows) console.log(`    ${r.include ? "KEEP" : "hide"}  ${r.patch.brand_family} › ${r.patch.expression}  — ${r.reason}`);
  };
  sample((r) => r.include && !r.reason.startsWith("Cobb"), "Kept — curated core/limited");
  sample((r) => r.include && r.reason.startsWith("Cobb"), "Kept — Cobb collection");
  sample((r) => !r.include, "Hidden — long tail");

  if (!APPLY) {
    console.log(`\nDry run. Re-run with --apply to write these ${patches.length} updates.\n`);
    return;
  }

  console.log(`\nApplying ${patches.length} updates…`);
  let done = 0;
  await runPool(patches, 8, async (row) => {
    await updateRow(supabase, row.id, row.patch);
    if (++done % 200 === 0) console.log(`  …${done}/${patches.length}`);
  });
  console.log(`Done. ${kept} bourbons member-facing, ${products.length - kept} hidden (promotable).\n`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
