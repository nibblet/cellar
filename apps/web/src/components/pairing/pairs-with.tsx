import Link from "next/link";
import { Card } from "@/components/primitives";
import type { PairingCandidate } from "@/lib/pairing/engine";
import type { ProductType } from "@/lib/wheel";

type PairsWithProps = {
  sourceType: ProductType;
  sourceId: string;
  candidates: PairingCandidate[];
  validatedPairs: Set<string>; // set of candidate product_ids that are group-validated
};

function pairingHref(sourceType: ProductType, sourceId: string, candidateId: string): string {
  // pairings live at /pairings/<cigarId>/<bourbonId> regardless of which side
  // the source is on.
  return sourceType === "cigar"
    ? `/pairings/${sourceId}/${candidateId}`
    : `/pairings/${candidateId}/${sourceId}`;
}

export function PairsWith({ sourceType, sourceId, candidates, validatedPairs }: PairsWithProps) {
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
        const isValidated = validatedPairs.has(c.product_id);
        return (
          <Link key={c.product_id} href={pairingHref(sourceType, sourceId, c.product_id)}>
            <Card
              className={
                isValidated
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
                {isValidated ? (
                  <span
                    className="text-[10px] uppercase tracking-widest text-moss-600 shrink-0"
                    title="The club has tasted this pairing"
                  >
                    ● club tried
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
