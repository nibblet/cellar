/**
 * Apify-driven enrichment pass — CLI wrapper.
 *
 * Recommended bourbon pipeline: run enrich-bourbon-tier on the full catalog
 * first, then Apify in tier order (default for bourbon) so shelf staples
 * get photos before allocated unicorns.
 *
 *   pnpm seed:enrich-apify --type bourbon --limit 100
 *   pnpm seed:enrich-apify --type bourbon --limit 100 --order created
 *   pnpm seed:enrich-apify --type cigar --limit 5 --dry-run
 *
 * Flags:
 *   --type      bourbon | cigar              (required)
 *   --limit     how many products to enrich  (default 5)
 *   --order     created | tier | name        (default: tier for bourbon, created for cigar)
 *   --dry-run   no DB writes, audit only     (default false)
 *   --max       results per Apify query      (default 3)
 *   --backfill       re-process products whose image_url points outside Supabase
 *   --catalog-only   only catalog_included=true (member-facing / REVIEW_keep=Y)
 *   --keep           alias for --catalog-only
 */

import { mkdirSync, appendFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import OpenAI from "openai";
import { ApifyClient } from "@/lib/enrich/apify-client";
import {
  type EnrichInput,
  buildSearchQuery,
  enrichProductFromWeb,
} from "@/lib/enrich/apify-enrich";
import {
  type EnrichCatalogScope,
  enrichCatalogScopeLabel,
  parseEnrichCatalogScope,
} from "./lib/enrich-catalog-scope";
import { type EnrichOrder, parseEnrichOrder, sortByTier } from "./lib/enrich-order";
import { adminClient } from "./lib/supabase-admin";

type Args = {
  type: "bourbon" | "cigar";
  limit: number;
  dryRun: boolean;
  max: number;
  backfill: boolean;
  order: EnrichOrder;
  catalogScope: EnrichCatalogScope;
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
    order: parseEnrichOrder(argv, type),
    catalogScope: parseEnrichCatalogScope(argv),
  };
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
    `[enrich-apify] type=${args.type} limit=${args.limit} order=${args.order} scope=${enrichCatalogScopeLabel(args.catalogScope)} dryRun=${args.dryRun}`,
  );
  console.log(`[enrich-apify] audit log → ${audit}`);

  let query = supa
    .from("products")
    .select("id, type, name, brand, line, specs")
    .eq("type", args.type);
  if (args.catalogScope === "catalog-only") {
    query = query.eq("catalog_included", true);
  }
  if (args.backfill) {
    query = query.not("image_url", "ilike", "%supabase.co/storage%");
  } else {
    query = query.is("image_url", null);
  }

  if (args.order === "tier") {
    query = query
      .order("specs->tier", { ascending: true, nullsFirst: false })
      .order("name", { ascending: true });
  } else if (args.order === "name") {
    query = query.order("name", { ascending: true });
  } else {
    query = query.order("created_at", { ascending: true });
  }

  const { data: rawProducts, error } = await query.limit(args.limit);

  if (error) throw error;
  const products =
    args.order === "tier"
      ? sortByTier(
          (rawProducts ?? []) as Array<EnrichInput & { specs: Record<string, unknown> | null }>,
        ).slice(0, args.limit)
      : ((rawProducts ?? []) as EnrichInput[]);
  if (!products?.length) {
    console.log("[enrich-apify] nothing to enrich.");
    return;
  }

  let imageWrites = 0;
  let reviewWrites = 0;

  for (const p of products) {
    const tier = (p as EnrichInput & { specs?: Record<string, unknown> | null }).specs?.tier;
    const tierLabel = typeof tier === "number" ? ` tier=${tier}` : "";
    console.log(`\n• ${p.brand ?? ""} ${p.name} (${p.id.slice(0, 8)})${tierLabel}`);
    console.log(`  query: ${buildSearchQuery(p)}`);

    const result = await enrichProductFromWeb(
      p,
      { apify, openai, supabase: supa },
      { maxResults: args.max, dryRun: args.dryRun },
    );

    appendFileSync(audit, `${JSON.stringify(result)}\n`);

    if (result.apifyError) {
      console.error("  apify failed:", result.apifyError);
      continue;
    }

    const tag = result.llmFallbackUsed ? " [llm]" : "";
    console.log(`  image: ${result.imageUrl ?? "(none picked)"}${tag}`);
    console.log(`  reviews: ${result.reviewsWritten}`);

    if (result.imageUrl && !args.dryRun) imageWrites++;
    reviewWrites += result.reviewsWritten;

    if (result.mirrorError) {
      console.error(`  mirror failed: ${result.mirrorError}`);
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
