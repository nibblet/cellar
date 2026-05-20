/**
 * Faster cigar seed via cigar-api.com (RapidAPI). Structured JSON, no LLM
 * per item — typically 5-10x faster than the Halfwheel RSS path.
 *
 * Usage:
 *   pnpm seed:cigars-api            # 50 cigars (verification)
 *   pnpm seed:cigars-api 500        # bulk seed
 *
 * Requires RAPIDAPI_KEY in apps/web/.env.local.
 *
 * On the first run, the script logs the response shape of page 1 so you
 * can confirm the field mapping is right. If anything important is showing
 * up null for everything, ping me and we'll adjust normalizeCigar().
 *
 * Idempotent: matches existing rows by (type, name, brand). The Halfwheel
 * seeder is safe to run alongside or in sequence.
 */

import {
  extractCigarArray,
  listCigars,
  normalizeCigar,
  type ApiCigarRow,
} from "./lib/cigar-api-client";
import { adminClient } from "./lib/supabase-admin";

export {};

const DEFAULT_TARGET = 50;
const WHEEL_VERSION = "0.1";
const SLEEP_MS = 150; // be polite to RapidAPI's rate limits

async function main() {
  const target = Number(process.argv[2]) || DEFAULT_TARGET;
  console.log(`[seed-cigars-api] target = ${target} cigars`);

  const supabase = adminClient();

  let inserted = 0;
  let updated = 0;
  let skipped = 0;
  let firstPageLogged = false;

  for (let page = 1; page <= 200; page += 1) {
    if (inserted + updated >= target) break;

    let payload: unknown;
    try {
      payload = await listCigars(page);
    } catch (err) {
      console.warn(`[seed-cigars-api] page ${page} fetch failed:`, err);
      break;
    }

    const rawArray = extractCigarArray(payload);

    if (!firstPageLogged) {
      console.log(`[seed-cigars-api] page 1 raw shape:`);
      if (rawArray.length > 0) {
        console.log(JSON.stringify(rawArray[0], null, 2).slice(0, 1000));
      } else {
        console.log("(no array found — full payload below)");
        console.log(JSON.stringify(payload, null, 2).slice(0, 1000));
      }
      firstPageLogged = true;
    }

    if (rawArray.length === 0) {
      console.log(`[seed-cigars-api] page ${page} empty — stopping.`);
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
        console.log(`[seed-cigars-api] progress: inserted=${inserted} updated=${updated} skipped=${skipped}`);
      }
    }

    await new Promise((r) => setTimeout(r, SLEEP_MS));
  }

  console.log(`[seed-cigars-api] done. inserted=${inserted} updated=${updated} skipped=${skipped}`);
}

async function upsertCigar(
  supabase: ReturnType<typeof adminClient>,
  cigar: ApiCigarRow,
): Promise<"inserted" | "updated" | "skipped"> {
  const specs = {
    vitola: null as string | null, // not part of this API; left for member edits
    country: cigar.country,
    wrapper_color: cigar.color ?? cigar.wrapper,
    wrapper: cigar.wrapper,
    binder: cigar.binder,
    filler: cigar.filler,
    strength: cigar.strength,
    length: cigar.length,
    ring_gauge: cigar.ring_gauge,
    source_id: cigar.id,
  };

  const { data: existing } = await supabase
    .from("products")
    .select("id")
    .eq("type", "cigar")
    .eq("name", cigar.name)
    .eq("brand", cigar.brand ?? "")
    .maybeSingle();

  const payload = {
    type: "cigar" as const,
    name: cigar.name,
    brand: cigar.brand,
    specs,
    wheel_version: WHEEL_VERSION,
    status: "confirmed" as const,
    source: "seed" as const,
  };

  if (existing) {
    const { error } = await supabase.from("products").update(payload).eq("id", existing.id);
    if (error) {
      console.warn(`[seed-cigars-api] update failed for "${cigar.name}":`, error.message);
      return "skipped";
    }
    return "updated";
  }

  const { data: created, error } = await supabase
    .from("products")
    .insert(payload)
    .select("id")
    .single();
  if (error || !created) {
    console.warn(`[seed-cigars-api] insert failed for "${cigar.name}":`, error?.message);
    return "skipped";
  }

  if (cigar.description) {
    await supabase.from("product_reviews").insert({
      product_id: created.id,
      source: "cigar-api",
      text: cigar.description,
    });
  }

  return "inserted";
}

main().catch((err) => {
  console.error("[seed-cigars-api] failed:", err);
  process.exit(1);
});
