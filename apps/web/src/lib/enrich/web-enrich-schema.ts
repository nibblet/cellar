import { getWheel, type ProductType } from "@/lib/wheel";
import { BOURBON_SCHEMA, CIGAR_SCHEMA } from "./specs-extractor";

const FLAVOR_ITEM = {
  type: "object",
  properties: {
    leaf_id: { type: "string" },
    score: { type: "integer", minimum: 1, maximum: 5 },
  },
  required: ["leaf_id", "score"],
  additionalProperties: false,
} as const;

function specsSchema(type: ProductType) {
  return type === "cigar" ? CIGAR_SCHEMA : BOURBON_SCHEMA;
}

export function buildWebEnrichSchema(type: ProductType, imageOnly: boolean) {
  if (imageOnly) {
    return {
      type: "object",
      properties: {
        image_url: { type: ["string", "null"] },
        source_urls: { type: "array", items: { type: "string" } },
      },
      required: ["image_url", "source_urls"],
      additionalProperties: false,
    } as const;
  }

  return {
    type: "object",
    properties: {
      image_url: { type: ["string", "null"] },
      source_urls: { type: "array", items: { type: "string" } },
      specs: specsSchema(type),
      flavors: { type: "array", items: FLAVOR_ITEM },
    },
    required: ["image_url", "source_urls", "specs", "flavors"],
    additionalProperties: false,
  } as const;
}

export function wheelLeafIdsForPrompt(type: ProductType): string[] {
  return getWheel(type).leaves.map((leaf) => leaf.id);
}
