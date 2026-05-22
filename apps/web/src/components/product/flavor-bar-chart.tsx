import type { TagCloudEntry } from "@/lib/aggregation/group-voice";

type FlavorBarChartProps = {
  entries: TagCloudEntry[];
  /** Max entries to render (default 8). */
  maxEntries?: number;
};

/**
 * Horizontal bar chart for the depth-view flavor profile (UX-3 tier 2).
 * Flavor categories on Y, relative intensity on X. Bars are brass-toned;
 * the widths are normalized to the top entry so the dominant note always
 * fills the rail.
 *
 * Replaces the radar chart which was hard to read and implied "more = better".
 */
export function FlavorBarChart({ entries, maxEntries = 8 }: FlavorBarChartProps) {
  if (entries.length === 0) {
    return (
      <p className="text-sm text-foreground-subtle italic">
        Log a tasting to start building the flavor profile.
      </p>
    );
  }

  const visible = entries.slice(0, maxEntries);

  return (
    <dl className="flex flex-col gap-3">
      {visible.map((entry) => {
        const pct = Math.round(entry.score * 100);
        return (
          <div key={entry.leaf_id} className="grid grid-cols-[120px,1fr] items-center gap-3">
            <dt className="text-[11px] uppercase tracking-widest text-foreground-subtle truncate text-right">
              {entry.label}
            </dt>
            <dd className="relative h-2 rounded-full bg-surface-2 overflow-hidden">
              <div
                className="absolute inset-y-0 left-0 rounded-full bg-accent"
                style={{ width: `${pct}%` }}
                aria-label={`${pct}%`}
              />
            </dd>
          </div>
        );
      })}
    </dl>
  );
}
