/**
 * One-shot: restore apostrophes in already-seeded bourbon names.
 *
 * BourbonData.csv lost apostrophes upstream ("Jefferson's" → "Jefferson s",
 * "Tasters'" → "Tasters "). The parser now restores them on future seeds,
 * but existing rows in products need a backfill.
 *
 * Idempotent: re-running on clean rows is a no-op.
 *
 * Usage:
 *   pnpm repair:bourbon-apostrophes --dry-run    # show what would change
 *   pnpm repair:bourbon-apostrophes              # apply
 */

import { restoreLostApostrophes } from "./lib/bourbon-parser";
import { adminClient } from "./lib/supabase-admin";

async function main() {
  const dryRun = process.argv.includes("--dry-run");
  const supabase = adminClient();

  const { data: rows, error } = await supabase
    .from("products")
    .select("id, name")
    .eq("type", "bourbon");
  if (error) throw error;

  const affected = (rows ?? [])
    .map((r) => ({ id: r.id as string, name: r.name as string, fixed: restoreLostApostrophes(r.name as string) }))
    .filter((r) => r.fixed !== r.name);

  console.log(`[repair-bourbon-apostrophes] ${affected.length} row(s) need repair`);
  for (const r of affected) {
    console.log(`  ${r.name}  →  ${r.fixed}`);
  }

  if (dryRun || affected.length === 0) return;

  for (const r of affected) {
    const { error: updErr } = await supabase
      .from("products")
      .update({ name: r.fixed })
      .eq("id", r.id);
    if (updErr) throw updErr;
  }
  console.log(`[repair-bourbon-apostrophes] updated ${affected.length} row(s)`);
}

main().catch((err) => {
  console.error("[repair-bourbon-apostrophes] failed:", err);
  process.exit(1);
});
