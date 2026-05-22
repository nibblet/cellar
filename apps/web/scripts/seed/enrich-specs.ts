/**
 * Structured specs extraction — CLI wrapper.
 *
 * Iterates products that have product_reviews, calls the shared
 * extractAndMergeSpecs from @/lib/enrich for each, and writes an audit log.
 *
 *   pnpm seed:enrich-specs --type cigar --limit 5 --dry-run
 *   pnpm seed:enrich-specs --type bourbon --limit 50
 */

import { mkdirSync, appendFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import OpenAI from "openai";
import { extractAndMergeSpecs } from "@/lib/enrich/specs-enrich";
import { adminClient } from "./lib/supabase-admin";

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

  // Products with at least one product_reviews row, most recently updated
  // first. The inner-join semantics skip rows without reviews.
  const { data: products, error } = await supa
    .from("products")
    .select("id, type, name, brand, specs, product_reviews!inner(text)")
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

  for (const row of products as Array<{
    id: string;
    type: "bourbon" | "cigar";
    name: string;
    brand: string | null;
    specs: Record<string, unknown> | null;
  }>) {
    console.log(`\n• ${row.brand ?? ""} ${row.name} (${row.id.slice(0, 8)})`);

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
