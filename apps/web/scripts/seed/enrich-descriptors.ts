/**
 * Wheel-vector extraction from product_reviews via gpt-5-nano.
 *
 * Targets products with reviews but an empty wheel_vector — typically
 * post-Apify cigars outside the StickPicks seed path, or manual catalog adds.
 *
 *   pnpm seed:enrich --type cigar
 *   pnpm seed:enrich --type cigar --limit 20 --dry-run
 */

import { mkdirSync, appendFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import OpenAI from "openai";
import { extractAndMergeWheelVector } from "@/lib/enrich/wheel-enrich";
import type { WheelVector } from "@/lib/wheel";
import { adminClient } from "./lib/supabase-admin";

type Args = {
  type: "bourbon" | "cigar";
  limit: number;
  dryRun: boolean;
};

type ProductRow = {
  id: string;
  type: "bourbon" | "cigar";
  name: string;
  brand: string | null;
  wheel_vector: WheelVector | null;
  specs: Record<string, unknown> | null;
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
    limit: Number(arg("limit") ?? 500),
    dryRun: argv.includes("--dry-run"),
  };
}

function isEmptyWheel(vector: WheelVector | null | undefined): boolean {
  if (vector == null) return true;
  return Object.keys(vector).length === 0;
}

function logPath(type: string): string {
  const ts = new Date().toISOString().replace(/[:.]/g, "-");
  return resolve(process.cwd(), `scripts/seed/data/private/wheel-${type}-${ts}.jsonl`);
}

async function fetchCandidates(type: "bourbon" | "cigar"): Promise<ProductRow[]> {
  const supa = adminClient();
  const out: ProductRow[] = [];

  for (let from = 0; ; from += 500) {
    const { data, error } = await supa
      .from("products")
      .select("id, type, name, brand, wheel_vector, specs, product_reviews!inner(id)")
      .eq("type", type)
      .eq("status", "confirmed")
      .order("name", { ascending: true })
      .range(from, from + 499);

    if (error) throw error;
    if (!data?.length) break;

    for (const row of data as ProductRow[]) {
      if (isEmptyWheel(row.wheel_vector)) out.push(row);
    }
  }

  return out;
}

async function clearEnrichmentPending(productId: string): Promise<void> {
  const supa = adminClient();
  const { data } = await supa.from("products").select("specs").eq("id", productId).single();
  const specs = data?.specs as Record<string, unknown> | null;
  if (!specs || specs.enrichment_pending !== true) return;

  const next = { ...specs };
  delete next.enrichment_pending;
  await supa.from("products").update({ specs: next }).eq("id", productId);
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const openaiKey = process.env.OPENAI_API_KEY;
  if (!openaiKey) throw new Error("Missing OPENAI_API_KEY in env");

  const openai = new OpenAI({ apiKey: openaiKey });
  const supa = adminClient();
  const audit = logPath(args.type);
  mkdirSync(dirname(audit), { recursive: true });

  const candidates = await fetchCandidates(args.type);
  const batch = candidates.slice(0, args.limit);

  console.log(
    `[enrich-descriptors] type=${args.type} candidates=${candidates.length} running=${batch.length} dryRun=${args.dryRun}`,
  );
  console.log(`[enrich-descriptors] audit log → ${audit}`);

  if (!batch.length) {
    console.log("[enrich-descriptors] nothing to enrich.");
    return;
  }

  let patched = 0;
  let skipped = 0;
  let failed = 0;
  let totalIn = 0;
  let totalOut = 0;

  for (const row of batch) {
    console.log(`\n• ${row.brand ?? ""} ${row.name} (${row.id.slice(0, 8)})`);

    const result = await extractAndMergeWheelVector(
      {
        id: row.id,
        type: row.type,
        name: row.name,
        brand: row.brand,
        wheel_vector: row.wheel_vector,
      },
      { openai, supabase: supa },
      { dryRun: args.dryRun },
    );

    appendFileSync(audit, `${JSON.stringify(result)}\n`);
    totalIn += result.tokensIn;
    totalOut += result.tokensOut;

    if (result.error) {
      console.error("  error:", result.error);
      failed += 1;
      continue;
    }

    if (result.leavesFilled === 0) {
      console.log("  no leaves extracted");
      skipped += 1;
      continue;
    }

    console.log(`  leaves=${result.leavesFilled} tokens=${result.tokensIn}+${result.tokensOut}`);

    if (!args.dryRun) {
      await clearEnrichmentPending(row.id);
      patched += 1;
    }
  }

  console.log(
    `\n[enrich-descriptors] done. patched=${patched} skipped=${skipped} failed=${failed} tokens_in=${totalIn} tokens_out=${totalOut}`,
  );
}

main().catch((err) => {
  console.error("[enrich-descriptors] failed:", err);
  process.exit(1);
});
