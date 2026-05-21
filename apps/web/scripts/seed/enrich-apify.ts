/**
 * Apify-driven enrichment pass — prototype.
 *
 * Pulls products missing an image_url, asks Apify's rag-web-browser actor for
 * a few search results per product, picks a hero image candidate, and inserts
 * the cleaned review markdown into product_reviews.
 *
 * Designed to be run on a small slice first. Always start with --dry-run and
 * eyeball the audit log before letting it write.
 *
 *   pnpm seed:enrich-apify --type cigar --limit 5 --dry-run
 *   pnpm seed:enrich-apify --type bourbon --limit 5
 *
 * Flags:
 *   --type      bourbon | cigar              (required)
 *   --limit     how many products to enrich  (default 5)
 *   --dry-run   no DB writes, audit only     (default false)
 *   --max       results per Apify query      (default 3)
 *
 * Writes an audit log to scripts/seed/data/private/enrichment-<ts>.jsonl
 * regardless of dry-run.
 */

import { mkdirSync, appendFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import OpenAI from "openai";
import { ApifyClient } from "./lib/apify-client";
import { extractEnrichment } from "./lib/apify-extractor";
import { pickImageWithLlm } from "./lib/llm-image-picker";
import { mirrorImage, MirrorError } from "./lib/storage-mirror";
import { adminClient } from "./lib/supabase-admin";

type ProductRow = {
  id: string;
  type: "bourbon" | "cigar";
  name: string;
  brand: string | null;
  line: string | null;
};

type Args = {
  type: "bourbon" | "cigar";
  limit: number;
  dryRun: boolean;
  max: number;
  /** Re-process products whose image_url points outside Supabase Storage —
   *  useful for fixing up earlier rows that landed before the mirror step. */
  backfill: boolean;
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
    backfill: argv.includes("--backfill"),
    max: Number(arg("max") ?? 3),
  };
}

/**
 * Build a search query from brand/line/name, deduping overlapping tokens.
 *
 * The catalog is noisy: brand="Punch Rare Corojo" and name="Punch Rare Corojo
 * 25th Anniversary" naively joins to "Punch Rare Corojo Punch Rare Corojo
 * 25th Anniversary", which returns junk results. We keep tokens in source
 * order but drop case-insensitive duplicates.
 */
function buildQuery(p: ProductRow): string {
  const raw = [p.brand, p.line, p.name].filter(Boolean).join(" ");
  const seen = new Set<string>();
  const deduped: string[] = [];
  for (const tok of raw.split(/\s+/)) {
    const key = tok.toLowerCase().replace(/[^a-z0-9]/g, "");
    if (!key || seen.has(key)) continue;
    seen.add(key);
    deduped.push(tok);
  }
  const base = deduped.join(" ");
  return p.type === "cigar"
    ? `${base} cigar review`
    : `${base} bourbon review tasting notes`;
}

