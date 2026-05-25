/**
 * Remove tier-curated bourbon rows from the catalog.
 *
 *   pnpm remove:catalog-tier --dry-run
 *   pnpm remove:catalog-tier --dry-run --tier=1
 *   pnpm remove:catalog-tier --apply --tier=2
 *   pnpm remove:catalog-tier --apply
 *
 * IDs live in data/catalog-tier-removals.json (tier1 / tier2 arrays).
 */

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { adminClient } from "./lib/supabase-admin";

export {};

type RemovalManifest = {
  tier1: string[];
  tier2: string[];
};

const MANIFEST_PATH = resolve(process.cwd(), "../../data/catalog-tier-removals.json");

function loadManifest(): RemovalManifest {
  const raw = JSON.parse(readFileSync(MANIFEST_PATH, "utf8")) as RemovalManifest;
  return {
    tier1: raw.tier1 ?? [],
    tier2: raw.tier2 ?? [],
  };
}

function parseTierArg(): "all" | "1" | "2" {
  const tierFlag = process.argv.find((a) => a.startsWith("--tier="));
  if (!tierFlag) return "all";
  const value = tierFlag.split("=")[1];
  if (value === "1" || value === "2") return value;
  throw new Error(`Invalid --tier value "${value}" (use 1, 2, or omit for both)`);
}

async function fetchProducts(ids: string[]) {
  const supa = adminClient();
  const found: Array<{
    id: string;
    brand: string | null;
    name: string;
    specs: Record<string, unknown> | null;
  }> = [];

  for (let i = 0; i < ids.length; i += 100) {
    const chunk = ids.slice(i, i + 100);
    const { data, error } = await supa
      .from("products")
      .select("id, brand, name, specs")
      .eq("type", "bourbon")
      .in("id", chunk);
    if (error) throw error;
    found.push(...(data ?? []));
  }
  return found;
}

async function countDependents(id: string) {
  const supa = adminClient();
  const tables = ["tastings", "product_images", "product_reviews", "member_saves"] as const;
  const counts: Record<string, number> = {};
  for (const table of tables) {
    const { count, error } = await supa
      .from(table)
      .select("*", { count: "exact", head: true })
      .eq("product_id", id);
    if (error) throw error;
    counts[table] = count ?? 0;
  }
  return counts;
}

async function deleteProduct(id: string) {
  const supa = adminClient();
  await supa.from("pairings_cache").delete().eq("bourbon_id", id);
  await supa.from("pairings_cache").delete().eq("cigar_id", id);
  const { error } = await supa.from("products").delete().eq("id", id);
  if (error) throw error;
}

async function main() {
  const dryRun = !process.argv.includes("--apply");
  const tierArg = parseTierArg();
  const manifest = loadManifest();

  const ids =
    tierArg === "1"
      ? manifest.tier1
      : tierArg === "2"
        ? manifest.tier2
        : [...manifest.tier1, ...manifest.tier2];

  const label = tierArg === "all" ? "tier1+tier2" : `tier${tierArg}`;
  console.log(
    `[remove-catalog-tier] ${dryRun ? "DRY RUN" : "APPLY"} · ${label} · ${ids.length} ids in manifest`,
  );

  const uniqueIds = [...new Set(ids)];
  if (uniqueIds.length !== ids.length) {
    console.warn(`[remove-catalog-tier] deduped ${ids.length - uniqueIds.length} duplicate ids in manifest`);
  }

  const products = await fetchProducts(uniqueIds);
  const foundIds = new Set(products.map((p) => p.id));
  const missing = uniqueIds.filter((id) => !foundIds.has(id));

  const byTier = (id: string) => {
    if (manifest.tier1.includes(id)) return 1;
    if (manifest.tier2.includes(id)) return 2;
    return 0;
  };

  products.sort((a, b) => {
    const t = byTier(a.id) - byTier(b.id);
    if (t !== 0) return t;
    return `${a.brand ?? ""} ${a.name}`.localeCompare(`${b.brand ?? ""} ${b.name}`);
  });

  let tastings = 0;
  let images = 0;
  let reviews = 0;
  let saves = 0;

  for (const p of products) {
    const tier = byTier(p.id);
    const tierSpec = p.specs?.tier;
    const deps = dryRun ? await countDependents(p.id) : null;
    if (deps) {
      tastings += deps.tastings;
      images += deps.product_images;
      reviews += deps.product_reviews;
      saves += deps.member_saves;
    }
    const depSummary = deps
      ? `t=${deps.tastings} img=${deps.product_images} rev=${deps.product_reviews} save=${deps.member_saves}`
      : "";
    console.log(
      `  [T${tier}] ${p.id} · ${p.brand ?? "?"} · ${p.name} · spec_tier=${tierSpec ?? "?"} ${depSummary}`,
    );
  }

  if (missing.length) {
    console.log(`\n[remove-catalog-tier] ${missing.length} ids not found in DB (already removed?):`);
    for (const id of missing) console.log(`  ${id}`);
  }

  if (dryRun && products.length) {
    console.log(
      `\n[remove-catalog-tier] would delete ${products.length} products · dependents: tastings=${tastings} images=${images} reviews=${reviews} saves=${saves}`,
    );
    console.log("[remove-catalog-tier] Re-run with --apply to delete.");
    return;
  }

  let deleted = 0;
  for (const p of products) {
    await deleteProduct(p.id);
    deleted += 1;
  }

  console.log(`\n[remove-catalog-tier] deleted ${deleted} products.`);
}

main().catch((err) => {
  console.error("[remove-catalog-tier] failed:", err);
  process.exit(1);
});
