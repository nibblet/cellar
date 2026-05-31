/**
 * Apply expression / inclusion fixes from the keep-catalog review.
 *
 *   pnpm apply:keep-catalog-fixes --dry-run
 *   pnpm apply:keep-catalog-fixes --apply
 */

import { adminClient } from "./lib/supabase-admin";

type ProductPatch = {
  id: string;
  label: string;
  patch: {
    expression?: string;
    brand_family?: string;
    catalog_included?: boolean;
    is_core_range?: boolean;
    specs?: Record<string, unknown>;
  };
};

const FIXES: ProductPatch[] = [
  {
    id: "e5253b95-5f9e-44bc-97c2-d3a069fe2b50",
    label: "1792 BiB — separate from Small Batch expression",
    patch: {
      expression: "1792 Bottled in Bond",
      specs: { curated_expression: "Bottled in Bond" },
    },
  },
  {
    id: "8167447b-51f0-46f0-bdee-a44583aeade9",
    label: "Woodford Double Double Oaked — distinct expression",
    patch: {
      expression: "Woodford Reserve Double Double Oaked",
      specs: { curated_expression: "Double Double Oaked" },
    },
  },
  {
    id: "37b8e204-1e39-449a-b203-328686d5816c",
    label: "Knob Creek Small Batch — promote",
    patch: { catalog_included: true, is_core_range: true },
  },
  {
    id: "338397c2-cdc8-4020-b096-bdbc6d7d254a",
    label: "Baker's 7 Year — promote",
    patch: { catalog_included: true, is_core_range: true },
  },
  {
    id: "05f6a749-384e-43fd-a441-01b23c635be4",
    label: "Baker's 13 Year — promote",
    patch: { catalog_included: true, is_core_range: true },
  },
  {
    id: "13dfb4eb-7a77-4446-89c7-eccb963b8913",
    label: "Four Roses Yellow Label — promote",
    patch: { catalog_included: true, is_core_range: true },
  },
  {
    id: "b66119dc-b2e6-429c-92cc-26761d0d49e6",
    label: "W.L. Weller Special Reserve → Weller family",
    patch: {
      brand_family: "Weller",
      expression: "Weller Special Reserve",
      specs: { curated_expression: "Special Reserve" },
    },
  },
  {
    id: "c6178595-aff2-44ed-8aaa-5804c828b099",
    label: "Maker's Mark DNA 110",
    patch: {
      expression: "Maker's Mark DNA Project 110 Entry Proof",
      specs: { curated_expression: "DNA Project 110 Entry Proof" },
    },
  },
  {
    id: "180442a9-4725-41d6-8c32-ca15309c9ee4",
    label: "Maker's Mark DNA 115",
    patch: {
      expression: "Maker's Mark DNA Project 115 Entry Proof",
      specs: { curated_expression: "DNA Project 115 Entry Proof" },
    },
  },
  {
    id: "26aa5d49-c54f-41ba-81ec-8e6ca78b24ba",
    label: "Maker's Mark DNA 120",
    patch: {
      expression: "Maker's Mark DNA Project 120 Entry Proof",
      specs: { curated_expression: "DNA Project 120 Entry Proof" },
    },
  },
  {
    id: "590a4f06-9248-4065-9407-8eed9d9cacc7",
    label: "Maker's Mark DNA 125",
    patch: {
      expression: "Maker's Mark DNA Project 125 Entry Proof",
      specs: { curated_expression: "DNA Project 125 Entry Proof" },
    },
  },
  {
    id: "1b10d81d-bf91-41b1-9e75-92fbce0d3c54",
    label: "Maker's Mark Wood Finishing FAE-01",
    patch: {
      expression: "Maker's Mark Wood Finishing FAE-01",
      specs: { curated_expression: "Wood Finishing FAE-01" },
    },
  },
  {
    id: "9a59689c-f96d-4bf6-bf52-f5f870da3200",
    label: "Maker's Mark Wood Finishing FAE-02",
    patch: {
      expression: "Maker's Mark Wood Finishing FAE-02",
      specs: { curated_expression: "Wood Finishing FAE-02" },
    },
  },
  {
    id: "cbaed5ea-ead3-4fb0-94bb-1124bef30496",
    label: "Maker's Mark Wood Finishing Heart Release",
    patch: {
      expression: "Maker's Mark Wood Finishing Heart Release",
      specs: { curated_expression: "Wood Finishing Heart Release" },
    },
  },
  {
    id: "4c93b345-6536-4cda-8a6e-a3919ed721c6",
    label: "Maker's Mark Private Selection Master Distiller",
    patch: {
      expression: "Maker's Mark Private Selection Master Distiller",
      specs: { curated_expression: "Private Selection Master Distiller" },
    },
  },
  {
    id: "d9ef64c6-404e-4192-847f-dad36ceddf0b",
    label: "Maker's Mark Private Selection Master of Maturation",
    patch: {
      expression: "Maker's Mark Private Selection Master of Maturation",
      specs: { curated_expression: "Private Selection Master of Maturation" },
    },
  },
];

async function main() {
  const apply = process.argv.includes("--apply");
  const dryRun = !apply;
  console.log(`[apply-keep-catalog-fixes] ${dryRun ? "DRY RUN" : "APPLY"}`);

  const supabase = adminClient();
  const ids = FIXES.map((f) => f.id);

  const existing = new Map<string, { name: string; specs: Record<string, unknown> | null }>();
  for (let i = 0; i < ids.length; i += 100) {
    const chunk = ids.slice(i, i + 100);
    const { data, error } = await supabase
      .from("products")
      .select("id, name, expression, brand_family, catalog_included, is_core_range, specs")
      .in("id", chunk);
    if (error) throw error;
    for (const row of data ?? []) existing.set(row.id, row);
  }

  let changed = 0;
  for (const fix of FIXES) {
    const cur = existing.get(fix.id);
    if (!cur) {
      console.warn(`  SKIP missing ${fix.id} (${fix.label})`);
      continue;
    }

    const specs = { ...(cur.specs ?? {}), ...(fix.patch.specs ?? {}) };
    const update: Record<string, unknown> = {};
    if (fix.patch.expression !== undefined) update.expression = fix.patch.expression;
    if (fix.patch.brand_family !== undefined) update.brand_family = fix.patch.brand_family;
    if (fix.patch.catalog_included !== undefined) {
      update.catalog_included = fix.patch.catalog_included;
    }
    if (fix.patch.is_core_range !== undefined) update.is_core_range = fix.patch.is_core_range;
    if (fix.patch.specs) update.specs = specs;

    console.log(`  ${fix.label}`);
    console.log(`    ${cur.name}`);

    if (!dryRun) {
      const { error } = await supabase.from("products").update(update).eq("id", fix.id);
      if (error) throw error;
    }
    changed += 1;
  }

  console.log(`[apply-keep-catalog-fixes] ${changed} products ${dryRun ? "would update" : "updated"}`);
  if (dryRun) console.log("[apply-keep-catalog-fixes] Re-run with --apply to write.");
}

main().catch((err) => {
  console.error("[apply-keep-catalog-fixes] failed:", err);
  process.exit(1);
});
