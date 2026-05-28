export { ensureTasteRecommendations } from "./load";
export {
  PREFERENCE_BOOST,
  RECOMMENDATIONS_PER_TYPE,
  type RecommendParams,
  recommendForType,
  type ScoredCandidate,
  type TasteCandidate,
} from "./recommend";
export type { TasteRecommendations, TryNextPick } from "./types";
export {
  buildTasteVector,
  COLD_START_THRESHOLD,
  dominantTraits,
  SIGNAL_WEIGHT,
  type TasteSignal,
  totalSignalWeight,
} from "./vector";
