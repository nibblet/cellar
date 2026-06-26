/**
 * Structured specs extraction — CLI wrapper.
 *
 * Run after enrich-web. Bourbon defaults to tier order so shelf staples
 * get structured specs before allocated bottles.
 *
 *   pnpm seed:enrich-specs --type bourbon --limit 100
 *   pnpm seed:enrich-specs --type bourbon --limit 100 --order updated
 *   pnpm seed:enrich-specs --type cigar --limit 5 --dry-run
 *   pnpm seed:enrich-specs --type bourbon --limit 100 --catalog-only
 *
 * Flags:
 *   --catalog-only   only catalog_included=true (member-facing / REVIEW_keep=Y)
 *   --keep           alias for --catalog-only
 */

import { mkdirSync, appendFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import OpenAI from "openai";
import { extractAndMergeSpecs } from "@/lib/enrich/specs-enrich";
import {
  type EnrichCatalogScope,
  enrichCatalogScopeLabel,
  parseEnrichCatalogScope,
} from "./lib/enrich-catalog-scope";
import {
  type EnrichOrder,
  parseEnrichOrder,
  sortByTier,
  tierOrderFetchLimit,
} from "./lib/enrich-order";
import { adminClient } from "./lib/supabase-admin";

type Args = {
  type: "bourbon" | "cigar";
  limit: number;
  dryRun: boolean;
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
    order: parseEnrichOrder(argv, type),
    catalogScope: parseEnrichCatalogScope(argv),
  };
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
    `[enrich-specs] type=${args.type} limit=${args.limit} order=${args.order} scope=${enrichCatalogScopeLabel(args.catalogScope)} dryRun=${args.dryRun}`,
  );
  console.log(`[enrich-specs] audit log → ${audit}`);

  const fetchLimit = args.order === "tier" ? tierOrderFetchLimit(args.limit) : args.limit;

  let query = supa
    .from("products")
    .select("id, type, name, brand, specs, product_reviews!inner(text)")
    .eq("type", args.type);
  if (args.catalogScope === "catalog-only") {
    query = query.eq("catalog_included", true);
  }

  if (args.order === "updated") {
    query = query.order("updated_at", { ascending: false });
  } else if (args.order === "name") {
    query = query.order("name", { ascending: true });
  } else if (args.order === "tier") {
    query = query
      .order("specs->tier", { ascending: true, nullsFirst: false })
      .order("name", { ascending: true });
  } else {
    query = query.order("created_at", { ascending: true });
  }

  const { data: rawProducts, error } = await query.limit(fetchLimit);

  if (error) throw error;

  type ProductRow = {
    id: string;
    type: "bourbon" | "cigar";
    name: string;
    brand: string | null;
    specs: Record<string, unknown> | null;
  };

  let products = (rawProducts ?? []) as ProductRow[];
  if (args.order === "tier") {
    products = sortByTier(products).slice(0, args.limit);
  } else {
    products = products.slice(0, args.limit);
  }

  if (!products.length) {
    console.log("[enrich-specs] nothing to enrich.");
    return;
  }

  let patched = 0;
  let totalIn = 0;
  let totalOut = 0;

  for (const row of products) {
    const tier = row.specs?.tier;
    const tierLabel = typeof tier === "number" ? ` tier=${tier}` : "";
    console.log(`\n• ${row.brand ?? ""} ${row.name} (${row.id.slice(0, 8)})${tierLabel}`);

    const result = await extractAndMergeSpecs(
      row,
      { openai, supabase: supa },
      { dryRun: args.dryRun },
    );

    appendFileSync(audit, `${JSON.stringify(result)}\n`);

    if (result.error) {
      console.error("  error:", result.error);
      continue;
    }

    totalIn += result.tokensIn;
    totalOut += result.tokensOut;
    console.log(`  extracted ${result.fieldsExtracted} fields`);
    if (result.fieldsFilled.length) {
      console.log(`  new: ${result.fieldsFilled.join(", ")}`);
    }
    if (!args.dryRun) patched++;
  }

  console.log(
    `\n[enrich-specs] done. patched=${patched} tokens_in=${totalIn} tokens_out=${totalOut}`,
  );
}

main().catch((err) => {
  console.error("[enrich-specs] failed:", err);
  process.exit(1);
});
