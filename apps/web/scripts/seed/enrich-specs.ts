/**
 * Extract structured specs from already-captured product_reviews.text and
 * merge into products.specs. Runs against rows we've already enriched via
 * enrich-apify.ts — no new Apify calls, no internet beyond OpenAI.
 *
 * Usage:
 *   pnpm seed:enrich-specs --type cigar --limit 5 --dry-run
 *   pnpm seed:enrich-specs --type bourbon --limit 50
 *
 * Flags:
 *   --type      bourbon | cigar               (required)
 *   --limit     how many products to enrich   (default 5)
 *   --dry-run   no DB writes, audit only      (default false)
 *
 * Merge policy: existing non-null fields in products.specs win — extracted
 * values only fill gaps. This makes the pass safe to re-run and won't clobber
 * facts that came from the original seed import.
 */

import { mkdirSync, appendFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import OpenAI from "openai";
import {
  extractSpecs,
  type CigarSpecs,
  type BourbonSpecs,
} from "./lib/specs-extractor";
import { adminClient } from "./lib/supabase-admin";

type ProductRow = {
  id: string;
  type: "bourbon" | "cigar";
  name: string;
  brand: string | null;
  specs: Record<string, unknown> | null;
};

type Args = {
  type: "bourbon" | "cigar";
  limit: number;
  dryRun: boolean;
};

function parseArgs(argv: string[]): Args {
  const arg = (k: string) => {
    const i = argv.indexOf(`--${k}`);
    return i >= 0 ? argv[i + 1] : undefined;
  };
  const type = arg("type");
  if (type !== "bourbon" && type !== "cigar") {
    throw new Error("--type must be 'bourbon' or 'cigar'");
  }
  return {
    type,
    limit: Number(arg("limit") ?? 5),
    dryRun: argv.includes("--dry-run"),
  };
}

/**
 * Concatenate the two longest review bodies. Halfwheel and Cigar Aficionado
 * carry the structured spec block in the body; shorter sources (shopping
 * pages, social) rarely add new facts and just spend tokens.
 */
function joinReviews(reviews: Array<{ source: string; text: string }>): string {
  const sorted = [...reviews].sort((a, b) => b.text.length - a.text.length);
  return sorted
    .slice(0, 2)
    .map((r) => `=== ${r.source} ===\n${r.text}`)
    .join("\n\n");
}

/**
 * Non-destructive merge: only fill keys that are null/missing/empty-string
 * in the existing specs. Skips null values from the extraction so we never
 * overwrite a real fact with "we don't know".
 */
function mergeSpecs(
  existing: Record<string, unknown> | null,
  extracted: Record<string, unknown>,
): Record<string, unknown> {
  const out: Record<string, unknown> = { ...(existing ?? {}) };
  for (const [k, v] of Object.entries(extracted)) {
    if (v === null || v === undefined || v === "") continue;
    const cur = out[k];
    if (cur === null || cur === undefined || cur === "") out[k] = v;
  }
  return out;
}

function logPath(): string {
  const ts = new Date().toISOString().replace(/[:.]/g, "-");
  return resolve(
    process.cwd(),
    `scripts/seed/data/private/specs-${ts}.jsonl`,
  );
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const openaiKey = process.env.OPENAI_API_KEY;
  if (!openaiKey) throw new Error("Missing OPENAI_API_KEY in env");
  const openai = new OpenAI({ apiKey: openaiKey });
  const supa = adminClient();
  const audit = logPath();
  mkdirSync(dirname(audit), { recursive: true });

  console.log(
    `[enrich-specs] type=${args.type} limit=${args.limit} dryRun=${args.dryRun}`,
  );
  console.log(`[enrich-specs] audit log → ${audit}`);

  // Only products that actually have reviews to extract from. We rely on the
  // inner join via the FK; products without product_reviews are skipped.
  const { data: products, error } = await supa
    .from("products")
    .select("id, type, name, brand, specs, product_reviews!inner(text, source)")
    .eq("type", args.type)
    .order("updated_at", { ascending: false })
    .limit(args.limit);

  if (error) throw error;
  if (!products?.length) {
    console.log("[enrich-specs] nothing to enrich.");
    return;
  }

  let patched = 0;
  let totalIn = 0;
  let totalOut = 0;

  for (const row of products as (ProductRow & {
    product_reviews: Array<{ text: string; source: string }>;
  })[]) {
    console.log(`\n• ${row.brand ?? ""} ${row.name} (${row.id.slice(0, 8)})`);
    const reviewText = joinReviews(row.product_reviews);
    if (!reviewText.trim()) {
      console.log("  no review text — skip");
      continue;
    }

    try {
      const result =
        args.type === "cigar"
          ? await extractSpecs<CigarSpecs>(openai, {
              productType: "cigar",
              productName: row.name,
              brand: row.brand,
              reviewText,
            })
          : await extractSpecs<BourbonSpecs>(openai, {
              productType: "bourbon",
              productName: row.name,
              brand: row.brand,
              reviewText,
            });

      totalIn += result.tokensIn;
      totalOut += result.tokensOut;

      const merged = mergeSpecs(row.specs, result.specs);
      const newKeys = Object.keys(result.specs).filter(
        (k) =>
          (result.specs as Record<string, unknown>)[k] !== null &&
          (row.specs?.[k] === null || row.specs?.[k] === undefined),
      );

      appendFileSync(
        audit,
        `${JSON.stringify({
          productId: row.id,
          extracted: result.specs,
          newKeys,
        })}\n`,
      );

      console.log(
        `  extracted ${Object.values(result.specs).filter((v) => v !== null).length}/${Object.keys(result.specs).length} fields`,
      );
      if (newKeys.length) console.log(`  new: ${newKeys.join(", ")}`);

      if (args.dryRun) continue;

      const { error: updErr } = await supa
        .from("products")
        .update({ specs: merged })
        .eq("id", row.id);
      if (updErr) console.error("  update failed:", updErr.message);
      else patched++;
    } catch (err) {
      console.error("  extract failed:", (err as Error).message);
    }
  }

  console.log(
    `\n[enrich-specs] done. patched=${patched} tokens_in=${totalIn} tokens_out=${totalOut}`,
  );
}

main().catch((err) => {
  console.error("[enrich-specs] failed:", err);
  process.exit(1);
});
