/**
 * seed-catalog — the single owner of the member-facing bourbon catalog.
 *
 * `data/catalog/bourbon-shelf.json` is the authored source of truth: one entry
 * per shelf bottle. This script makes the DB match it, deterministically:
 *
 *   - every shelf entry  → catalog_included = true (+ identity fields synced)
 *   - every other bourbon → catalog_included = false
 *
 * It is idempotent and order-independent. There is no cut-back heuristic and no
 * regex hierarchy deciding visibility — the file decides, nothing else. Run it
 * any time; run it after backfill-catalog-spine (which now only writes grouping
 * fields, never catalog_included). This is what ends the "shelf bottle vanished
 * again" cycle: one writer of catalog_included, and it's this file.
 *
 *   pnpm tsx --env-file=.env.local scripts/seed/seed-catalog.ts            # dry run
 *   pnpm tsx --env-file=.env.local scripts/seed/seed-catalog.ts --apply    # write
 */

import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { adminClient } from "./lib/supabase-admin";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const MANIFEST = path.resolve(__dirname, "../../../../data/catalog/bourbon-shelf.json");
const APPLY = process.argv.includes("--apply");

type ShelfEntry = {
  id: string;
  brand: string;
  brand_family: string;
  expression: string;
  name: string;
  producer: string;
  is_core_range: boolean;
  image: string | null;
  proof?: number | null;
  abv?: number | null;
  age?: number | string | null;
  mash?: string | null;
  spirit_type?: string;
  needs_image?: boolean;
};

function buildSpecsPatch(e: ShelfEntry, existing: Record<string, unknown> | null): Record<string, unknown> {
  const specs = { ...(existing ?? {}) };
  if (e.proof != null) specs.proof = e.proof;
  if (e.abv != null) specs.abv = e.abv;
  if (e.age != null && e.age !== "") specs.age_years = Number(e.age);
  if (e.mash) specs.mash_bill = e.mash;
  if (e.spirit_type) specs.spirit_type = e.spirit_type;
  if (e.needs_image) specs.needs_image = true;
  return specs;
}

async function main() {
  const { shelf } = JSON.parse(readFileSync(MANIFEST, "utf8")) as { shelf: ShelfEntry[] };
  const shelfIds = new Set(shelf.map((e) => e.id));
  const supa = adminClient();

  const { data: existing, error } = await supa
    .from("products")
    .select("id, specs, catalog_included")
    .eq("type", "bourbon");
  if (error) throw error;
  const byId = new Map((existing ?? []).map((r) => [r.id as string, r]));

  const toHide = (existing ?? []).filter((r) => r.catalog_included && !shelfIds.has(r.id as string));
  const inserts = shelf.filter((e) => !byId.has(e.id));

  console.log(`Manifest shelf:      ${shelf.length}`);
  console.log(`Already in DB:       ${shelf.length - inserts.length}`);
  console.log(`New inserts:         ${inserts.length}`);
  console.log(`Will hide (off-shelf): ${toHide.length}`);
  console.log(`Still needing image: ${shelf.filter((e) => e.needs_image).length}`);

  if (!APPLY) {
    console.log("\nDry run. Re-run with --apply to write.\n");
    return;
  }

  for (const e of shelf) {
    const prior = byId.get(e.id);
    const row = {
      id: e.id,
      type: "bourbon" as const,
      name: e.name,
      brand: e.brand,
      brand_family: e.brand_family,
      expression: e.expression,
      producer: e.producer,
      is_core_range: e.is_core_range,
      catalog_included: true,
      status: "confirmed" as const,
      source: prior ? undefined : ("manual" as const),
      ...(e.image ? { image_url: e.image } : {}),
      specs: buildSpecsPatch(e, (prior?.specs as Record<string, unknown> | null) ?? null),
    };
    const { error: upErr } = await supa.from("products").upsert(row, { onConflict: "id" });
    if (upErr) throw new Error(`upsert ${e.id}: ${upErr.message}`);
  }

  if (toHide.length) {
    const { error: hideErr } = await supa
      .from("products")
      .update({ catalog_included: false })
      .in("id", toHide.map((r) => r.id));
    if (hideErr) throw new Error(`hide: ${hideErr.message}`);
  }

  console.log(`\nDone. Catalog = ${shelf.length} bourbons; ${toHide.length} hidden off-shelf.\n`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
