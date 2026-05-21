import type { SupabaseClient } from "@supabase/supabase-js";
import { formatMemberName, type MemberNameFields } from "@/lib/identity";
import type { ProductType } from "@/lib/wheel";

export type FeedEntry = {
  tasting_id: string;
  user_id: string;
  display_name: string;
  product_id: string;
  product_name: string;
  product_brand: string | null;
  product_type: ProductType;
  product_specs: Record<string, unknown> | null;
  hero_image_path: string | null;
  recommend: boolean;
  chips: string[];
  note: string | null;
  event_id: string | null;
  event_name: string | null;
  created_at: string;
};

export type FeedFilters = {
  userId?: string;
  eventId?: string;
  productType?: ProductType;
  limit?: number;
};

/**
 * Pull a chronological slice of tastings with the joined product + member
 * info needed to render a feed card. Apply optional member, event, or type
 * filters for the member-profile and event-detail views.
 *
 * RLS already restricts to authenticated members; no extra auth gates here.
 */
export async function loadFeed(
  supabase: SupabaseClient,
  filters: FeedFilters = {},
): Promise<FeedEntry[]> {
  let query = supabase
    .from("tastings")
    .select(
      `
      id, user_id, recommend, chips, note, created_at, event_id,
      user:users(name_first, name_last_initial),
      product:products(id, name, brand, type, specs),
      event:events(name)
    `,
    )
    .order("created_at", { ascending: false })
    .limit(filters.limit ?? 50);

  if (filters.userId) query = query.eq("user_id", filters.userId);
  if (filters.eventId) query = query.eq("event_id", filters.eventId);

  const { data } = await query;

  type Row = {
    id: string;
    user_id: string;
    recommend: boolean;
    chips: string[];
    note: string | null;
    created_at: string;
    event_id: string | null;
    user: MemberNameFields | null;
    product: {
      id: string;
      name: string;
      brand: string | null;
      type: ProductType;
      specs: Record<string, unknown> | null;
    } | null;
    event: { name: string } | null;
  };

  const rows = ((data as Row[] | null) ?? []).filter(
    (r) => r.user && r.product && (!filters.productType || r.product.type === filters.productType),
  );

  if (rows.length === 0) return [];

  // Batch-fetch hero images for the visible products in a single query.
  const productIds = [...new Set(rows.map((r) => r.product?.id).filter(Boolean) as string[])];
  const { data: heroes } = await supabase
    .from("product_images")
    .select("product_id, image_url, is_hero, created_at")
    .in("product_id", productIds)
    .order("is_hero", { ascending: false })
    .order("created_at", { ascending: false });

  const heroByProduct = new Map<string, string>();
  for (const h of heroes ?? []) {
    if (!heroByProduct.has(h.product_id)) {
      heroByProduct.set(h.product_id, h.image_url);
    }
  }

  return rows.map((r) => ({
    tasting_id: r.id,
    user_id: r.user_id,
    display_name: r.user ? formatMemberName(r.user) : "Member",
    product_id: r.product?.id ?? "",
    product_name: r.product?.name ?? "",
    product_brand: r.product?.brand ?? null,
    product_type: (r.product?.type ?? "cigar") as ProductType,
    product_specs: r.product?.specs ?? null,
    hero_image_path: heroByProduct.get(r.product?.id ?? "") ?? null,
    recommend: r.recommend,
    chips: r.chips ?? [],
    note: r.note,
    event_id: r.event_id,
    event_name: r.event?.name ?? null,
    created_at: r.created_at,
  }));
}

/**
 * Sign a batch of storage paths to short-lived URLs in one round trip.
 * Returns a Map keyed by path; callers look up safely (missing = no image).
 */
export async function signImagePaths(
  supabase: SupabaseClient,
  paths: (string | null)[],
  ttlSeconds = 3600,
): Promise<Map<string, string>> {
  const unique = [...new Set(paths.filter((p): p is string => Boolean(p)))];
  if (unique.length === 0) return new Map();

  const { data } = await supabase.storage
    .from("product-photos")
    .createSignedUrls(unique, ttlSeconds);

  const map = new Map<string, string>();
  for (const item of data ?? []) {
    if (item.signedUrl && item.path) map.set(item.path, item.signedUrl);
  }
  return map;
}
