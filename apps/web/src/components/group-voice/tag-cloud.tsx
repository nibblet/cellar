import type { TagCloudEntry } from "@/lib/aggregation/group-voice";

type TagCloudProps = {
  entries: TagCloudEntry[];
};

/**
 * Size by frequency. Each entry's `score` is 0..1 with the top entry at 1.0.
 * We render with a fluid font-size and dot-size so the most-mentioned leaves
 * read at a glance without looking algorithmic.
 */
export function TagCloud({ entries }: TagCloudProps) {
  if (entries.length === 0) {
    return (
      <p className="text-sm text-foreground-subtle">
        Not enough impressions yet to draw a profile.
      </p>
    );
  }

  return (
    <div className="flex flex-wrap items-baseline gap-x-4 gap-y-2">
      {entries.map((entry) => {
        // Map score 0..1 → font-size 14..22px and dot opacity 0.5..1.
        const fontSize = 14 + entry.score * 8;
        const dotSize = 6 + entry.score * 4;
        const dotOpacity = 0.55 + entry.score * 0.45;
        return (
          <span key={entry.leaf_id} className="inline-flex items-center gap-1.5">
            <span
              aria-hidden="true"
              className="rounded-full bg-accent inline-block"
              style={{ width: dotSize, height: dotSize, opacity: dotOpacity }}
            />
            <span style={{ fontSize }} className="text-foreground">
              {entry.label}
            </span>
          </span>
        );
      })}
    </div>
  );
}
