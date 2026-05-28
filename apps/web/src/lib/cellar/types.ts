export type CellarRow = {
  have: boolean;
  want: boolean;
  tried: boolean;
  /** Private "I love this" signal. Stronger than tried; never club-facing. */
  loved: boolean;
};

/** Partial update merged over the current row. */
export type CellarPatch = Partial<CellarRow>;

/** In-memory snapshot used for ranking bias and UI pre-population. */
export type CellarSnapshot = {
  have: Set<string>; // product_ids where have=true
  want: Set<string>;
  tried: Set<string>;
  loved: Set<string>;
};

export const EMPTY_SNAPSHOT: CellarSnapshot = {
  have: new Set(),
  want: new Set(),
  tried: new Set(),
  loved: new Set(),
};

export const ZERO_ROW: CellarRow = { have: false, want: false, tried: false, loved: false };

export function isZeroRow(row: CellarRow): boolean {
  return !row.have && !row.want && !row.tried && !row.loved;
}

/**
 * Merge a patch onto an existing row, enforcing three invariants:
 * 1. have and want are mutually exclusive.
 * 2. have=true implies tried=true (but tried can be manually unset separately).
 * 3. loved=true implies tried=true (you can only love what you've tried).
 */
export function applyPatch(current: CellarRow, patch: CellarPatch): CellarRow {
  const next = { ...current, ...patch };

  // Mutex
  if (patch.have === true) next.want = false;
  if (patch.want === true) next.have = false;

  // Have and loved both imply tried
  if (next.have || next.loved) next.tried = true;

  return next;
}
