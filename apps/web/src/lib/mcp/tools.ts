import type { SupabaseClient } from "@supabase/supabase-js";
import { loadGroupVoice } from "@/lib/aggregation/group-voice";
import { loadCellarSnapshot } from "@/lib/cellar/load";
import { loadDailyPourCandidates } from "@/lib/daily-pour/load";
import { selectDailyPour, todayKey } from "@/lib/daily-pour/select";
import { type PairingCandidate, suggestPairings } from "@/lib/pairing/engine";
import { checkGroupValidation, type GroupValidation } from "@/lib/pairing/group-validation";
import { loadCachedPairingProse } from "@/lib/pairing/prose-cache";
import { loadMemberPreferences } from "@/lib/preferences/load";
import { suggestAdjacentProducts } from "@/lib/similarity/suggest-adjacent";
import type { ProductType } from "@/lib/wheel";
import { resolveProductByQuery } from "./resolve-product";

export type McpToolError = {
  ok: false;
  error: string;
};

export type McpToolSuccess<T> = {
  ok: true;
  data: T;
};

export type McpToolResult<T> = McpToolSuccess<T> | McpToolError;

function success<T>(data: T): McpToolSuccess<T> {
  return { ok: true, data };
}

function failure(error: string): McpToolError {
  return { ok: false, error };
}

async function resolveMemberIdByEmail(
  supabase: SupabaseClient,
  email: string,
): Promise<string | null> {
  const normalized = email.trim().toLowerCase();
  if (!normalized) return null;

  const { data } = await supabase.auth.admin.listUsers({ perPage: 1000 });
  const user = data.users.find((u) => u.email?.toLowerCase() === normalized);
  return user?.id ?? null;
}

export type SearchProductsInput = {
  query: string;
  type?: ProductType | "all";
  limit?: number;
};

export type SearchProductsResult = {
  candidates: Array<{
    product_id: string;
    name: string;
    brand: string | null;
    type: ProductType;
    score: number;
  }>;
};

export async function mcpSearchProducts(
  supabase: SupabaseClient,
  input: SearchProductsInput,
): Promise<McpToolResult<SearchProductsResult>> {
  const resolved = await resolveProductByQuery(supabase, {
    query: input.query,
    type: input.type ?? "all",
    limit: input.limit ?? 5,
  });

  return success({
    candidates: resolved.candidates.map((c) => ({
      product_id: c.id,
      name: c.name,
      brand: c.brand,
      type: c.type,
      score: c.score,
    })),
  });
}

export type GetProductInput = {
  product_id: string;
};

export type GetProductResult = {
  product_id: string;
  name: string;
  brand: string | null;
  type: ProductType;
  specs: Record<string, unknown> | null;
  member_count: number;
  recommend_count: number;
  top_flavors: string[];
};

export async function mcpGetProduct(
  supabase: SupabaseClient,
  input: GetProductInput,
): Promise<McpToolResult<GetProductResult>> {
  const { data: product } = await supabase
    .from("products")
    .select("id, name, brand, type, specs")
    .eq("id", input.product_id)
    .eq("status", "confirmed")
    .maybeSingle();

  if (!product) {
    return failure(
      `Product ${input.product_id} not found. Call search_products with the product name.`,
    );
  }

  const voice = await loadGroupVoice(supabase, product.id, product.type as ProductType);

  return success({
    product_id: product.id,
    name: product.name,
    brand: product.brand,
    type: product.type as ProductType,
    specs: (product.specs as Record<string, unknown> | null) ?? null,
    member_count: voice.member_count,
    recommend_count: voice.recommend_count,
    top_flavors: voice.tag_cloud.slice(0, 5).map((t) => t.label),
  });
}

export type PairingPick = PairingCandidate & {
  source: "your_shelf" | "catalog";
  club_validation: GroupValidation | null;
};

export type SuggestPairingsInput = {
  product_id: string;
  limit?: number;
  member_email?: string;
};

export type SuggestPairingsResult = {
  source_product_id: string;
  source_type: ProductType;
  pairings: PairingPick[];
};

