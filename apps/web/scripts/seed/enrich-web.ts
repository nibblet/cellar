/**
 * OpenAI web-search enrichment pass — CLI wrapper.
 *
 * Recommended bourbon pipeline: run enrich-bourbon-tier on the full catalog
 * first, then enrich-web in tier order (default for bourbon) so shelf staples
 * get photos before allocated unicorns.
 *
 *   pnpm seed:enrich-web --type bourbon --limit 100
 *   pnpm seed:enrich-web --type bourbon --limit 100 --order created
 *   pnpm seed:enrich-web --type cigar --limit 5 --dry-run
 *
 * Flags:
 *   --type      bourbon | cigar              (required)
 *   --limit     how many products to enrich  (default 5)
 *   --order     created | tier | name        (default: tier for bourbon, created for cigar)
 *   --dry-run   no DB writes, audit only     (default false)
 *   --backfill       re-process products whose image_url points outside Supabase
 *   --catalog-only   only catalog_included=true (member-facing / REVIEW_keep=Y)
 *   --keep           alias for --catalog-only
 */

import { mkdirSync, appendFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import OpenAI from "openai";
import {
  type EnrichInput,
  buildSearchQuery,
  enrichProductFromWeb,
} from "@/lib/enrich/web-enrich";
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
  const openaiKey = process.env.OPENAI_API_KEY;
  if (!openaiKey) throw new Error("Missing OPENAI_API_KEY in env");

  const openai = new OpenAI({ apiKey: openaiKey });
  const supa = adminClient();
  const audit = logPath();
  mkdirSync(dirname(audit), { recursive: true });

  console.log(
    `[enrich-web] type=${args.type} limit=${args.limit} order=${args.order} scope=${enrichCatalogScopeLabel(args.catalogScope)} dryRun=${args.dryRun}`,
  );
  console.log(`[enrich-web] audit log → ${audit}`);

  let query = supa
    .from("products")
    .select("id, type, name, brand, line, specs, wheel_vector")
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
      : ((rawProducts ?? []) as Array<
          EnrichInput & {
            specs: Record<string, unknown> | null;
            wheel_vector: Record<string, number> | null;
          }
        >);
  if (!products?.length) {
    console.log("[enrich-web] nothing to enrich.");
    return;
  }

  let imageWrites = 0;
  let specsWrites = 0;

  for (const p of products) {
    const tier = p.specs?.tier;
    const tierLabel = typeof tier === "number" ? ` tier=${tier}` : "";
    console.log(`\n• ${p.brand ?? ""} ${p.name} (${p.id.slice(0, 8)})${tierLabel}`);
    console.log(`  query: ${buildSearchQuery(p)}`);

    const result = await enrichProductFromWeb(
      p,
      { openai, supabase: supa },
      { dryRun: args.dryRun },
    );

    appendFileSync(audit, `${JSON.stringify(result)}\n`);

    if (result.searchError) {
      console.error("  search failed:", result.searchError);
      continue;
    }

    console.log(`  image: ${result.imageUrl ?? "(none picked)"}`);
    console.log(`  specs filled: ${result.specsFieldsFilled.join(", ") || "(none)"}`);
    console.log(`  wheel leaves: ${result.wheelLeavesFilled}`);

    if (result.imageUrl && !args.dryRun) imageWrites++;
    if (result.specsFieldsFilled.length && !args.dryRun) specsWrites++;

    if (result.mirrorError) {
      console.error(`  mirror failed: ${result.mirrorError}`);
    }
  }

  console.log(`\n[enrich-web] done. images=${imageWrites} specs=${specsWrites}`);
}

main().catch((err) => {
  console.error("[enrich-web] failed:", err);
  process.exit(1);
});
