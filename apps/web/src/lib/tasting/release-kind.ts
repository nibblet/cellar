/**
 * Classify a release label into its kind. A specific bottling rides on the
 * primary expression as a release_label tag (not a separate catalog entry);
 * the kind lets us distinguish a store pick from a club private selection,
 * a named batch, or an annual vintage — for display and pairing.
 *
 * Best-effort: returns null when the label carries no clear signal (e.g. a
 * bare store name), in which case the raw label still shows.
 */

export type ReleaseKind = "store-pick" | "private-selection" | "batch" | "vintage";

export function classifyReleaseKind(input: string | null | undefined): ReleaseKind | null {
  const s = (input ?? "").trim().toLowerCase();
  if (!s) return null;

  if (/\bprivate\s+(?:selection|barrel)\b|\bclub\s+pick\b/.test(s)) return "private-selection";
  if (
    /\b(?:store|barrel|shop)\s+pick\b|\bhand[-\s]?(?:selected|picked)\b|\bpicked\s+by\b|\bselected\s+(?:for|by)\b/.test(
      s,
    )
  )
    return "store-pick";
  if (/^(?:19|20)\d{2}$/.test(s)) return "vintage";
  if (/\bbatch\b/.test(s) || /^[a-z]?\d+[a-z]?$/.test(s)) return "batch";

  return null;
}
