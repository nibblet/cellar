export type IdentifiedHalfPayload = {
  productId: string | null;
  matched: boolean;
  confidence: "high" | "medium" | "low";
  displayName: string;
  displayBrand: string | null;
  releaseLabel: string | null;
  extractedName: string;
  extractedBrand: string | null;
};

export type IdentifyPairingState =
  | { status: "idle" }
  | { status: "error"; message: string }
  | {
      status: "identified";
      storagePath: string;
      previewDataUrl?: string;
      cigar: IdentifiedHalfPayload;
      bourbon: IdentifiedHalfPayload;
    };
