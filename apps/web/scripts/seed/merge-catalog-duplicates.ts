/**
 * Find confirmed bourbon rows that share a canonical expression and merge
 * variants into one survivor (repoint FKs, delete the duplicate row).
 *
 *   pnpm merge:catalog-duplicates              # dry run
 *   pnpm merge:catalog-duplicates --apply
 *
 * Survivor preference: catalog image → member hero photo → curation score → id.
 */

import { proposeNormalization } from "@/lib/catalog/expression-normalize";
import { normalizeName } from "@/lib/identify/normalize";
import { parseReleaseLabel } from "@/lib/tasting/release-label";
import { adminClient } from "./lib/supabase-admin";

type ProductRow = {
  id: string;
  name: string;
  brand: string | null;
  brand_family: string | null;
  specs: Record<string, unknown> | null;
  image_url: string | null;
};

async function fetchBourbons(): Promise<ProductRow[]> {
  const supabase = adminClient();
  const rows: ProductRow[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabase
      .from("products")
      .select("id, name, brand, brand_family, specs, image_url")
      .eq("type", "bourbon")
      .eq("status", "confirmed")
      .order("name", { ascending: true })
      .range(from, from + 999);
    if (error) throw error;
    if (!data?.length) break;
    rows.push(...(data as ProductRow[]));
  }
  return rows;
}

async function heroByProduct(
  supabase: ReturnType<typeof adminClient>,
  ids: string[],
): Promise<Map<string, boolean>> {
  const { data } = await supabase
    .from("product_images")
    .select("product_id")
    .in("product_id", ids)
    .limit(5000);
  const map = new Map<string, boolean>();
  for (const row of data ?? []) map.set(row.product_id, true);
  return map;
}

function curationScore(p: ProductRow): number {
  const specs = p.specs ?? {};
  let n = 0;
  if (specs.curated_expression) n += 4;
  if (specs.curation_release_label) n += 2;
  if (specs.tier != null) n += 1;
  if (specs.year_made != null) n += 1;
  return n;
}

function survivorScore(p: ProductRow, hasHero: boolean): number {
  let n = 0;
  if (p.image_url) n += 1000;
  if (hasHero) n += 100;
  n += curationScore(p) * 10;
  return n;
}

function specStr(specs: Record<string, unknown> | null, key: string): string | null {
  const v = specs?.[key];
  if (v === null || v === undefined || v === "") return null;
  return String(v).trim() || null;
}

function groupKeys(p: ProductRow): string[] {
  const brand = p.brand_family ?? p.brand ?? "";
  const keys: string[] = [];
  const curated = specStr(p.specs, "curated_expression");
  if (brand && curated) keys.push(`${brand}::curated::${curated}`);
  if (brand) keys.push(`${brand}::name::${normalizeName(p.name)}`);
  return keys;
}

function releaseLabelForVariant(p: ProductRow): string | null {
  const proposal = proposeNormalization({
    id: p.id,
    name: p.name,
    brand: p.brand_family ?? p.brand,
    specs: p.specs,
  });
  return proposal.release_label;
}

