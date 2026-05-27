/**
 * Shared catalog-spine classifier. Single source of truth for both the
 * dry-run prototype and the production backfill, so they can't drift.
 *
 * Given a product's name + distillery (+ optional enrichment/Cobb signals),
 * resolve its place in the producer → brand_family → expression hierarchy and
 * decide whether it belongs in the cut-back member-facing catalog.
 */

import { CORE_RANGES, type CoreExpression, type ExpressionStatus, resolveBrandFamily } from "./brand-spine";

export type SpineInput = {
  id?: string;
  name: string;
  /** CSV `Distillery` or DB `products.brand` (both are distillery-ish). */
  distillery: string;
  specs?: Record<string, unknown> | null;
  rating?: number | null;
  /** Paul owns this bottle (specs.in_cobb_collection). */
  inCobb?: boolean;
  /** Has wheel_vector / mirrored image — i.e. enrichment we paid for. */
  enriched?: boolean;
};

export type SpineFields = {
  producer: string;
  brand_family: string;
  /** Canonical expression name, brand_family-prefixed. */
  expression: string;
  release_label: string | null;
  status: ExpressionStatus;
  is_core_range: boolean;
  discontinued: boolean;
  nas: boolean;
  spirit_type: "bourbon" | "rye";
  curated: boolean;
};

export function stripProof(name: string): string {
  return name.replace(/,?\s*\(?\d+(\.\d+)?\s*%\)?\s*$/, "").trim();
}

/** Release identity (year / batch / pick) so vintage variants fold together. */
export function releaseLabel(name: string): string | null {
  const batch = name.match(/batch\s*#?\s*([0-9a-z-]+)/i);
  if (batch) return `Batch ${batch[1].toUpperCase()}`;
  const pick = name.match(/no\.?\s*(\d{3,5})/i);
  if (pick) return `Pick No. ${pick[1]}`;
  const year = name.match(/\b(20\d{2}|19\d{2})\b/);
  if (year) return year[1];
  return null;
}

function cleanExpression(remainder: string): string {
  return remainder
    .replace(/kentucky straight bourbon( whiskey)?/gi, "")
    .replace(/\b(20\d{2}|19\d{2})\b/g, "")
    .replace(/\(.*?\)/g, "")
    .replace(/batch\s*#?\s*[0-9a-z-]+/gi, "")
    .replace(/no\.?\s*\d{3,5}/gi, "")
    .replace(/\b\d+(\.\d+)?\s*%/g, "")
    .replace(/[,#]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function hasAgeStatement(name: string, specs: Record<string, unknown> | null | undefined): boolean {
  const age = specs?.age_years;
  if (typeof age === "number" && age > 0) return true;
  return /\b\d{1,2}\s*(year|yr)\b/i.test(name);
}

export function classifyProduct(input: SpineInput): SpineFields {
  const proofName = stripProof(input.name.trim());
  const { producer, brand_family } = resolveBrandFamily(proofName, input.distillery ?? "");
  const overlay = CORE_RANGES[brand_family];
  const curated = Boolean(overlay);

  let canonical: string;
  let status: ExpressionStatus;
  let spirit_type: "bourbon" | "rye";

  const hit: CoreExpression | undefined = overlay?.find((e) => e.pattern.test(proofName));
  if (hit) {
    canonical = `${brand_family} ${hit.canonical}`.replace(`${brand_family} ${brand_family}`, brand_family);
    status = hit.status;
    spirit_type = hit.spirit_type ?? "bourbon";
  } else {
    const prefix = new RegExp(`^${brand_family.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*`, "i");
    const remainder = cleanExpression(proofName.replace(prefix, ""));
    canonical = remainder ? `${brand_family} ${remainder}` : brand_family;
    status = "uncurated";
    spirit_type = /\brye\b/i.test(proofName) ? "rye" : "bourbon";
  }

  return {
    producer,
    brand_family,
    expression: canonical,
    release_label: releaseLabel(input.name),
    status,
    is_core_range: status === "core",
    discontinued: status === "discontinued",
    nas: !hasAgeStatement(input.name, input.specs),
    spirit_type,
    curated,
  };
}

// ---------------------------------------------------------------------------
// Cut-back planning: one clean survivor per expression; keep the rest hidden
// but promotable. The Cobb collection (bottles Paul owns) is always carried.
// ---------------------------------------------------------------------------

export type CutbackDecision = {
  include: boolean;
  survivor: boolean;
  reason: string;
};

type Scored = { input: SpineInput; fields: SpineFields; idx: number };

/** Higher score = preferred survivor within an expression group. */
function survivorScore(s: Scored): number {
  let n = 0;
  if (s.input.inCobb) n += 1000;
  if (s.input.enriched) n += 100;
  n += s.input.rating ?? 0;
  return n;
}

/**
 * Decide catalog inclusion for a set of products. Grouped by expression
 * (ignoring release label) so each expression yields one survivor.
 */
export function planCutback(items: Array<{ input: SpineInput; fields: SpineFields }>): Map<number, CutbackDecision> {
  const groups = new Map<string, Scored[]>();
  items.forEach((it, idx) => {
    const key = `${it.fields.brand_family}::${it.fields.expression}`;
    const list = groups.get(key) ?? [];
    list.push({ ...it, idx });
    groups.set(key, list);
  });

  const decisions = new Map<number, CutbackDecision>();
  for (const group of groups.values()) {
    const survivor = [...group].sort((a, b) => survivorScore(b) - survivorScore(a))[0];
    for (const s of group) {
      const isSurvivor = s.idx === survivor.idx;
      let include = false;
      let reason: string;
      if (s.input.inCobb) {
        include = true;
        reason = "Cobb collection — Paul owns it";
      } else if (!isSurvivor) {
        reason = "duplicate of survivor (hidden, promotable)";
      } else if (s.fields.discontinued) {
        reason = "discontinued (hidden, promotable)";
      } else if (!s.fields.curated) {
        reason = "uncurated long tail (hidden, promotable)";
      } else if (s.fields.status === "core" || s.fields.status === "limited") {
        include = true;
        reason = `curated ${s.fields.status} expression`;
      } else {
        reason = "not in core range (hidden, promotable)";
      }
      decisions.set(s.idx, { include, survivor: isSurvivor, reason });
    }
  }
  return decisions;
}
