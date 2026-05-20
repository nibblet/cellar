/**
 * One-shot: push the bundled flavor wheel JSONs into the flavor_wheels table.
 * Idempotent — re-running with the same version is a no-op (primary key conflict
 * is upserted).
 *
 * Run:  pnpm seed:wheels
 */

import { getWheel } from "@/lib/wheel";
import { adminClient } from "./lib/supabase-admin";

async function main() {
  const supabase = adminClient();

  for (const type of ["cigar", "bourbon"] as const) {
    const wheel = getWheel(type);
    const { error } = await supabase
      .from("flavor_wheels")
      .upsert({ version: wheel.version, type, json: wheel });
    if (error) throw error;
    console.log(`[seed-wheels] upserted ${type} wheel v${wheel.version}`);
  }
}

main().catch((err) => {
  console.error("[seed-wheels] failed:", err);
  process.exit(1);
});
