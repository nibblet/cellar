/**
 * Catalog curation fixes — expression tags, promotions, and manual inserts.
 *
 *   pnpm apply:keep-catalog-fixes --dry-run
 *   pnpm apply:keep-catalog-fixes --apply
 */

import { adminClient } from "./lib/supabase-admin";

type ProductPatch = {
  id: string;
  label: string;
  patch: {
    name?: string;
    expression?: string;
    brand_family?: string;
    catalog_included?: boolean;
    is_core_range?: boolean;
    specs?: Record<string, unknown>;
  };
};

type NewProduct = {
  label: string;
  row: {
    type: "bourbon";
    name: string;
    brand: string;
    producer: string;
    brand_family: string;
    expression: string;
    status: "confirmed";
    source: "manual";
    catalog_included: boolean;
    is_core_range: boolean;
    specs: Record<string, unknown>;
  };
};

const FIXES: ProductPatch[] = [
  // --- prior pass (idempotent) ---
  {
    id: "e5253b95-5f9e-44bc-97c2-d3a069fe2b50",
    label: "1792 BiB expression",
    patch: {
      expression: "1792 Bottled in Bond",
      specs: { curated_expression: "Bottled in Bond" },
    },
  },
  {
    id: "8167447b-51f0-46f0-bdee-a44583aeade9",
    label: "Woodford Double Double Oaked expression",
    patch: {
      expression: "Woodford Reserve Double Double Oaked",
      specs: { curated_expression: "Double Double Oaked" },
    },
  },
  {
    id: "b66119dc-b2e6-429c-92cc-26761d0d49e6",
    label: "Weller Special Reserve family",
    patch: {
      brand_family: "Weller",
      expression: "Weller Special Reserve",
      specs: { curated_expression: "Special Reserve" },
    },
  },

  // --- Wild Turkey ---
  {
    id: "b8b6f3e0-a5d2-423b-925c-5563a05d17e7",
    label: "Wild Turkey 101 — promote",
    patch: { catalog_included: true, is_core_range: true },
  },
  {
    id: "58a1e88f-0f24-4f5f-8dd8-a5559f4f42ae",
    label: "WT Generations 70th — fix mis-tagged 101 expression",
    patch: {
      expression: "Wild Turkey Generations 70th Anniversary",
      specs: {
        curated_expression: "Generations 70th Anniversary",
        curation_collapse: "N",
      },
    },
  },

  // --- Russell's Reserve: mislabeled 2002 barrel proof posing as flagship ---
  {
    id: "2dec6c6d-a4e5-4507-b5e8-64df05278a2a",
    label: "Russell's 2002 barrel proof — hide + retag",
    patch: {
      name: "Russell's Reserve 2002 Barrel Proof",
      expression: "Russell's Reserve 2002 Barrel Proof",
      catalog_included: false,
      is_core_range: false,
      specs: {
        curated_expression: "2002 Barrel Proof",
        curation_collapse: "N",
        availability_rarity: "allocated",
      },
    },
  },

  // --- Jim Beam (mid-tier; skip Devil's Cut + Old Tub) ---
  {
    id: "3b6ed3a2-b17e-4d52-a765-23e5864e55bc",
    label: "Jim Beam Signature Craft — promote",
    patch: { catalog_included: true, is_core_range: false },
  },
  {
    id: "04c0e847-a149-4a63-84a1-662068bd9781",
    label: "Jim Beam Distiller's Cut — promote",
    patch: { catalog_included: true, is_core_range: false },
  },
  {
    id: "7c4788dc-d736-4b8a-8909-41386dbc3fc8",
    label: "Jim Beam Distiller's Masterpiece Sherry — promote",
    patch: { catalog_included: true, is_core_range: false },
  },
  {
    id: "47cd3b1e-4dd6-49a7-946b-0043f06da685",
    label: "Jim Beam Distillers' Masterpiece — promote",
    patch: { catalog_included: true, is_core_range: false },
  },

  // --- Stagg line ---
  {
    id: "59e959c5-3a90-4580-b6b6-b2e575c7b116",
    label: "Stagg (Jr.) Barrel Proof — promote",
    patch: {
      brand_family: "Stagg",
      expression: "Stagg Barrel Proof",
      catalog_included: true,
      is_core_range: false,
      specs: { curated_expression: "Barrel Proof" },
    },
  },
  {
    id: "02bb6c49-1f71-4778-9ecc-4044aa0e6d8e",
    label: "George T. Stagg — promote",
    patch: { catalog_included: true, is_core_range: false },
  },
];

