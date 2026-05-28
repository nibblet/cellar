/** One Try Next pick as cached and rendered. */
export type TryNextPick = {
  product_id: string;
  name: string;
  brand: string | null;
  image_url: string | null;
  /** Winston's one-line read on why it fits this member's palate. */
  rationale: string;
};

/**
 * Cached Try Next recommendations for a member, stored on
 * users.taste_recommendations. Keyed by signal_hash so it regenerates when the
 * member's tried/loved products or preferences change.
 */
export type TasteRecommendations = {
  cigars: TryNextPick[];
  bourbons: TryNextPick[];
  signal_hash: string;
  generated_at: string;
};
