/**
 * Seed the products table with cigars by paging through Halfwheel's RSS
 * feed and extracting structured metadata via gpt-5-nano.
 *
 * Usage:
 *   pnpm seed:cigars [target_count]
 *
 * Defaults to 50 cigars (a quick verification run). Pass a number to
 * grow the seed:
 *   pnpm seed:cigars 500
 *
 * Each review costs ~$0.001-0.002 in OpenAI usage. 500 cigars ≈ $1.
 *
 * Idempotent: existing products matched by (type, brand, name) are
 * updated instead of duplicated. Review prose is stored in
 * product_reviews for the future descriptor-enrichment pass.
 *
 * License note: this ingests Halfwheel's RSS feed which is published
 * for syndication. We extract factual product metadata (brand, vitola,
 * country) which is not copyrightable, and store the review prose as
 * private admin-only data per the product_reviews RLS policy.
 */

import { extractCigar } from "./lib/cigar-extractor";
import { fetchHalfwheelReviews } from "./lib/halfwheel-rss";
import { adminClient } from "./lib/supabase-admin";

export {};

const DEFAULT_TARGET = 50;
const WHEEL_VERSION = "0.1";

async function main() {
  const target = Number(process.argv[2]) || DEFAULT_TARGET;
  console.log(`[seed-cigars] target = ${target} cigars`);

  const supabase = adminClient();

  console.log("[seed-cigars] fetching Halfwheel RSS pages...");
  const items = await fetchHalfwheelReviews(target * 2); // some items won't parse as cigars
  console.log(`[seed-cigars] fetched ${items.length} RSS items`);

  let inserted = 0;
  let updated = 0;
  let skipped = 0;

  for (const item of items) {
    if (inserted + updated >= target) break;

    let extracted: Awaited<ReturnType<typeof extractCigar>>;
    try {
      extracted = await extractCigar(item.title, item.description || item.content);
    } catch (err) {
      console.warn(`[seed-cigars] LLM extract failed for "${item.title}":`, err);
      skipped += 1;
      continue;
    }

    if (!extracted) {
      skipped += 1;
      continue;
    }

    const specs = {
      vitola: extracted.vitola,
      country: extracted.country,
      wrapper_color: extracted.wrapper,
      strength: extracted.strength,
      year: extracted.year,
      review_url: item.link,
      review_published: item.pubDate,
    };

    const { data: existing } = await supabase
      .from("products")
      .select("id")
      .eq("type", "cigar")
      .eq("name", extracted.product_name)
      .eq("brand", extracted.brand ?? "")
      .maybeSingle();

    const payload = {
      type: "cigar" as const,
      name: extracted.product_name,
      brand: extracted.brand,
      line: extracted.line,
      specs,
      wheel_version: WHEEL_VERSION,
      status: "confirmed" as const,
      source: "seed" as const,
    };

    if (existing) {
      const { error } = await supabase.from("products").update(payload).eq("id", existing.id);
      if (error) {
        console.warn(`[seed-cigars] update failed for ${extracted.product_name}:`, error.message);
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
        console.warn(`[seed-cigars] insert failed for ${extracted.product_name}:`, error?.message);
        skipped += 1;
        continue;
      }
      inserted += 1;

      if (item.content || item.description) {
        await supabase.from("product_reviews").insert({
          product_id: created.id,
          source: "halfwheel",
          source_url: item.link,
          text: item.content || item.description,
        });
      }
    }

    // Polite throttle on the LLM side.
    await new Promise((r) => setTimeout(r, 200));
  }

  console.log(`[seed-cigars] done. inserted=${inserted} updated=${updated} skipped=${skipped}`);
}

main().catch((err) => {
  console.error("[seed-cigars] failed:", err);
  process.exit(1);
});
