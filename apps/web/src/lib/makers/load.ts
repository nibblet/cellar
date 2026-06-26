import type { SupabaseClient } from "@supabase/supabase-js";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { ProductType, TraitVector } from "@/lib/wheel";
import { aggregateTraitVectors } from "./aggregate";
import { generateMakerBlurb } from "./blurb";
import { deriveHouseStyleLine } from "./house-style";
import { makerSlug } from "./slug";

export type MakerRow = {
  id: string;
  slug: string;
  name: string;
  type: ProductType;
  country: string | null;
  website: string | null;
  blurb: string | null;
  blurb_source: "ai" | "manual";
  house_style: string | null;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
};

export async function resolveMakerIdentity(
  supabase: SupabaseClient,
  slug: string,
): Promise<{ brand: string; type: ProductType } | null> {
  const { data: existing } = await supabase
    .from("makers")
    .select("name, type")
    .eq("slug", slug)
    .maybeSingle();

  if (existing?.name && existing.type) {
    return { brand: existing.name, type: existing.type as ProductType };
  }

  const { data: products } = await supabase
    .from("products")
    .select("brand, type")
    .eq("status", "confirmed")
    .eq("catalog_included", true)
    .not("brand", "is", null);

  const seen = new Set<string>();
  for (const row of products ?? []) {
    const brand = row.brand as string;
    const key = `${row.type}:${brand}`;
    if (seen.has(key)) continue;
    seen.add(key);
    if (makerSlug(brand) === slug) {
      return { brand, type: row.type as ProductType };
    }
  }

  return null;
}

export async function ensureMaker(
  supabase: SupabaseClient,
  brand: string,
  type: ProductType,
  userId: string | null,
): Promise<MakerRow> {
  const slug = makerSlug(brand);

  const { data: existing } = await supabase
    .from("makers")
    .select("*")
    .eq("slug", slug)
    .maybeSingle();

  if (existing?.blurb) return existing as MakerRow;

  const { data: products } = await supabase
    .from("products")
    .select("id, name, trait_vector")
    .eq("brand", brand)
    .eq("type", type)
    .eq("status", "confirmed")
    .eq("catalog_included", true)
    .not("trait_vector", "is", null);

  type ProductVecRow = { trait_vector: TraitVector | null };
  const vectors = ((products as ProductVecRow[] | null) ?? [])
    .map((p) => p.trait_vector)
    .filter((v): v is TraitVector => v != null);

  const aggregated = aggregateTraitVectors(vectors);
  const houseStyle = vectors.length >= 2 ? deriveHouseStyleLine(aggregated, brand) : null;

  let blurb = existing?.blurb ?? null;
  const blurbSource = (existing?.blurb_source as "ai" | "manual" | undefined) ?? "ai";

  if (!blurb && blurbSource === "ai") {
    try {
      blurb = await generateMakerBlurb(brand, type, supabase, userId);
    } catch {
      blurb = null;
    }
  }

  const admin = createSupabaseAdminClient();
  const payload = {
    slug,
    name: brand,
    type,
    blurb,
    blurb_source: blurb ? blurbSource : "ai",
    house_style: houseStyle,
    country: existing?.country ?? null,
    website: existing?.website ?? null,
  };

  const { data: upserted, error } = await admin
    .from("makers")
    .upsert(payload, { onConflict: "slug" })
    .select()
    .single();

  if (error || !upserted) {
    throw error ?? new Error("Failed to upsert maker row");
  }

  return upserted as MakerRow;
}

export async function loadMakerBySlug(
  supabase: SupabaseClient,
  slug: string,
): Promise<MakerRow | null> {
  const { data } = await supabase.from("makers").select("*").eq("slug", slug).maybeSingle();
  return (data as MakerRow | null) ?? null;
}

export async function loadMakerRow(
  supabase: SupabaseClient,
  brand: string,
  _type: ProductType,
): Promise<MakerRow | null> {
  return loadMakerBySlug(supabase, makerSlug(brand));
}