const INSERTS: NewProduct[] = [
  {
    label: "Four Roses Single Barrel",
    row: {
      type: "bourbon",
      name: "Four Roses Single Barrel",
      brand: "Four Roses",
      producer: "Four Roses (Kirin)",
      brand_family: "Four Roses",
      expression: "Four Roses Single Barrel",
      status: "confirmed",
      source: "manual",
      catalog_included: true,
      is_core_range: true,
      specs: {
        tier: 3,
        tier_source: "curation",
        proof: 100,
        abv: 50,
        mash_bill: "60% corn, 35% rye, 5% malted barley",
        distillery: "Four Roses Distillery",
        whiskey_type: "Bourbon",
        expression_type: "Single Barrel",
        availability_rarity: "seasonal",
        curated_expression: "Single Barrel",
        curation_collapse: "N",
        curation_notes: "Added — core lineup gap (BourbonData.csv)",
      },
    },
  },
  {
    label: "Four Roses Small Batch Select",
    row: {
      type: "bourbon",
      name: "Four Roses Small Batch Select",
      brand: "Four Roses",
      producer: "Four Roses (Kirin)",
      brand_family: "Four Roses",
      expression: "Four Roses Small Batch Select",
      status: "confirmed",
      source: "manual",
      catalog_included: true,
      is_core_range: true,
      specs: {
        tier: 3,
        tier_source: "curation",
        proof: 104,
        abv: 52,
        age_label: "10 yr",
        year_made: 2019,
        distillery: "Four Roses Distillery",
        whiskey_type: "Bourbon",
        expression_type: "Small Batch",
        availability_rarity: "seasonal",
        curated_expression: "Small Batch Select",
        curation_collapse: "N",
        curation_notes: "Added — core lineup gap (BourbonData.csv)",
      },
    },
  },
  {
    label: "Russell's Reserve 10 Year",
    row: {
      type: "bourbon",
      name: "Russell's Reserve 10 Year",
      brand: "Russell's Reserve",
      producer: "Wild Turkey (Campari)",
      brand_family: "Russell's Reserve",
      expression: "Russell's Reserve 10 Year",
      status: "confirmed",
      source: "manual",
      catalog_included: true,
      is_core_range: true,
      specs: {
        tier: 2,
        tier_source: "curation",
        proof: 90,
        abv: 45,
        age_label: "10 yr",
        mash_bill: "75% corn, 13% rye, 12% malted barley",
        distillery: "Wild Turkey Distillery",
        whiskey_type: "Bourbon",
        expression_type: "Straight Bourbon",
        availability_rarity: "everyday",
        curated_expression: "10 Year",
        curation_collapse: "N",
        curation_notes: "Added — core lineup gap (BourbonData.csv)",
      },
    },
  },
  {
    label: "Jim Beam Single Barrel",
    row: {
      type: "bourbon",
      name: "Jim Beam Single Barrel",
      brand: "Jim Beam",
      producer: "Jim Beam (Beam Suntory)",
      brand_family: "Jim Beam",
      expression: "Jim Beam Single Barrel",
      status: "confirmed",
      source: "manual",
      catalog_included: true,
      is_core_range: false,
      specs: {
        tier: 2,
        tier_source: "curation",
        proof: 95,
        abv: 47.5,
        age_label: "5 yr",
        year_made: 2020,
        mash_bill: "77% corn, 13% rye, 10% malted barley",
        distillery: "Jim Beam Distillery",
        whiskey_type: "Bourbon",
        expression_type: "Single Barrel",
        availability_rarity: "everyday",
        curated_expression: "Single Barrel",
        curation_collapse: "N",
        curation_notes: "Added — mid-tier Jim Beam (BourbonData.csv)",
      },
    },
  },
  {
    label: "Jim Beam Bonded",
    row: {
      type: "bourbon",
      name: "Jim Beam Bonded",
      brand: "Jim Beam",
      producer: "Jim Beam (Beam Suntory)",
      brand_family: "Jim Beam",
      expression: "Jim Beam Bonded",
      status: "confirmed",
      source: "manual",
      catalog_included: true,
      is_core_range: false,
      specs: {
        tier: 2,
        tier_source: "curation",
        proof: 100,
        abv: 50,
        age_label: "4 yr",
        year_made: 2015,
        mash_bill: "77% corn, 13% rye, 10% malted barley",
        distillery: "Jim Beam Distillery",
        whiskey_type: "Bourbon",
        expression_type: "Bottled in Bond",
        availability_rarity: "everyday",
        curated_expression: "Bonded",
        curation_collapse: "N",
        curation_notes: "Added — mid-tier Jim Beam BiB (BourbonData.csv)",
      },
    },
  },
  {
    label: "Jim Beam Black 7 Year",
    row: {
      type: "bourbon",
      name: "Jim Beam Black 7 Year",
      brand: "Jim Beam",
      producer: "Jim Beam (Beam Suntory)",
      brand_family: "Jim Beam",
      expression: "Jim Beam Black 7 Year",
      status: "confirmed",
      source: "manual",
      catalog_included: true,
      is_core_range: false,
      specs: {
        tier: 2,
        tier_source: "curation",
        proof: 90,
        abv: 45,
        age_label: "7 yr",
        mash_bill: "77% corn, 13% rye, 10% malted barley",
        distillery: "Jim Beam Distillery",
        whiskey_type: "Bourbon",
        expression_type: "Straight Bourbon",
        availability_rarity: "everyday",
        curated_expression: "Black 7 Year",
        curation_collapse: "N",
        curation_notes: "Added — mid-tier Jim Beam (BourbonData.csv)",
      },
    },
  },
];

