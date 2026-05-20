/**
 * Fastest cigar seed. Reads a bundled JSON catalog (bguillow-rgb/StickPicks
 * via GitHub, ~2,020 cigars) and upserts in one pass. No network calls, no
 * LLM in the loop.
 *
 * Usage:
 *   pnpm seed:cigars-json            # whole catalog (~2,020 cigars)
 *   pnpm seed:cigars-json 200        # cap at 200 for a quick run
 *
 * Bonus: the source includes a `flavors` array per cigar, which we map
 * onto the wheel via the existing synonym index. That's free wheel_vector
 * + trait_vector seeding for products in this catalog — pairing engine
 * can start scoring cigars on day one.
 *
 * Caveats (from the source):
 * - Catalog is LLM-generated (the repo contains expand-catalog-llm.ts).
 *   Expect ~5-15% blend errors on edge cases. Members can fix any wrong
 *   entries via the product edit screen.
 * - License: not declared on the upstream repo. Used here for a private
 *   12-person club; attribution in scripts/seed/data/README.md.
 *
 * Idempotent: matches existing rows by (type, name, brand). Safe to run
 * alongside or after the other cigar seeders.
 */

import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { buildSynonymIndex, matchChip, rollUpTraits, type WheelVector } from "@/lib/wheel";
import { adminClient } from "./lib/supabase-admin";

export {};

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const JSON_PATH = path.join(__dirname, "data", "stickpicks-cigars.json");
const WHEEL_VERSION = "0.1";

type StickPicksRow = {
  brand?: string;
  name?: string;
  vitola?: string;
  strength?: number;
  body?: number;
  price_tier?: number;
  wrapper?: string;
  binder?: string;
  filler?: string | string[];
  origin?: string;
  flavors?: string[];
  description?: string;
};

const synonymIndex = buildSynonymIndex("cigar");

/**
 * Map the flavors array onto the cigar wheel. Each recognized flavor gets a
 * baseline score of 4/5 — these are explicit author claims, not gentle
 * inferences from prose. Unmapped flavors are returned separately so we can
 * surface common gaps for the wheel v0.2 pass.
 */
function flavorsToVector(flavors: string[]): { vector: WheelVector; unmapped: string[] } {
  const vector: WheelVector = {};
  const unmapped: string[] = [];
  for (const f of flavors) {
    const leafId = matchChip(synonymIndex, f);
    if (leafId) {
      vector[leafId] = Math.max(vector[leafId] ?? 0, 4);
    } else {
      unmapped.push(f);
    }
  }
  return { vector, unmapped };
}

function strengthLabel(n: number | undefined): string | null {
  if (n === undefined || n === null) return null;
  if (n <= 1) return "mild";
  if (n === 2) return "mild-medium";
  if (n === 3) return "medium";
  if (n === 4) return "medium-full";
  return "full";
}

async function main() {
  const cap = Number(process.argv[2]) || Number.POSITIVE_INFINITY;
  const supabase = adminClient();

  const text = await readFile(JSON_PATH, "utf8");
  const rows = JSON.parse(text) as StickPicksRow[];
  console.log(`[seed-cigars-json] loaded ${rows.length} rows from stickpicks-cigars.json`);

  let inserted = 0;
  let updated = 0;
  let skipped = 0;
  const unmappedFlavors = new Map<string, number>();

  for (const row of rows) {
    if (inserted + updated >= cap) break;

    const name = row.name?.trim();
    const brand = row.brand?.trim() || null;
    if (!name) {
      skipped += 1;
      continue;
    }

    const flavors = Array.isArray(row.flavors) ? row.flavors : [];
    const { vector: wheelVector, unmapped } = flavorsToVector(flavors);
    for (const u of unmapped) {
      unmappedFlavors.set(u, (unmappedFlavors.get(u) ?? 0) + 1);
    }
    const traitVector = rollUpTraits("cigar", wheelVector);

    const specs = {
      vitola: row.vitola ?? null,
      country: row.origin ?? null,
      wrapper: row.wrapper ?? null,
      wrapper_color: row.wrapper ?? null,
      binder: row.binder ?? null,
      filler: Array.isArray(row.filler) ? row.filler.join(", ") : row.filler ?? null,
      strength: strengthLabel(row.strength),
      strength_score: row.strength ?? null,
      body_score: row.body ?? null,
      price_tier: row.price_tier ?? null,
    };

    const { data: existing } = await supabase
      .from("products")
      .select("id")
      .eq("type", "cigar")
      .eq("name", name)
      .eq("brand", brand ?? "")
      .maybeSingle();

    const payload = {
      type: "cigar" as const,
      name,
      brand,
      specs,
      wheel_version: WHEEL_VERSION,
      wheel_vector: wheelVector,
      trait_vector: traitVector,
      status: "confirmed" as const,
      source: "seed" as const,
    };

    if (existing) {
      const { error } = await supabase.from("products").update(payload).eq("id", existing.id);
      if (error) {
        console.warn(`[seed-cigars-json] update failed for "${name}":`, error.message);
        skipped += 1;
        continue;
      }
      updated += 1;
    } else {
      const { data: created, error } = await supabase
        .from("products")
        .insert(payload)
        .select("id")
        .single();
      if (error || !created) {
        console.warn(`[seed-cigars-json] insert failed for "${name}":`, error?.message);
        skipped += 1;
        continue;
      }
      inserted += 1;

      if (row.description?.trim()) {
        await supabase.from("product_reviews").insert({
          product_id: created.id,
          source: "stickpicks",
          text: row.description.trim(),
        });
      }
    }

    if ((inserted + updated) % 100 === 0) {
      console.log(
        `[seed-cigars-json] progress: inserted=${inserted} updated=${updated} skipped=${skipped}`,
      );
    }
  }

  console.log(
    `[seed-cigars-json] done. inserted=${inserted} updated=${updated} skipped=${skipped}`,
  );

  if (unmappedFlavors.size > 0) {
    console.log("\n[seed-cigars-json] top unmapped flavors (consider for cigar wheel v0.2):");
    const sorted = [...unmappedFlavors.entries()].sort((a, b) => b[1] - a[1]).slice(0, 15);
    for (const [f, c] of sorted) {
      console.log(`  ${String(c).padStart(4)}  ${f}`);
    }
  }
}

main().catch((err) => {
  console.error("[seed-cigars-json] failed:", err);
  process.exit(1);
});
