import type { PairingCandidate } from "@/lib/pairing/engine";
import type { AdjacentProduct } from "@/lib/similarity/suggest-adjacent";
import type { TryNextPick } from "@/lib/taste/types";
import type { ProductType } from "@/lib/wheel";

export type SuggestionKind = "try_tonight" | "hunt_next";

export type CrossTypePick = PairingCandidate & {
  source: "cellar" | "catalog";
  onShelf: boolean;
  clubValidated: boolean;
  cigar_id: string;
  bourbon_id: string;
};

export type ReachForNextPick = AdjacentProduct & {
  onShelf: boolean;
  source: "cellar" | "catalog";
};

export type WhileLookingSuggestions = {
  similarInTier: AdjacentProduct[];
  pairsWellWith: CrossTypePick | null;
};

export type ProductSuggestions = {
  sourceProductId: string;
  sourceType: ProductType;
  tryTonight: CrossTypePick | null;
  tryTonightCatalog: CrossTypePick | null;
  reachForNext: ReachForNextPick[];
  huntNext: TryNextPick | null;
  whileLooking: WhileLookingSuggestions;
};
