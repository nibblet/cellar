import Link from "next/link";
import { Voice } from "@/components/primitives";
import type { TryNextPick } from "@/lib/taste";

type TryNextProps = {
  cigars: TryNextPick[];
  bourbons: TryNextPick[];
};

/**
 * Worth hunting — taste-ranked picks the member doesn't yet own.
 */
export function TryNext({ cigars, bourbons }: TryNextProps) {
  if (cigars.length === 0 && bourbons.length === 0) return null;

  return (
    <section className="mb-5">
      <p className="text-[11px] uppercase tracking-widest text-foreground-subtle mb-2">
        Worth hunting
      </p>
      <Voice className="block text-sm mb-4">
        "Going off what you keep reaching for — a few you haven't poured yet."
      </Voice>

      {bourbons.length > 0 ? <PickGroup label="Bourbons" picks={bourbons} /> : null}
      {cigars.length > 0 ? <PickGroup label="Cigars" picks={cigars} /> : null}
    </section>
  );
}

function PickGroup({ label, picks }: { label: string; picks: TryNextPick[] }) {
  return (
    <div className="mb-4 last:mb-0">
      <p className="text-[11px] uppercase tracking-widest text-foreground-subtle mb-2">{label}</p>
      <div className="flex flex-col gap-2">
        {picks.map((pick) => (
          <Link
            key={pick.product_id}
            href={`/products/${pick.product_id}`}
            className="flex items-start gap-3 rounded-[12px] border border-border bg-surface px-3.5 py-2.5 hover:bg-surface-2 transition-colors"
          >
            {pick.image_url ? (
              // biome-ignore lint/performance/noImgElement: public catalog URL, no signing needed
              <img
                src={pick.image_url}
                alt={pick.name}
                className="w-10 h-10 rounded-lg object-contain bg-surface-2 shrink-0"
              />
            ) : (
              <div className="w-10 h-10 rounded-lg bg-surface-2 shrink-0" aria-hidden="true" />
            )}
            <div className="flex-1 min-w-0">
              {pick.brand ? (
                <p className="text-[10px] uppercase tracking-widest text-foreground-subtle truncate">
                  {pick.brand}
                </p>
              ) : null}
              <p className="text-[14px] font-medium text-foreground truncate leading-snug">
                {pick.name}
              </p>
              {pick.rationale ? (
                <Voice className="block text-[12px] text-foreground-muted mt-1 leading-snug">
                  {pick.rationale}
                </Voice>
              ) : null}
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