async function existingByName(names: string[]): Promise<Map<string, string>> {
  const supabase = adminClient();
  const found = new Map<string, string>();
  for (const name of names) {
    const { data } = await supabase
      .from("products")
      .select("id, name")
      .eq("type", "bourbon")
      .eq("name", name)
      .maybeSingle();
    if (data) found.set(name, data.id);
  }
  return found;
}

async function main() {
  const apply = process.argv.includes("--apply");
  const dryRun = !apply;
  console.log(`[apply-keep-catalog-fixes] ${dryRun ? "DRY RUN" : "APPLY"}`);

  const supabase = adminClient();
  const ids = FIXES.map((f) => f.id);

  const existing = new Map<
    string,
    { name: string; specs: Record<string, unknown> | null }
  >();
  for (let i = 0; i < ids.length; i += 100) {
    const chunk = ids.slice(i, i + 100);
    const { data, error } = await supabase
      .from("products")
      .select("id, name, specs")
      .in("id", chunk);
    if (error) throw error;
    for (const row of data ?? []) existing.set(row.id, row);
  }

  let updated = 0;
  console.log("\n--- Updates ---");
  for (const fix of FIXES) {
    const cur = existing.get(fix.id);
    if (!cur) {
      console.warn(`  SKIP missing ${fix.id} (${fix.label})`);
      continue;
    }

    const specs = { ...(cur.specs ?? {}), ...(fix.patch.specs ?? {}) };
    const update: Record<string, unknown> = {};
    if (fix.patch.name !== undefined) update.name = fix.patch.name;
    if (fix.patch.expression !== undefined) update.expression = fix.patch.expression;
    if (fix.patch.brand_family !== undefined) update.brand_family = fix.patch.brand_family;
    if (fix.patch.catalog_included !== undefined) {
      update.catalog_included = fix.patch.catalog_included;
    }
    if (fix.patch.is_core_range !== undefined) update.is_core_range = fix.patch.is_core_range;
    if (fix.patch.specs) update.specs = specs;

    console.log(`  ${fix.label}: ${cur.name}`);
    if (!dryRun) {
      const { error } = await supabase.from("products").update(update).eq("id", fix.id);
      if (error) throw error;
    }
    updated += 1;
  }

  const insertNames = INSERTS.map((i) => i.row.name);
  const already = await existingByName(insertNames);

  let inserted = 0;
  console.log("\n--- Inserts ---");
  for (const item of INSERTS) {
    if (already.has(item.row.name)) {
      console.log(`  SKIP exists: ${item.row.name}`);
      continue;
    }
    console.log(`  INSERT ${item.label}: ${item.row.name}`);
    if (!dryRun) {
      const { error } = await supabase.from("products").insert(item.row);
      if (error) throw error;
    }
    inserted += 1;
  }

  console.log(
    `\n[apply-keep-catalog-fixes] updated=${updated} inserted=${inserted}${dryRun ? " (dry run)" : ""}`,
  );
  if (dryRun) console.log("[apply-keep-catalog-fixes] Re-run with --apply to write.");
}

main().catch((err) => {
  console.error("[apply-keep-catalog-fixes] failed:", err);
  process.exit(1);
});