async function mergeVariant(
  supabase: ReturnType<typeof adminClient>,
  oldId: string,
  newId: string,
  releaseLabel: string | null,
): Promise<void> {
  const parsed = releaseLabel ? parseReleaseLabel(releaseLabel) : { release_label: null, release_year: null };
  await supabase
    .from("tastings")
    .update({
      product_id: newId,
      release_label: parsed.release_label,
      release_year: parsed.release_year,
      release_label_source: releaseLabel ? "migration" : null,
    })
    .eq("product_id", oldId);

  await supabase.from("product_images").update({ product_id: newId }).eq("product_id", oldId);
  await supabase.from("product_reviews").update({ product_id: newId }).eq("product_id", oldId);

  const { data: saves } = await supabase.from("member_saves").select("*").eq("product_id", oldId);
  for (const save of saves ?? []) {
    const { data: existing } = await supabase
      .from("member_saves")
      .select("have, want, tried")
      .eq("member_id", save.member_id)
      .eq("product_id", newId)
      .maybeSingle();
    if (existing) {
      const have = existing.have || save.have;
      const want = !have && (existing.want || save.want);
      await supabase
        .from("member_saves")
        .update({ have, want, tried: existing.tried || save.tried })
        .eq("member_id", save.member_id)
        .eq("product_id", newId);
      await supabase
        .from("member_saves")
        .delete()
        .eq("member_id", save.member_id)
        .eq("product_id", oldId);
    } else {
      await supabase
        .from("member_saves")
        .update({ product_id: newId })
        .eq("member_id", save.member_id)
        .eq("product_id", oldId);
    }
  }
  await supabase.from("pairing_sessions").update({ bourbon_id: newId }).eq("bourbon_id", oldId);

  await supabase.from("pairings_cache").delete().eq("bourbon_id", oldId);

  const { error } = await supabase.from("products").delete().eq("id", oldId);
  if (error) throw error;
}

async function main() {
  const apply = process.argv.includes("--apply");
  const products = await fetchBourbons();
  const heroes = await heroByProduct(
    adminClient(),
    products.map((p) => p.id),
  );

  // Union rows that share any group key (curated expression or exact normalized name).
  const parent = new Map<string, string>();
  const find = (id: string): string => {
    const p = parent.get(id) ?? id;
    if (p === id) return id;
    const root = find(p);
    parent.set(id, root);
    return root;
  };
  const unite = (a: string, b: string) => {
    parent.set(find(a), find(b));
  };

  const keyToIds = new Map<string, string[]>();
  for (const p of products) {
    parent.set(p.id, p.id);
    for (const key of groupKeys(p)) {
      const ids = keyToIds.get(key) ?? [];
      ids.push(p.id);
      keyToIds.set(key, ids);
    }
  }
  for (const ids of keyToIds.values()) {
    for (let i = 1; i < ids.length; i += 1) unite(ids[0], ids[i]);
  }

  const clusters = new Map<string, ProductRow[]>();
  for (const p of products) {
    const root = find(p.id);
    const list = clusters.get(root) ?? [];
    list.push(p);
    clusters.set(root, list);
  }

  const dupes: Array<[string, ProductRow[]]> = [];
  for (const rows of clusters.values()) {
    if (rows.length < 2) continue;
    const curated = specStr(rows[0].specs, "curated_expression");
    const label =
      curated != null
        ? `${rows[0].brand_family ?? rows[0].brand}::curated::${curated}`
        : `${rows[0].brand_family ?? rows[0].brand}::${rows[0].name}`;
    dupes.push([label, rows]);
  }
  dupes.sort((a, b) => a[0].localeCompare(b[0]));

  console.log(
    `[merge-catalog-duplicates] ${apply ? "APPLY" : "DRY RUN"} — ${dupes.length} duplicate groups`,
  );

  let merged = 0;
  for (const [key, rows] of dupes) {
    const survivor = [...rows].sort(
      (a, b) => survivorScore(b, heroes.has(b.id)) - survivorScore(a, heroes.has(a.id)),
    )[0];
    const variants = rows.filter((r) => r.id !== survivor.id);

    console.log(`\n${key}`);
    console.log(`  KEEP  ${survivor.name} (${survivor.id})`);
    for (const v of variants) {
      const label = releaseLabelForVariant(v);
      console.log(`  DEL   ${v.name} (${v.id})${label ? ` → release ${label}` : ""}`);
      if (apply) {
        await mergeVariant(adminClient(), v.id, survivor.id, label);
        merged += 1;
      }
    }
  }

  if (!apply) {
    console.log("\nRe-run with --apply to delete duplicate rows.");
    return;
  }
  console.log(`\n[merge-catalog-duplicates] deleted ${merged} duplicate products.`);
}

main().catch((err) => {
  console.error("[merge-catalog-duplicates] fatal:", err);
  process.exit(1);
});
