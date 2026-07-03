import Link from "next/link";
import { Card } from "@/components/primitives";
import type { PairsWithEntry } from "@/lib/pairing/merge-pairs-with";
import type { ProductType } from "@/lib/wheel";

type PairsWithProps = {
  sourceType: ProductType;
  sourceId: string;
  candidates: PairsWithEntry[];
};

function pairingHref(sourceType: ProductType, sourceId: string, candidateId: string): string {
  // pairings live at /pairings/<cigarId>/<bourbonId> regardless of which side
  // the source is on.
  return sourceType === "cigar"
    ? `/pairings/${sourceId}/${candidateId}`
    : `/pairings/${candidateId}/${sourceId}`;
}

export function PairsWith({ sourceType, sourceId, candidates }: PairsWithProps) {
  if (candidates.length === 0) {
    return (
      <Card>
        <p className="text-sm text-foreground-subtle">
          Not enough flavor data yet for Winston to suggest a pairing.
        </p>
      </Card>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {candidates.map((c) => {
        // Moss = on your shelf. A candidate you already own gets the moss
        // treatment — the pour you can reach for right now.
        const onShelf = c.source === "cellar";
        return (
          <Link key={c.product_id} href={pairingHref(sourceType, sourceId, c.product_id)}>
            <Card
              className={
                onShelf
                  ? "border border-moss-600 bg-gradient-to-br from-surface to-moss-600/5 hover:bg-surface-2 transition-colors"
                  : "hover:bg-surface-2 transition-colors"
              }
            >
              <div className="flex items-baseline justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-base text-foreground truncate">{c.name}</p>
                  {c.brand ? (
                    <p className="text-xs text-foreground-muted truncate">{c.brand}</p>
                  ) : null}
                </div>
                {onShelf ? (
                  <span
                    className="text-[10px] uppercase tracking-widest text-moss-600 shrink-0"
                    title="A pour you already own"
                  >
                    ● on your shelf
                  </span>
                ) : null}
              </div>
              {c.reasons[0] ? (
                <p className="text-sm text-foreground-muted italic mt-2">"{c.reasons[0].reason}"</p>
              ) : null}
            </Card>
          </Link>
        );
      })}
    </div>
  );
}
