import type { SupabaseClient } from "@supabase/supabase-js";
import { formatMemberName, type MemberNameFields } from "@/lib/identity";
import type { ProductType } from "@/lib/wheel";

export type FeedTastingEntry = {
  kind: "tasting";
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
  release_label: string | null;
  event_id: string | null;
  event_name: string | null;
  created_at: string;
};

export type FeedPairingEntry = {
  kind: "pairing";
  pairing_session_id: string;
  tasting_id: string;
  user_id: string;
  display_name: string;
  cigar_id: string;
  cigar_name: string;
  cigar_brand: string | null;
  cigar_specs: Record<string, unknown> | null;
  bourbon_id: string;
  bourbon_name: string;
  bourbon_brand: string | null;
  bourbon_specs: Record<string, unknown> | null;
  hero_image_path: string | null;
  recommend: boolean;
  chips: string[];
  note: string | null;
  pairing_note: string | null;
  event_id: string | null;
  event_name: string | null;
  created_at: string;
};

export type FeedItem = FeedTastingEntry | FeedPairingEntry;

/** @deprecated Use FeedTastingEntry — kept for gradual migration */
export type FeedEntry = FeedTastingEntry;

export type FeedFilters = {
  userId?: string;
  eventId?: string;
  productType?: ProductType;
  limit?: number;
};

type TastingRow = {
  id: string;
  user_id: string;
  recommend: boolean;
  chips: string[];
  note: string | null;
  release_label: string | null;
  created_at: string;
  event_id: string | null;
  pairing_session_id: string | null;
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

/**
 * Chronological feed items. Pairing captures with a shared pairing_session_id
 * collapse into one pairing card; solo tastings stay as single cards.
 */
export async function loadFeed(
  supabase: SupabaseClient,
  filters: FeedFilters = {},
): Promise<FeedItem[]> {
  let query = supabase
    .from("tastings")
    .select(
      `
      id, user_id, recommend, chips, note, release_label, created_at, event_id,
      pairing_session_id,
      user:users(name_first, name_last_initial),
      product:products(id, name, brand, type, specs),
      event:events(name)
    `,
    )
    .order("created_at", { ascending: false })
    .limit((filters.limit ?? 50) * 2);

  if (filters.userId) query = query.eq("user_id", filters.userId);
  if (filters.eventId) query = query.eq("event_id", filters.eventId);

  const { data } = await query;

  const rows = ((data as TastingRow[] | null) ?? []).filter(
    (r) => r.user && r.product && (!filters.productType || r.product.type === filters.productType),
  );

  if (rows.length === 0) return [];

  const sessionIds = [
    ...new Set(rows.map((r) => r.pairing_session_id).filter((id): id is string => Boolean(id))),
  ];

  const sessionMeta = new Map<
    string,
    {
      photo_storage_path: string | null;
      pairing_note: string | null;
      cigar_id: string;
      bourbon_id: string;
    }
  >();

  if (sessionIds.length > 0) {
    const { data: sessions } = await supabase
      .from("pairing_sessions")
      .select("id, photo_storage_path, pairing_note, cigar_id, bourbon_id")
      .in("id", sessionIds);

    for (const s of sessions ?? []) {
      sessionMeta.set(s.id, {
        photo_storage_path: s.photo_storage_path,
        pairing_note: s.pairing_note,
        cigar_id: s.cigar_id,
        bourbon_id: s.bourbon_id,
      });
    }
  }

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

  const seenSessions = new Set<string>();
  const items: FeedItem[] = [];

  for (const r of rows) {
    if (r.pairing_session_id && sessionMeta.has(r.pairing_session_id)) {
      if (seenSessions.has(r.pairing_session_id)) continue;
      seenSessions.add(r.pairing_session_id);

      const session = sessionMeta.get(r.pairing_session_id);
      if (!session) continue;
      const halves = rows.filter((x) => x.pairing_session_id === r.pairing_session_id);
      const cigarRow = halves.find((x) => x.product?.id === session.cigar_id);
      const bourbonRow = halves.find((x) => x.product?.id === session.bourbon_id);
      if (!cigarRow?.product || !bourbonRow?.product) continue;

      const createdAt = halves.reduce(
        (min, x) => (x.created_at < min ? x.created_at : min),
        halves[0].created_at,
      );

      const recommend = halves.every((x) => x.recommend);
      const chips = [...new Set(halves.flatMap((x) => x.chips ?? []))].slice(0, 3);
      const note = session.pairing_note ?? cigarRow.note ?? bourbonRow.note ?? null;

      items.push({
        kind: "pairing",
        pairing_session_id: r.pairing_session_id,
        tasting_id: cigarRow.id,
        user_id: r.user_id,
        display_name: r.user ? formatMemberName(r.user) : "Member",
        cigar_id: cigarRow.product.id,
        cigar_name: cigarRow.product.name,
        cigar_brand: cigarRow.product.brand,
        cigar_specs: cigarRow.product.specs,
        bourbon_id: bourbonRow.product.id,
        bourbon_name: bourbonRow.product.name,
        bourbon_brand: bourbonRow.product.brand,
        bourbon_specs: bourbonRow.product.specs,
        hero_image_path:
          session.photo_storage_path ?? heroByProduct.get(cigarRow.product.id) ?? null,
        recommend,
        chips,
        note,
        pairing_note: session.pairing_note,
        event_id: cigarRow.event_id,
        event_name: cigarRow.event?.name ?? null,
        created_at: createdAt,
      });
      continue;
    }

    items.push({
      kind: "tasting",
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
      release_label: r.release_label,
      event_id: r.event_id,
      event_name: r.event?.name ?? null,
      created_at: r.created_at,
    });
  }

  return items.slice(0, filters.limit ?? 50);
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

/** Signed URLs with a width transform for catalog grid thumbnails. */
export async function signThumbnailPaths(
  supabase: SupabaseClient,
  paths: (string | null)[],
  width = 400,
  ttlSeconds = 3600,
): Promise<Map<string, string>> {
  const map = await signImagePaths(supabase, paths, ttlSeconds);
  for (const [path, url] of map) {
    const separator = url.includes("?") ? "&" : "?";
    map.set(path, `${url}${separator}width=${width}&quality=75`);
  }
  return map;
}
