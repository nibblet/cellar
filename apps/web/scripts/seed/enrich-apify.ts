/**
 * Apify-driven enrichment pass — CLI wrapper.
 *
 * The per-product logic lives in @/lib/enrich so it can be shared with the
 * capture server action. This script just iterates products that need
 * enrichment and calls the shared function with an audit-log shim.
 *
 *   pnpm seed:enrich-apify --type cigar --limit 5 --dry-run
 *   pnpm seed:enrich-apify --type bourbon --limit 50
 *   pnpm seed:enrich-apify --type cigar --limit 5 --backfill
 *
 * Flags:
 *   --type      bourbon | cigar              (required)
 *   --limit     how many products to enrich  (default 5)
 *   --dry-run   no DB writes, audit only     (default false)
 *   --max       results per Apify query      (default 3)
 *   --backfill  re-process products whose image_url points outside Supabase
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
import { adminClient } from "./lib/supabase-admin";

type Args = {
  type: "bourbon" | "cigar";
  limit: number;
  dryRun: boolean;
  max: number;
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

  const baseQuery = supa
    .from("products")
    .select("id, type, name, brand, line")
    .eq("type", args.type)
    .order("created_at", { ascending: true })
    .limit(args.limit);
  const filtered = args.backfill
    ? baseQuery.not("image_url", "ilike", "%supabase.co/storage%")
    : baseQuery.is("image_url", null);
  const { data: products, error } = await filtered;

  if (error) throw error;
  if (!products?.length) {
    console.log("[enrich-apify] nothing to enrich.");
    return;
  }

  let imageWrites = 0;
  let reviewWrites = 0;

  for (const p of products as EnrichInput[]) {
    console.log(`\n• ${p.brand ?? ""} ${p.name} (${p.id.slice(0, 8)})`);
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