async function enrichPairingsWithValidation(
  supabase: SupabaseClient,
  sourceProductId: string,
  sourceType: ProductType,
  picks: Array<PairingCandidate & { source: "your_shelf" | "catalog" }>,
): Promise<PairingPick[]> {
  return Promise.all(
    picks.map(async (pick) => {
      const cigarId = sourceType === "cigar" ? sourceProductId : pick.product_id;
      const bourbonId = sourceType === "bourbon" ? sourceProductId : pick.product_id;
      const club_validation = await checkGroupValidation(supabase, cigarId, bourbonId);
      return { ...pick, club_validation };
    }),
  );
}

export async function mcpSuggestPairings(
  supabase: SupabaseClient,
  input: SuggestPairingsInput,
): Promise<McpToolResult<SuggestPairingsResult>> {
  const limit = input.limit ?? 3;

  const { data: source } = await supabase
    .from("products")
    .select("id, type, trait_vector")
    .eq("id", input.product_id)
    .maybeSingle();

  if (!source?.trait_vector) {
    return failure(
      `Product ${input.product_id} not found or has no flavor profile. Call search_products first.`,
    );
  }

  const sourceType = source.type as ProductType;
  const memberId = input.member_email
    ? await resolveMemberIdByEmail(supabase, input.member_email)
    : null;

  const merged: Array<PairingCandidate & { source: "your_shelf" | "catalog" }> = [];
  const seen = new Set<string>();

  if (memberId) {
    const shelf = await suggestPairings(supabase, input.product_id, {
      candidatePool: "shelf",
      memberId,
      limit,
    });
    for (const pick of shelf) {
      if (seen.has(pick.product_id)) continue;
      seen.add(pick.product_id);
      merged.push({ ...pick, source: "your_shelf" });
    }
  }

  const catalog = await suggestPairings(supabase, input.product_id, { limit: limit + 2 });
  for (const pick of catalog) {
    if (seen.has(pick.product_id)) continue;
    seen.add(pick.product_id);
    merged.push({ ...pick, source: "catalog" });
    if (merged.length >= limit) break;
  }

  const pairings = await enrichPairingsWithValidation(
    supabase,
    input.product_id,
    sourceType,
    merged.slice(0, limit),
  );

  return success({
    source_product_id: input.product_id,
    source_type: sourceType,
    pairings,
  });
}

export type SuggestSimilarInput = {
  product_id: string;
  limit?: number;
  match_tier?: boolean;
};

export type SimilarPick = {
  product_id: string;
  name: string;
  brand: string | null;
  similarity: number;
  similarity_pct: number;
  tier: number | null;
  price_usd: number | null;
};

export type SuggestSimilarResult = {
  source_product_id: string;
  similar: SimilarPick[];
};

export async function mcpSuggestSimilar(
  supabase: SupabaseClient,
  input: SuggestSimilarInput,
): Promise<McpToolResult<SuggestSimilarResult>> {
  const { data: source } = await supabase
    .from("products")
    .select("id")
    .eq("id", input.product_id)
    .maybeSingle();

  if (!source) {
    return failure(
      `Product ${input.product_id} not found. Call search_products with the product name.`,
    );
  }

  const similar = await suggestAdjacentProducts(supabase, input.product_id, {
    limit: input.limit ?? 3,
    matchTier: input.match_tier ?? true,
  });

  return success({
    source_product_id: input.product_id,
    similar: similar.map((s) => ({
      product_id: s.product_id,
      name: s.name,
      brand: s.brand,
      similarity: s.similarity,
      similarity_pct: Math.round(s.similarity * 100),
      tier: s.tier,
      price_usd: s.price_usd,
    })),
  });
}

export type RecommendInput = {
  query: string;
  intent: "pair" | "similar";
  type?: ProductType | "all";
  member_email?: string;
};

export type RecommendResult = {
  matched: boolean;
  product_id: string | null;
  product_name: string | null;
  product_brand: string | null;
  product_type: ProductType | null;
  confidence: number;
  candidates: SearchProductsResult["candidates"];
  pairings?: SuggestPairingsResult["pairings"];
  similar?: SuggestSimilarResult["similar"];
};

