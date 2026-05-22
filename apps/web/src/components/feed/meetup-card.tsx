type MeetupEvent = {
  id: string;
  name: string;
  date: string;
  notes: string | null;
  tasting_count?: number;
};

type MeetupCardProps = {
  upcoming: MeetupEvent | null;
  last: MeetupEvent | null;
};

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}

/**
 * Inline meetup awareness card on the Feed. Shows last meeting (greyed,
 * for context) and the next upcoming (normal weight, prominent).
 *
 * Replaces the separate /events index route — two meetings worth of info
 * is all that belongs on the feed surface.
 */
export function MeetupCard({ upcoming, last }: MeetupCardProps) {
  if (!upcoming && !last) return null;

  return (
    <div className="rounded-2xl border border-border bg-surface px-4 py-3 flex flex-col gap-2">
      {last ? (
        <div className="flex items-baseline justify-between gap-3 opacity-50">
          <p className="text-[10px] uppercase tracking-widest text-foreground-subtle">Last met</p>
          <p className="text-xs text-foreground-subtle tabular-nums">{formatDate(last.date)}</p>
          {last.tasting_count != null && last.tasting_count > 0 ? (
            <p className="text-xs text-foreground-subtle ml-auto">
              {last.tasting_count} {last.tasting_count === 1 ? "tasting" : "tastings"}
            </p>
          ) : null}
        </div>
      ) : null}

      {upcoming ? (
        <div className="flex items-baseline justify-between gap-3">
          <p className="text-[10px] uppercase tracking-widest text-accent">Next up</p>
          <p className="text-sm font-medium text-foreground flex-1 truncate ml-2">
            {upcoming.name}
          </p>
          <time className="text-xs text-foreground-muted tabular-nums shrink-0">
            {formatDate(upcoming.date)}
          </time>
        </div>
      ) : null}
    </div>
  );
}
