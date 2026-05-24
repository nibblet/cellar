export type FindNextMode = "pairing" | "pour" | "smoke";

export type FindNextSource = "cellar" | "catalog";

export type FindNextPairSuggestion = {
  kind: "pairing";
  source: FindNextSource;
  cigar_id: string;
  cigar_name: string;
  cigar_brand: string | null;
  bourbon_id: string;
  bourbon_name: string;
  bourbon_brand: string | null;
  score: number;
  club_validated: boolean;
};

export type FindNextProductSuggestion = {
  kind: "product";
  source: FindNextSource;
  product_id: string;
  name: string;
  brand: string | null;
  product_type: "cigar" | "bourbon";
};

export type FindNextSuggestions = {
  pairing: FindNextPairSuggestion[];
  pour: FindNextProductSuggestion[];
  smoke: FindNextProductSuggestion[];
};

export const FIND_NEXT_LIMIT = 5;
