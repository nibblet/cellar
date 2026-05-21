import Link from "next/link";
import { Card } from "@/components/primitives";

type UpcomingMeetupCardProps = {
  event: {
    id: string;
    name: string;
    date: string;
    notes: string | null;
  };
};

/**
 * Surfaced on the Feed home when a meetup is scheduled within the next
 * 48 hours. Promotes the upcoming gathering to the top of the page so
 * members don't have to dig into Settings → Meetups to find it.
 */
export function UpcomingMeetupCard({ event }: UpcomingMeetupCardProps) {
  const date = new Date(event.date);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const eventDay = new Date(date);
  eventDay.setHours(0, 0, 0, 0);
  const daysAway = Math.round((eventDay.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

  const whenLabel =
    daysAway === 0
      ? "Tonight"
      : daysAway === 1
        ? "Tomorrow"
        : date.toLocaleDateString("en-US", { weekday: "long" });

  return (
    <Link href={`/events/${event.id}`} className="block">
      <Card className="border border-accent-tint bg-gradient-to-br from-surface to-accent-tint/30 hover:bg-surface-2 transition-colors">
        <div className="flex items-baseline justify-between gap-3">
          <p className="text-[11px] uppercase tracking-[0.3em] text-accent">{whenLabel}</p>
          <time className="text-xs text-foreground-subtle tabular-nums">
            {date.toLocaleDateString("en-US", { month: "short", day: "numeric" })}
          </time>
        </div>
        <h2 className="text-xl font-display mt-1">{event.name}</h2>
        {event.notes ? (
          <p className="text-sm text-foreground-muted italic mt-1 line-clamp-1">"{event.notes}"</p>
        ) : null}
      </Card>
    </Link>
  );
}
