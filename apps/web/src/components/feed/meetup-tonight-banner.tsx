import Link from "next/link";
import { Button, Voice } from "@/components/primitives";
import { meetupCountdownLabel, meetupCountdownVoice } from "@/lib/meetup/countdown";

type MeetupTonightBannerProps = {
  eventName: string;
  daysUntil: number;
};

export function MeetupTonightBanner({ eventName, daysUntil }: MeetupTonightBannerProps) {
  const isTonight = daysUntil === 0;

  return (
    <div className="rounded-2xl border border-border bg-surface px-4 py-4 flex flex-col gap-3 mb-4">
      <p className="text-[10px] uppercase tracking-widest text-accent tabular-nums">
        {meetupCountdownLabel(daysUntil)}
      </p>
      <Voice className="block text-sm">"{meetupCountdownVoice(eventName, daysUntil)}"</Voice>
      {isTonight ? (
        <Link href="/pairings/capture">
          <Button size="large" className="w-full">
            Log tonight's pours →
          </Button>
        </Link>
      ) : null}
    </div>
  );
}
