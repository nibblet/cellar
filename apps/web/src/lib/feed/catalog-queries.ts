import type { SupabaseClient } from "@supabase/supabase-js";
import {
  bucketCigarWrapper,
  deriveBourbonStyles,
  deriveProofBand,
  normalizeCigarStrength,
} from "@/lib/preferences/derive";
import type {
  BourbonProofBand,
  BourbonStyle,
  CigarStrength,
  CigarWrapperBucket,
  MemberPreferences,
} from "@/lib/preferences/types";
import { hasAnyPreferences } from "@/lib/preferences/types";
import type { ProductType } from "@/lib/wheel";

export type CatalogSortKey =
  | "recommended" // default: most club recommendations desc
  | "az"
  | "recent"
  | "tasted"
  | "strength-asc"
  | "proof-asc"
  | "age-asc";

export type CatalogFilters = {
  // Cigars
  strength?: CigarStrength | null;
  wrappers?: CigarWrapperBucket[];
  origin?: string | null;
  // Bourbons
  styles?: BourbonStyle[];
  proofBand?: BourbonProofBand | null;
  ageBand?: "nas" | "4-8" | "8-12" | "12+" | null;
  // Shared
  clubOnly?: boolean;
  enrichedOnly?: boolean; // dev: has photo + populated specs
  sort?: CatalogSortKey;
};

export type CatalogEntry = {
  product_id: string;
  name: string;
  brand: string | null;
  type: ProductType;
  hero_image_path: string | null;
  matches_preferences: boolean;
};

type ProductRow = {
  id: string;
  name: string;
  brand: string | null;
  type: ProductType;
  specs: Record<string, unknown> | null;
  created_at: string;
};

type TastingCount = {
  product_id: string;
  tasting_count: number;
  rec_count: number;
};

/**
 * Load a catalog-browse slice for the Cigars / Bourbons tabs.
 *
 * Filtering and sorting happen in-memory after a single products fetch.
 * For 12 members and a few-hundred-item catalog this is fast and keeps
 * the query simple — no complex JSONB SQL expressions needed.
 *
 * The bucketing helpers in lib/preferences/derive.ts normalize the freeform
 * specs JSONB into the canonical filter vocabulary before matching.
 */
export async function loadCatalogBrowse(
  supabase: SupabaseClient,
  type: ProductType,
  preferences: MemberPreferences | null,
  limit = 100,
  filters: CatalogFilters = {},
): Promise<CatalogEntry[]> {
  const sort = filters.sort ?? "recommended";

  // Pull all confirmed products (we'll filter in-memory).
  const { data: rows } = await supabase
    .from("products")
    .select("id, name, brand, type, specs, created_at")
    .eq("type", type)
    .eq("status", "confirmed")
    .order("name", { ascending: true })
    .limit(limit);

  const products = ((rows ?? []) as ProductRow[]).filter((p) => Boolean(p.name));
  if (products.length === 0) return [];

  const productIds = products.map((p) => p.id);

  // Batch-fetch hero images and tasting counts in parallel.
  const [heroResult, countResult] = await Promise.all([
    supabase
      .from("product_images")
      .select("product_id, image_url, is_hero, created_at")
      .in("product_id", productIds)
      .order("is_hero", { ascending: false })
      .order("created_at", { ascending: false }),
    supabase
      .from("tastings")
      .select("product_id, recommend")
      .in("product_id", productIds),
  ]);

  const heroByProduct = new Map<string, string>();
  for (const h of heroResult.data ?? []) {
    if (!heroByProduct.has(h.product_id)) heroByProduct.set(h.product_id, h.image_url);
  }

  // Aggregate tasting + rec counts per product.
  const countByProduct = new Map<string, TastingCount>();
  for (const t of (countResult.data ?? []) as { product_id: string; recommend: boolean }[]) {
    const existing = countByProduct.get(t.product_id) ?? {
      product_id: t.product_id,
      tasting_count: 0,
      rec_count: 0,
    };
    existing.tasting_count += 1;
    if (t.recommend) existing.rec_count += 1;
    countByProduct.set(t.product_id, existing);
  }

  const matchesEnabled = preferences != null && hasAnyPreferences(preferences);
  const hasActiveFilters = hasFilters(filters);

  // Build + filter entries.
  let entries: (CatalogEntry & {
    _rec_count: number;
    _tasting_count: number;
    _created_at: string;
    _specs: Record<string, unknown>;
  })[] = [];

  for (const p of products) {
    const specs = (p.specs ?? {}) as Record<string, unknown>;
    const heroPath = heroByProduct.get(p.id) ?? null;
    const counts = countByProduct.get(p.id);

    // Apply filters.
    if (hasActiveFilters && !passesFilters(p, specs, heroPath, counts, filters)) continue;

    entries.push({
      product_id: p.id,
      name: p.name,
      brand: p.brand,
      type: p.type,
      hero_image_path: heroPath,
      matches_preferences:
        matchesEnabled && preferences
          ? matchesPreferencesCheck({ type: p.type, specs }, preferences)
          : false,
      _rec_count: counts?.rec_count ?? 0,
      _tasting_count: counts?.tasting_count ?? 0,
      _created_at: p.created_at,
      _specs: specs,
    });
  }

  // Sort.
  entries = sortEntries(entries, sort, matchesEnabled);

  return entries.map(({ _rec_count: _r, _tasting_count: _t, _created_at: _c, _specs: _s, ...e }) => e);
}

