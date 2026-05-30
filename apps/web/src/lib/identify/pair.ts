import type { SupabaseClient } from "@supabase/supabase-js";
import { identifyProductFromImage } from "@/lib/openai/identify";
import { type CatalogMatchResult, matchExtractedToCatalog } from "./match";

export type PairIdentifyHalf = CatalogMatchResult & {
  displayName: string;
  displayBrand: string | null;
};

export type PairIdentifyResult = {
  cigar: PairIdentifyHalf;
  bourbon: PairIdentifyHalf;
};

function halfDisplay(match: CatalogMatchResult): {
  displayName: string;
  displayBrand: string | null;
} {
  if (match.productId && match.topCandidates[0]) {
    const p = match.topCandidates.find((c) => c.id === match.productId) ?? match.topCandidates[0];
    return { displayName: p.name, displayBrand: p.brand };
  }
  return { displayName: match.extracted.name, displayBrand: match.extracted.brand };
}

/**
 * Parallel vision on one pairing photo: cigar + bourbon extraction, then
 * catalog fuzzy match for each half. No storage or product rows written.
 */
export async function identifyPairFromImage(args: {
  supabase: SupabaseClient;
  userId: string;
  imageUrl: string;
}): Promise<PairIdentifyResult> {
  const { supabase, userId, imageUrl } = args;

  const [cigarExtracted, bourbonExtracted] = await Promise.all([
    identifyProductFromImage({
      imageUrl,
      expectedType: "cigar",
      supabase,
      userId,
    }),
    identifyProductFromImage({
      imageUrl,
      expectedType: "bourbon",
      supabase,
      userId,
    }),
  ]);

  const [cigarMatch, bourbonMatch] = await Promise.all([
    matchExtractedToCatalog(supabase, "cigar", cigarExtracted),
    matchExtractedToCatalog(supabase, "bourbon", bourbonExtracted),
  ]);

  // When matched, resolve display from catalog row (topCandidates may omit winner).
  const cigarDisplay = await resolveDisplay(supabase, cigarMatch);
  const bourbonDisplay = await resolveDisplay(supabase, bourbonMatch);

  return {
    cigar: { ...cigarMatch, ...cigarDisplay },
    bourbon: { ...bourbonMatch, ...bourbonDisplay },
  };
}

async function resolveDisplay(
  supabase: SupabaseClient,
  match: CatalogMatchResult,
): Promise<{ displayName: string; displayBrand: string | null }> {
  if (match.productId) {
    const { data } = await supabase
      .from("products")
      .select("name, brand")
      .eq("id", match.productId)
      .maybeSingle();
    if (data) {
      return {
        displayName: data.name as string,
        displayBrand: (data.brand as string | null) ?? null,
      };
    }
  }
  return halfDisplay(match);
}
