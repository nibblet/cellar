/**
 * Cigar seed via CigarBase (RapidAPI).
 *
 * Usage:
 *   pnpm seed:cigars-cigarbase            # 100 cigars (verification)
 *   pnpm seed:cigars-cigarbase 500        # bulk
 *
 * Requires RAPIDAPI_KEY in .env.local + an active CigarBase subscription
 * on the RapidAPI marketplace (separate from the cigar-api.com one).
 *
 * Best used AFTER seed:cigars-json — CigarBase is presumed human-curated
 * so it'll overwrite the LLM-generated StickPicks entries' specs on
 * matching (type, name, brand). Image URLs land in specs.image_url for
 * later use in product_images.
 */

import {
  type CigarBaseRow,
  extractCigarArray,
  listCigars,
  normalizeCigar,
} from "./lib/cigarbase-client";
import { adminClient } from "./lib/supabase-admin";

export {};

const DEFAULT_TARGET = 100;
const PAGE_SIZE = 50;
const WHEEL_VERSION = "0.1";
const SLEEP_MS = 200;

async function main() {
  const target = Number(process.argv[2]) || DEFAULT_TARGET;
  console.log(`[seed-cigars-cigarbase] target = ${target} cigars`);

  const supabase = adminClient();
  let inserted = 0;
  let updated = 0;
  let skipped = 0;
  let firstPageLogged = false;

  for (let offset = 0; offset < 5000; offset += PAGE_SIZE) {
    if (inserted + updated >= target) break;

    let payload: unknown;
    try {
      payload = await listCigars(PAGE_SIZE, offset);
    } catch (err) {
      console.warn(`[seed-cigars-cigarbase] offset=${offset} fetch failed:`, err);
      break;
    }

    const rawArray = extractCigarArray(payload);

    if (!firstPageLogged) {
      console.log(`[seed-cigars-cigarbase] offset=0 raw shape:`);
      if (rawArray.length > 0) {
        console.log(JSON.stringify(rawArray[0], null, 2).slice(0, 1000));
      } else {
        console.log("(no array found — full payload below)");
        console.log(JSON.stringify(payload, null, 2).slice(0, 1000));
      }
      firstPageLogged = true;
    }

    if (rawArray.length === 0) {
      console.log(`[seed-cigars-cigarbase] offset=${offset} empty — stopping.`);
      break;
    }

    for (const raw of rawArray) {
      if (inserted + updated >= target) break;
      const cigar = normalizeCigar(raw);
      if (!cigar) {
        skipped += 1;
        continue;
      }
      const result = await upsertCigar(supabase, cigar);
      if (result === "inserted") inserted += 1;
      else if (result === "updated") updated += 1;
      else skipped += 1;

      if ((inserted + updated) % 25 === 0) {
        console.log(
          `[seed-cigars-cigarbase] progress: inserted=${inserted} updated=${updated} skipped=${skipped}`,
        );
      }
    }

    await new Promise((r) => setTimeout(r, SLEEP_MS));
  }

  console.log(
    `[seed-cigars-cigarbase] done. inserted=${inserted} updated=${updated} skipped=${skipped}`,
  );
}

async function upsertCigar(
  supabase: ReturnType<typeof adminClient>,
  cigar: CigarBaseRow,
): Promise<"inserted" | "updated" | "skipped"> {
  const specs = {
    vitola: cigar.vitola,
    country: cigar.country,
    wrapper: cigar.wrapper,
    wrapper_color: cigar.wrapper,
    binder: cigar.binder,
    filler: cigar.filler,
    strength: cigar.strength,
    length: cigar.length,
    ring_gauge: cigar.ring_gauge,
    image_url: cigar.image_url,
    source_id: cigar.id,
  };

  const { data: existing } = await supabase
    .from("products")
    .select("id")
    .eq("type", "cigar")
    .eq("name", cigar.name)
    .eq("brand", cigar.brand ?? "")
    .maybeSingle();

  if (existing) {
    // Merge specs so we don't blow away wheel_vector/trait_vector or other
    // fields the JSON seeder populated. Only spec fields get overwritten.
    const { data: row } = await supabase
      .from("products")
      .select("specs")
      .eq("id", existing.id)
      .maybeSingle();
    const mergedSpecs = {
      ...((row?.specs as Record<string, unknown>) ?? {}),
      ...specs,
    };
    const { error } = await supabase
      .from("products")
      .update({ specs: mergedSpecs, name: cigar.name, brand: cigar.brand })
      .eq("id", existing.id);
    if (error) {
      console.warn(`[seed-cigars-cigarbase] update failed for "${cigar.name}":`, error.message);
      return "skipped";
    }
    return "updated";
  }

  const { data: created, error } = await supabase
    .from("products")
    .insert({
      type: "cigar",
      name: cigar.name,
      brand: cigar.brand,
      specs,
      wheel_version: WHEEL_VERSION,
      status: "confirmed",
      source: "seed",
    })
    .select("id")
    .single();
  if (error || !created) {
    console.warn(`[seed-cigars-cigarbase] insert failed for "${cigar.name}":`, error?.message);
    return "skipped";
  }

  if (cigar.description) {
    await supabase.from("product_reviews").insert({
      product_id: created.id,
      source: "cigarbase",
      text: cigar.description,
    });
  }

  return "inserted";
}

main().catch((err) => {
  console.error("[seed-cigars-cigarbase] failed:", err);
  process.exit(1);
});