// ---------------------------------------------------------------------------
// Filtering
// ---------------------------------------------------------------------------

function hasFilters(f: CatalogFilters): boolean {
  return !!(
    f.strength ||
    f.wrappers?.length ||
    f.origin ||
    f.styles?.length ||
    f.proofBand ||
    f.ageBand ||
    f.clubOnly ||
    f.enrichedOnly
  );
}

function passesFilters(
  p: ProductRow,
  specs: Record<string, unknown>,
  heroPath: string | null,
  counts: TastingCount | undefined,
  f: CatalogFilters,
): boolean {
  // Enriched-only (dev): has hero image + specs with meaningful data
  if (f.enrichedOnly) {
    if (!heroPath) return false;
    const specKeys = Object.keys(specs).filter((k) => specs[k] != null && specs[k] !== "");
    if (specKeys.length < 3) return false;
  }

  // Club only: at least one member recommended it
  if (f.clubOnly && (!counts || counts.rec_count === 0)) return false;

  if (p.type === "cigar") {
    if (f.strength) {
      const norm = normalizeCigarStrength(typeof specs.strength === "string" ? specs.strength : null);
      if (norm !== f.strength) return false;
    }
    if (f.wrappers?.length) {
      const bucket = bucketCigarWrapper(typeof specs.wrapper === "string" ? specs.wrapper : null);
      if (!bucket || !f.wrappers.includes(bucket)) return false;
    }
    if (f.origin) {
      const country = typeof specs.country === "string" ? specs.country.toLowerCase() : "";
      if (!country.includes(f.origin.toLowerCase())) return false;
    }
  } else {
    if (f.styles?.length) {
      const derived = deriveBourbonStyles(specs);
      if (!f.styles.some((s) => derived.includes(s))) return false;
    }
    if (f.proofBand) {
      const proof = typeof specs.proof === "number" ? specs.proof : null;
      const band = deriveProofBand(proof);
      if (band !== f.proofBand) return false;
    }
    if (f.ageBand) {
      const age = typeof specs.age_years === "number" ? specs.age_years : null;
      if (!passesAgeBand(age, f.ageBand)) return false;
    }
  }

  return true;
}

function passesAgeBand(
  age: number | null,
  band: "nas" | "4-8" | "8-12" | "12+",
): boolean {
  if (band === "nas") return age == null || age === 0;
  if (age == null) return false;
  if (band === "4-8") return age >= 4 && age <= 8;
  if (band === "8-12") return age > 8 && age <= 12;
  if (band === "12+") return age > 12;
  return true;
}