function logPath(): string {
  const ts = new Date().toISOString().replace(/[:.]/g, "-");
  return resolve(
    process.cwd(),
    `scripts/seed/data/private/enrichment-${ts}.jsonl`,
  );
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const token = process.env.APIFY_TOKEN;
  if (!token) throw new Error("Missing APIFY_TOKEN in env");
  const openaiKey = process.env.OPENAI_API_KEY;
  if (!openaiKey) throw new Error("Missing OPENAI_API_KEY in env");

  const apify = new ApifyClient(token);
  const openai = new OpenAI({ apiKey: openaiKey });
  const supa = adminClient();
  const audit = logPath();
  mkdirSync(dirname(audit), { recursive: true });

  console.log(
    `[enrich-apify] type=${args.type} limit=${args.limit} dryRun=${args.dryRun}`,
  );
  console.log(`[enrich-apify] audit log → ${audit}`);

  // In backfill mode, pick products whose image_url still points at the
  // upstream source (i.e., not at our Supabase Storage CDN). In normal mode,
  // only products with no image at all.
  const query = supa
    .from("products")
    .select("id, type, name, brand, line")
    .eq("type", args.type)
    .order("created_at", { ascending: true })
    .limit(args.limit);
  const filtered = args.backfill
    ? query.not("image_url", "ilike", "%supabase.co/storage%")
    : query.is("image_url", null);
  const { data: products, error } = await filtered;

  if (error) throw error;
  if (!products?.length) {
    console.log("[enrich-apify] nothing to enrich.");
    return;
  }

  let imageWrites = 0;
  let reviewWrites = 0;

  for (const p of products as ProductRow[]) {
    const query = buildQuery(p);
    console.log(`\n• ${p.brand ?? ""} ${p.name} (${p.id.slice(0, 8)})`);
    console.log(`  query: ${query}`);

    let items;
    try {
      items = await apify.ragWebBrowser({ query, maxResults: args.max });
    } catch (err) {
      console.error("  apify failed:", (err as Error).message);
      continue;
    }

    const enrichment = extractEnrichment(items, p);

    // LLM fallback: if heuristic found nothing, ask gpt-5-nano to pick from
    // the raw image URL list (logos and all). It returns an index or -1.
    let llmFallback: { used: boolean; reason?: string } = { used: false };
    if (!enrichment.imageUrl) {
      try {
        const llm = await pickImageWithLlm(openai, items, p);
        if (llm.imageUrl) {
          enrichment.imageUrl = llm.imageUrl;
          enrichment.imageSourceUrl = null; // LLM picked across items
          llmFallback = { used: true, reason: "heuristic empty" };
        }
      } catch (err) {
        console.error("  llm picker failed:", (err as Error).message);
      }
    }

    const record = { productId: p.id, query, enrichment, llmFallback };
    appendFileSync(audit, `${JSON.stringify(record)}\n`);

    console.log(
      `  image: ${enrichment.imageUrl ?? "(none picked)"}${
        llmFallback.used ? " [llm]" : ""
      }`,
    );
    if (enrichment.imageCandidates.length > 1) {
      console.log(
        `  image candidates (${enrichment.imageCandidates.length} considered):`,
      );
      for (const c of enrichment.imageCandidates.slice(0, 3)) {
        console.log(`    [${c.score}] ${c.url.slice(0, 110)}`);
      }
    }
    console.log(`  reviews: ${enrichment.reviews.length}`);
    for (const r of enrichment.reviews) {
      console.log(`    - ${r.source} :: ${r.title?.slice(0, 60) ?? ""}`);
    }

    if (args.dryRun) continue;

    if (enrichment.imageUrl) {
      try {
        const mirrored = await mirrorImage(supa, {
          sourceUrl: enrichment.imageUrl,
          productId: p.id,
          productType: p.type,
        });
        const { error: updErr } = await supa
          .from("products")
          .update({ image_url: mirrored.publicUrl })
          .eq("id", p.id);
        if (updErr) console.error("  image update failed:", updErr.message);
        else {
          imageWrites++;
          console.log(
            `  mirrored: ${mirrored.publicUrl} (${Math.round(mirrored.bytes / 1024)}kb)`,
          );
        }
      } catch (err) {
        const stage = err instanceof MirrorError ? err.stage : "unknown";
        console.error(`  mirror failed [${stage}]:`, (err as Error).message);
      }
    }

    if (enrichment.reviews.length) {
      const rows = enrichment.reviews.map((r) => ({
        product_id: p.id,
        source: r.source,
        source_url: r.sourceUrl,
        reviewer: null,
        score: null,
        text: r.text,
      }));
      const { error: insErr } = await supa.from("product_reviews").insert(rows);
      if (insErr) console.error("  reviews insert failed:", insErr.message);
      else reviewWrites += rows.length;
    }
  }

  console.log(
    `\n[enrich-apify] done. images=${imageWrites} reviews=${reviewWrites}`,
  );
}

main().catch((err) => {
  console.error("[enrich-apify] failed:", err);
  process.exit(1);
});
