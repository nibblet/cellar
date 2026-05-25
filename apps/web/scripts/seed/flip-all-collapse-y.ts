/**
 * Set curation_collapse=Y on all confirmed bourbon products.
 *
 *   pnpm flip:collapse-y
 *   pnpm flip:collapse-y --apply
 */

import { adminClient } from "./lib/supabase-admin";

async function main() {
  const apply = process.argv.includes("--apply");
  const supa = adminClient();

  const { data, error } = await supa
    .from("products")
    .select("id, name, specs")
    .eq("type", "bourbon")
    .eq("status", "confirmed");
  if (error) throw error;

  let updated = 0;
  let already = 0;

  for (const p of data ?? []) {
    const specs = (p.specs ?? {}) as Record<string, unknown>;
    if (specs.curation_collapse === "Y") {
      already += 1;
      continue;
    }
    updated += 1;
    if (apply) {
      const { error: upErr } = await supa
        .from("products")
        .update({ specs: { ...specs, curation_collapse: "Y" } })
        .eq("id", p.id);
      if (upErr) throw upErr;
    }
  }

  console.log(
    `[flip-all-collapse-y] total=${data?.length ?? 0} already Y=${already} ${apply ? "updated" : "would update"}=${updated}`,
  );
  if (!apply) console.log("[flip-all-collapse-y] Re-run with --apply to write.");
}

main().catch((err) => {
  console.error("[flip-all-collapse-y] failed:", err);
  process.exit(1);
});
