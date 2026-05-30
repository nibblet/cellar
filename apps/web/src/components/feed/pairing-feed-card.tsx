import Link from "next/link";
import type { FeedPairingEntry } from "@/lib/feed/queries";
import { cn } from "@/lib/utils";
import { PhotoFrame, PhotoPlaceholder } from "./photo-frame";

type PairingFeedCardProps = {
  entry: FeedPairingEntry;
  signedHero: string | null;
  forYou?: boolean;
};

export function PairingFeedCard({ entry, signedHero, forYou = false }: PairingFeedCardProps) {
  const href = `/pairings/${entry.cigar_id}/${entry.bourbon_id}`;

  const Overlays = (
    <>
      {entry.recommend ? (
        <div className="absolute top-3 right-3 z-10" role="img" aria-label="Recommended pairing">
          <span className="block w-3 h-3 rounded-full bg-ember-500 shadow-[0_0_10px_var(--ember-500)] ring-2 ring-paper-50/50" />
        </div>
      ) : null}

      {forYou ? (
        <div className="absolute top-3 left-3 z-10">
          <span className="px-2 py-0.5 rounded-full text-[10px] tracking-widest uppercase text-paper-50 bg-ink-900/40 border border-paper-50/40 backdrop-blur-[2px]">
            For you
          </span>
        </div>
      ) : null}

      <div className="absolute inset-x-0 bottom-0 p-3 pt-12 bg-gradient-to-t from-ink-900/70 via-ink-900/40 to-transparent">
        <div className="flex items-end justify-between gap-3">
          <span
            className="font-display italic text-base text-paper-50 drop-shadow-md truncate min-w-0"
            title={entry.display_name}
          >
            {entry.display_name}
          </span>

          {entry.chips.length > 0 ? (
            <div className="flex flex-wrap gap-1 justify-end shrink-0 max-w-[60%]">
              {entry.chips.slice(0, 3).map((chip) => (
                <span
                  key={chip}
                  className="px-2 py-0.5 rounded-full text-[11px] text-paper-50 bg-ink-900/40 border border-paper-50/30 backdrop-blur-[2px]"
                >
                  {chip}
                </span>
              ))}
            </div>
          ) : null}
        </div>
      </div>
    </>
  );

  const displayNote = entry.pairing_note ?? entry.note;

  return (
    <Link href={href} className="block group">
      <article
        className={cn(
          "mx-0.5 rounded-[16px] border border-border bg-surface overflow-hidden transition-shadow group-hover:shadow-[0_2px_12px_rgba(0,0,0,0.12)]",
          entry.recommend && "border-moss-600/30",
        )}
      >
        <div className="relative aspect-[4/5]">
          {signedHero ? (
            <PhotoFrame src={signedHero} alt={`${entry.cigar_name} with ${entry.bourbon_name}`}>
              {Overlays}
            </PhotoFrame>
          ) : (
            <PhotoPlaceholder productType="cigar">{Overlays}</PhotoPlaceholder>
          )}
        </div>

        <div className="px-3.5 py-3 min-w-0">
          <p className="text-[10px] uppercase tracking-widest text-foreground-subtle mb-1">
            Pairing
          </p>
          <p className="text-[15px] font-medium text-foreground truncate leading-snug">
            {entry.cigar_name}
          </p>
          <p className="text-[11px] tracking-widest uppercase text-foreground-subtle my-0.5">
            with
          </p>
          <p className="text-[15px] font-medium text-foreground truncate leading-snug">
            {entry.bourbon_name}
          </p>
        </div>

        {displayNote ? (
          <p className="px-3.5 pb-3 -mt-1 text-[13px] text-foreground italic line-clamp-2">
            "{displayNote}"
          </p>
        ) : null}
      </article>
    </Link>
  );
}
