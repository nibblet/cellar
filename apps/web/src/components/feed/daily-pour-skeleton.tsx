/**
 * Placeholder for the Daily Pour hero while candidates + cached prose load.
 * Matches DailyPourCard proportions so the layout doesn't jump.
 */
export function DailyPourSkeleton() {
  return (
    <div
      className="mb-4 rounded-[16px] border border-border bg-surface p-4 animate-pulse"
      role="status"
      aria-busy="true"
      aria-label="Loading Winston's pick"
    >
      <div className="flex items-center gap-2.5">
        <div className="size-11 rounded-full bg-surface-2 shrink-0" />
        <div className="h-3 bg-surface-2 rounded w-24" />
      </div>
      <div className="mt-2 mb-3 space-y-2">
        <div className="h-4 bg-surface-2 rounded w-full" />
        <div className="h-4 bg-surface-2 rounded w-4/5" />
      </div>
      <div className="space-y-3">
        <div>
          <div className="h-5 bg-surface-2 rounded w-2/3" />
          <div className="h-3 bg-surface-2 rounded w-1/3 mt-1.5" />
        </div>
        <div className="h-3 bg-surface-2 rounded w-16" />
        <div>
          <div className="h-5 bg-surface-2 rounded w-3/5" />
          <div className="h-3 bg-surface-2 rounded w-1/4 mt-1.5" />
        </div>
      </div>
      <div className="h-4 bg-surface-2 rounded w-32 mt-3" />
    </div>
  );
}
