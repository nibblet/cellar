/**
 * Bourbon allocation/rarity tier enrichment — LLM batch pass.
 *
 * Recommended pipeline (bourbon):
 *   1. pnpm seed:enrich-bourbon-tier --limit 2500        # fast nano pass on full catalog
 *   2. pnpm seed:enrich-web --type bourbon --limit 100 --catalog-only
 *   3. pnpm seed:enrich-specs --type bourbon --limit 100 --catalog-only
 *
 *   pnpm seed:enrich-bourbon-tier --limit 20 --dry-run
 *   pnpm seed:enrich-bourbon-tier --limit 2500
 *   pnpm seed:enrich-bourbon-tier --limit 50 --force
 */

import { appendFileSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import OpenAI from "openai";
import {
  classifyAndMergeBourbonTier,
  tierToRarityLabel,
} from "@/lib/enrich/bourbon-tier";
import { adminClient } from "./lib/supabase-admin";

type Args = {
  limit: number;
  dryRun: boolean;
  force: boolean;
};

function parseArgs(argv: string[]): Args {
  const arg = (k: string) => {
    const i = argv.indexOf(`--${k}`);
    return i >= 0 ? argv[i + 1] : undefined;
  };
  return {
    limit: Number(arg("limit") ?? 5),
    dryRun: argv.includes("--dry-run"),
    force: argv.includes("--force"),
  };
}

function logPath(): string {
  const ts = new Date().toISOString().replace(/[:.]/g, "-");
  return resolve(process.cwd(), `scripts/seed/data/private/tier-${ts}.jsonl`);
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
    `[enrich-bourbon-tier] limit=${args.limit} dryRun=${args.dryRun} force=${args.force}`,
  );
  console.log(`[enrich-bourbon-tier] audit log → ${audit}`);

  // Untiered rows first so a partial run still advances the catalog.
  const { data: products, error } = await supa
    .from("products")
    .select("id, name, brand, specs")
    .eq("type", "bourbon")
    .eq("status", "confirmed")
    .order("specs->tier", { ascending: true, nullsFirst: true })
    .order("name")
    .limit(args.limit);

  if (error) throw error;
  if (!products?.length) {
    console.log("[enrich-bourbon-tier] nothing to enrich.");
    return;
  }

  let patched = 0;
  let skipped = 0;
  let totalIn = 0;
  let totalOut = 0;

  for (const row of products as Array<{
    id: string;
    name: string;
    brand: string | null;
    specs: Record<string, unknown> | null;
  }>) {
    console.log(`\n• ${row.brand ?? ""} ${row.name} (${row.id.slice(0, 8)})`);

    const result = await classifyAndMergeBourbonTier(row, openai, {
      dryRun: args.dryRun,
      force: args.force,
    });

    const auditRow = {
      productId: result.productId,
      name: row.name,
      brand: row.brand,
      skipped: result.skipped,
      tier: result.tier,
      rarity: result.tier != null ? tierToRarityLabel(result.tier) : null,
      rationale: result.rationale,
      tokensIn: result.tokensIn,
      tokensOut: result.tokensOut,
      error: result.error,
      dryRun: args.dryRun,
    };
    appendFileSync(audit, `${JSON.stringify(auditRow)}\n`);

    if (result.skipped) {
      skipped += 1;
      console.log(`  skip: ${result.skipped}`);
      continue;
    }
    if (result.error) {
      console.error("  error:", result.error);
      continue;
    }

    totalIn += result.tokensIn;
    totalOut += result.tokensOut;
    console.log(`  tier ${result.tier} (${tierToRarityLabel(result.tier!)})`);
    console.log(`  ${result.rationale}`);

    if (!args.dryRun && result.mergedSpecs) {
      const { error: updErr } = await supa
        .from("products")
        .update({ specs: result.mergedSpecs })
        .eq("id", row.id);
      if (updErr) {
        console.error("  update:", updErr.message);
        continue;
      }
      patched += 1;
    } else if (args.dryRun) {
      patched += 1;
    }
  }

  console.log(
    `\n[enrich-bourbon-tier] done. patched=${patched} skipped=${skipped} tokens_in=${totalIn} tokens_out=${totalOut}`,
  );
}

main().catch((err) => {
  console.error("[enrich-bourbon-tier] failed:", err);
  process.exit(1);
});