// ---------------------------------------------------------------------------
// Sorting
// ---------------------------------------------------------------------------

type FullEntry = CatalogEntry & {
  _rec_count: number;
  _tasting_count: number;
  _created_at: string;
  _specs: Record<string, unknown>;
};

const STRENGTH_ORDER: Record<string, number> = {
  mild: 0,
  "mild-medium": 1,
  medium: 2,
  "medium-full": 3,
  full: 4,
};

function sortEntries(
  entries: FullEntry[],
  sort: CatalogSortKey,
  matchesEnabled: boolean,
): FullEntry[] {
  const sorted = [...entries];

  switch (sort) {
    case "az":
      sorted.sort((a, b) => a.name.localeCompare(b.name));
      break;
    case "recent":
      sorted.sort((a, b) => b._created_at.localeCompare(a._created_at));
      break;
    case "tasted":
      sorted.sort((a, b) => b._tasting_count - a._tasting_count || a.name.localeCompare(b.name));
      break;
    case "recommended":
      sorted.sort((a, b) => b._rec_count - a._rec_count || a.name.localeCompare(b.name));
      break;
    case "strength-asc": {
      sorted.sort((a, b) => {
        const sa = typeof a._specs.strength === "string" ? (STRENGTH_ORDER[a._specs.strength] ?? 99) : 99;
        const sb = typeof b._specs.strength === "string" ? (STRENGTH_ORDER[b._specs.strength] ?? 99) : 99;
        return sa - sb || a.name.localeCompare(b.name);
      });
      break;
    }
    case "proof-asc": {
      sorted.sort((a, b) => {
        const pa = typeof a._specs.proof === "number" ? a._specs.proof : 999;
        const pb = typeof b._specs.proof === "number" ? b._specs.proof : 999;
        return pa - pb || a.name.localeCompare(b.name);
      });
      break;
    }
    case "age-asc": {
      sorted.sort((a, b) => {
        const aa = typeof a._specs.age_years === "number" ? a._specs.age_years : 999;
        const ab = typeof b._specs.age_years === "number" ? b._specs.age_years : 999;
        return aa - ab || a.name.localeCompare(b.name);
      });
      break;
    }
  }

  // Regardless of sort, preferences matches bubble to the top when active.
  if (matchesEnabled) {
    sorted.sort((a, b) => {
      if (a.matches_preferences === b.matches_preferences) return 0;
      return a.matches_preferences ? -1 : 1;
    });
  }

  return sorted;
}

// ---------------------------------------------------------------------------
// Preference matching (inline — avoids importing productMatchesPreferences
// which has its own preference-matching logic that may differ from filter logic)
// ---------------------------------------------------------------------------

function matchesPreferencesCheck(
  product: { type: ProductType; specs: Record<string, unknown> | null },
  prefs: MemberPreferences,
): boolean {
  const specs = product.specs ?? {};
  if (product.type === "cigar") {
    if (prefs.cigar_strengths.length > 0) {
      const s = normalizeCigarStrength(typeof specs.strength === "string" ? specs.strength : null);
      if (s && prefs.cigar_strengths.includes(s)) return true;
    }
    if (prefs.cigar_wrappers.length > 0) {
      const w = bucketCigarWrapper(typeof specs.wrapper === "string" ? specs.wrapper : null);
      if (w && prefs.cigar_wrappers.includes(w)) return true;
    }
  } else {
    if (prefs.bourbon_styles.length > 0) {
      const styles = deriveBourbonStyles(specs);
      if (styles.some((s) => prefs.bourbon_styles.includes(s))) return true;
    }
    if (prefs.bourbon_proof_bands.length > 0) {
      const proof = typeof specs.proof === "number" ? specs.proof : null;
      const band = deriveProofBand(proof);
      if (band && prefs.bourbon_proof_bands.includes(band)) return true;
    }
  }
  return false;
}
