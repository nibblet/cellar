import type { TagCloudEntry } from "@/lib/aggregation/group-voice";

type TagCloudProps = {
  entries: TagCloudEntry[];
};

/**
 * Typographic centerpiece (UX-3). The cloud carries "how it tastes" entirely
 * on its own — no surrounding label, no list, no chart. Words are sized by
 * frequency in Playfair Display so the top descriptors read as an editorial
 * pull-quote, not a tag list.
 *
 * Each entry's `score` is 0..1 with the top entry at 1.0; we scale font
 * weight (400 → 700) and opacity in addition to size so the eye lands on
 * the top hits without help.
 */
export function TagCloud({ entries }: TagCloudProps) {
  if (entries.length === 0) {
    return (
      <p className="text-sm text-foreground-subtle italic">
        Not enough impressions yet to draw a profile.
      </p>
    );
  }

  return (
    <div className="flex flex-wrap items-baseline justify-center gap-x-5 gap-y-3 py-2">
      {entries.map((entry) => {
        // Map score 0..1 → font-size 18..36px, weight 400..800, opacity 0.55..1.
        const fontSize = 18 + entry.score * 18;
        const fontWeight = Math.round(400 + entry.score * 400);
        const opacity = 0.55 + entry.score * 0.45;
        return (
          <span
            key={entry.leaf_id}
            className="font-display leading-tight text-foreground"
            style={{ fontSize, fontWeight, opacity }}
          >
            {entry.label}
          </span>
        );
      })}
    </div>
  );
}
