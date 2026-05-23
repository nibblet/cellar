import Link from "next/link";
import { Winston } from "@/components/brand";
import { Card, Voice } from "@/components/primitives";
import type { DailyPourCandidate } from "@/lib/daily-pour/load";
import { cn } from "@/lib/utils";

/**
 * Home-page hero card (Tier 1 #3, Phase 8). Surfaces Winston's pick of
 * the day — a single cigar + bourbon pairing, Winston-narrated. Tap-through
 * goes to the existing pair-detail page so we don't fork the pairing surface.
 *
 * The card is the only place outside /pairings where moss can light: when
 * the picked pair is club-validated, the border gets a moss tint and the
 * "club tried" eyebrow stamps the card. Otherwise the surface stays clean.
 */
export function DailyPourCard({ pour }: { pour: DailyPourCandidate }) {
  return (
    <Link
      href={`/pairings/${pour.cigar_id}/${pour.bourbon_id}`}
      className="block mb-4 group"
      aria-label={`Winston's pick: ${pour.cigar_name} with ${pour.bourbon_name}`}
    >
      <Card
        className={cn(
          "transition-shadow group-hover:shadow-[0_2px_12px_rgba(0,0,0,0.12)]",
          pour.club_validated && "border-moss-600 bg-gradient-to-br from-surface to-moss-600/5",
        )}
      >
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <Winston variant="pour" size={44} className="rounded-full shrink-0" />
            <p className="text-[10px] uppercase tracking-widest text-foreground-subtle">
              Winston's pick
            </p>
          </div>
          {pour.club_validated ? (
            <p className="text-[10px] uppercase tracking-widest text-moss-600">● club tried</p>
          ) : null}
        </div>

        {pour.rationale ? (
          <Voice className="block mt-2 mb-3">"{pour.rationale}"</Voice>
        ) : (
          <Voice className="block mt-2 mb-3">"A measured match, sir."</Voice>
        )}

        <div className="space-y-1.5">
          <div>
            <p className="text-base text-foreground truncate">{pour.cigar_name}</p>
            {pour.cigar_brand ? (
              <p className="text-[11px] text-foreground-muted truncate">
                {pour.cigar_brand} ·{" "}
                <span className="uppercase tracking-widest text-foreground-subtle">cigar</span>
              </p>
            ) : null}
          </div>
          <p className="text-[11px] tracking-widest uppercase text-foreground-subtle">
            paired with
          </p>
          <div>
            <p className="text-base text-foreground truncate">{pour.bourbon_name}</p>
            {pour.bourbon_brand ? (
              <p className="text-[11px] text-foreground-muted truncate">
                {pour.bourbon_brand} ·{" "}
                <span className="uppercase tracking-widest text-foreground-subtle">bourbon</span>
              </p>
            ) : null}
          </div>
        </div>

        <p className="mt-3 text-sm text-accent group-hover:text-accent-hover">Why this pairing →</p>
      </Card>
    </Link>
  );
}