export async function mcpRecommend(
  supabase: SupabaseClient,
  input: RecommendInput,
): Promise<McpToolResult<RecommendResult>> {
  const resolved = await resolveProductByQuery(supabase, {
    query: input.query,
    type: input.type ?? "all",
    limit: 3,
  });

  if (!resolved.matched || !resolved.productId) {
    return success({
      matched: false,
      product_id: null,
      product_name: resolved.candidates[0]?.name ?? null,
      product_brand: resolved.candidates[0]?.brand ?? null,
      product_type: resolved.candidates[0]?.type ?? null,
      confidence: resolved.confidence,
      candidates: resolved.candidates.map((c) => ({
        product_id: c.id,
        name: c.name,
        brand: c.brand,
        type: c.type,
        score: c.score,
      })),
    });
  }

  const { data: product } = await supabase
    .from("products")
    .select("id, name, brand, type")
    .eq("id", resolved.productId)
    .maybeSingle();

  if (!product) {
    return failure(`Resolved product ${resolved.productId} missing from catalog.`);
  }

  if (input.intent === "pair") {
    const pairResult = await mcpSuggestPairings(supabase, {
      product_id: resolved.productId,
      member_email: input.member_email,
    });
    if (!pairResult.ok) return pairResult;

    return success({
      matched: true,
      product_id: product.id,
      product_name: product.name,
      product_brand: product.brand,
      product_type: product.type as ProductType,
      confidence: resolved.confidence,
      candidates: resolved.candidates.map((c) => ({
        product_id: c.id,
        name: c.name,
        brand: c.brand,
        type: c.type,
        score: c.score,
      })),
      pairings: pairResult.data.pairings,
    });
  }

  const similarResult = await mcpSuggestSimilar(supabase, {
    product_id: resolved.productId,
    match_tier: true,
  });
  if (!similarResult.ok) return similarResult;

  return success({
    matched: true,
    product_id: product.id,
    product_name: product.name,
    product_brand: product.brand,
    product_type: product.type as ProductType,
    confidence: resolved.confidence,
    candidates: resolved.candidates.map((c) => ({
      product_id: c.id,
      name: c.name,
      brand: c.brand,
      type: c.type,
      score: c.score,
    })),
    similar: similarResult.data.similar,
  });
}

export type TonightsPickInput = {
  member_email?: string;
};

export type TonightsPickResult = {
  date: string;
  personalized: boolean;
  pool_size: number;
  pick: {
    cigar_id: string;
    cigar_name: string;
    cigar_brand: string | null;
    bourbon_id: string;
    bourbon_name: string;
    bourbon_brand: string | null;
    score: number;
    club_validated: boolean;
    rationale: string | null;
    on_your_shelf: boolean;
  } | null;
};

/** Deterministic daily cigar+bourbon pick — same logic as the feed Daily Pour hero. */
export async function mcpTonightsPick(
  supabase: SupabaseClient,
  input: TonightsPickInput,
): Promise<McpToolResult<TonightsPickResult>> {
  const date = todayKey();
  const memberId = input.member_email
    ? await resolveMemberIdByEmail(supabase, input.member_email)
    : null;
  const preferences = memberId ? await loadMemberPreferences(supabase, memberId) : null;
  const candidates = await loadDailyPourCandidates(supabase, preferences, memberId);
  const selected = selectDailyPour({ memberId: memberId ?? "club", date }, candidates);

  if (!selected) {
    return success({
      date,
      personalized: Boolean(memberId),
      pool_size: 0,
      pick: null,
    });
  }

  const cached = await loadCachedPairingProse(supabase, selected.cigar_id, selected.bourbon_id);
  const rationale = cached?.notes ?? selected.rationale;

  let onYourShelf = false;
  if (memberId) {
    const cellar = await loadCellarSnapshot(supabase, memberId);
    onYourShelf = cellar.have.has(selected.cigar_id) && cellar.have.has(selected.bourbon_id);
  }

  return success({
    date,
    personalized: Boolean(memberId),
    pool_size: candidates.length,
    pick: {
      cigar_id: selected.cigar_id,
      cigar_name: selected.cigar_name,
      cigar_brand: selected.cigar_brand,
      bourbon_id: selected.bourbon_id,
      bourbon_name: selected.bourbon_name,
      bourbon_brand: selected.bourbon_brand,
      score: selected.score,
      club_validated: selected.club_validated,
      rationale,
      on_your_shelf: onYourShelf,
    },
  });
}
