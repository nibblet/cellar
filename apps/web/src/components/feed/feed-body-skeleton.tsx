/**
 * Placeholder cards while the feed body streams in. Matches TastingCard
 * proportions so the layout doesn't jump when real entries arrive.
 */
export function FeedBodySkeleton() {
  return (
    <div className="flex flex-col gap-3" role="status" aria-busy="true" aria-label="Loading feed">
      {[0, 1, 2].map((i) => (
        <div
          key={i}
          className="rounded-[16px] border border-border bg-surface overflow-hidden animate-pulse"
        >
          <div className="aspect-[4/5] bg-surface-2" />
          <div className="px-3.5 py-3 space-y-2">
            <div className="h-4 bg-surface-2 rounded w-2/3" />
            <div className="h-3 bg-surface-2 rounded w-1/3" />
          </div>
        </div>
      ))}
    </div>
  );
}
