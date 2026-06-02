import Link from "next/link";
import { Button, Card, Divider, Voice } from "@/components/primitives";
import {
  type CrossTypePick,
  type ProductSuggestions,
  pairingHref,
  primaryTryTonight,
} from "@/lib/suggestions";
import { cn } from "@/lib/utils";
import type { ProductType } from "@/lib/wheel";

type WinstonSuggestsProps = {
  sourceType: ProductType;
  suggestions: ProductSuggestions;
  justCaptured?: boolean;
  productOnShelf?: boolean;
};

function productHeadline(name: string, brand: string | null): string {
  if (!brand) return name;
  if (name.toLowerCase().startsWith(brand.toLowerCase())) return name;
  return `${brand} ${name}`;
}

function SuggestionBadge({ kind }: { kind: "try_tonight" | "hunt_next" }) {
  const label = kind === "try_tonight" ? "Try tonight" : "Hunt next";
  return (
    <span className="text-[10px] uppercase tracking-widest text-foreground-subtle">{label}</span>
  );
}

function CrossTypeCard({ pick, shelfLabel }: { pick: CrossTypePick; shelfLabel?: string | null }) {
  return (
    <Link href={pairingHref(pick.cigar_id, pick.bourbon_id)} className="block group">
      <Card
        className={cn(
          "hover:bg-surface-2 transition-colors",
          pick.clubValidated &&
            "border border-moss-600 bg-gradient-to-br from-surface to-moss-600/5",
        )}
      >
        <div className="flex items-baseline justify-between gap-3">
          <SuggestionBadge kind="try_tonight" />
          {pick.clubValidated ? (
            <span className="text-[10px] uppercase tracking-widest text-moss-600">
              ● club tried
            </span>
          ) : null}
        </div>
        {shelfLabel ? (
          <p className="text-[10px] uppercase tracking-widest text-foreground-subtle mt-1">
            {shelfLabel}
          </p>
        ) : pick.source === "catalog" && !pick.onShelf ? (
          <p className="text-[10px] uppercase tracking-widest text-foreground-subtle mt-1">
            Not on your shelf yet
          </p>
        ) : null}
        <p className="text-base text-foreground truncate mt-1 group-hover:text-accent transition-colors">
          {productHeadline(pick.name, pick.brand)}
        </p>
        {pick.reasons[0] ? (
          <p className="text-sm text-foreground-muted italic mt-2 line-clamp-2">
            "{pick.reasons[0].reason}"
          </p>
        ) : null}
      </Card>
    </Link>
  );
}

export function WinstonSuggests({
  sourceType,
  suggestions,
  justCaptured = false,
  productOnShelf = false,
}: WinstonSuggestsProps) {
  const tryTonight = primaryTryTonight(suggestions);
  const huntNext = suggestions.huntNext;
  const reachForNext = suggestions.reachForNext;
  const { similarInTier, pairsWellWith } = suggestions.whileLooking;

  const hasCore =
    tryTonight != null || reachForNext.length > 0 || huntNext != null || similarInTier.length > 0;

  if (!hasCore) {
    return (
      <div className="mt-6">
        <Divider label="Winston suggests" />
        <Card className="mt-3">
          <p className="text-sm text-foreground-subtle">
            Not enough flavor data yet for Winston to suggest a match.
          </p>
        </Card>
      </div>
    );
  }

  const shelfLabel =
    tryTonight?.onShelf && sourceType === "bourbon"
      ? "On your bar"
      : tryTonight?.onShelf && sourceType === "cigar"
        ? "In your humidor"
        : null;

  return (
    <div className={cn("mt-6", productOnShelf && "order-first")}>
      {justCaptured && tryTonight ? (
        <div className="mb-4">
          <Voice className="block text-sm mb-3">Pouring this now? Here's what to grab.</Voice>
          <Link href={pairingHref(tryTonight.cigar_id, tryTonight.bourbon_id)}>
            <Button variant="secondary" className="w-full">
              See the pairing →
            </Button>
          </Link>
        </div>
      ) : null}

      <Divider label="Winston suggests" />

      <div className="mt-3 flex flex-col gap-4">
        {tryTonight ? (
          <div>
            <CrossTypeCard pick={tryTonight} shelfLabel={shelfLabel} />
          </div>
        ) : suggestions.tryTonightCatalog ? (
          <div>
            <CrossTypeCard pick={suggestions.tryTonightCatalog} />
          </div>
        ) : null}

        {reachForNext.length > 0 ? (
          <div>
            <p className="text-[11px] uppercase tracking-widest text-foreground-subtle mb-2">
              Reach for next
            </p>
            <div className="-mx-6 flex gap-3 overflow-x-auto px-6 pb-1 snap-x snap-mandatory">
              {reachForNext.map((p) => (
                <Link
                  key={p.product_id}
                  href={`/products/${p.product_id}`}
                  className="snap-start shrink-0 w-[168px]"
                >
                  <Card className="h-full hover:bg-surface-2 transition-colors">
                    {p.onShelf ? (
                      <p className="text-[10px] uppercase tracking-widest text-foreground-subtle mb-1">
                        Try tonight
                      </p>
                    ) : null}
                    <p className="text-sm text-foreground line-clamp-3 leading-snug">{p.name}</p>
                    {p.brand ? (
                      <p className="text-xs text-foreground-muted truncate mt-1">{p.brand}</p>
                    ) : null}
                  </Card>
                </Link>
              ))}
            </div>
          </div>
        ) : null}

        {huntNext ? (
          <div>
            <p className="text-[11px] uppercase tracking-widest text-foreground-subtle mb-2">
              Hunt next
            </p>
            <Link href={`/products/${huntNext.product_id}`} className="block group">
              <Card className="hover:bg-surface-2 transition-colors">
                <SuggestionBadge kind="hunt_next" />
                <p className="text-base text-foreground truncate mt-1 group-hover:text-accent transition-colors">
                  {productHeadline(huntNext.name, huntNext.brand)}
                </p>
                {huntNext.rationale ? (
                  <Voice className="block text-sm text-foreground-muted mt-2 line-clamp-2">
                    {huntNext.rationale}
                  </Voice>
                ) : null}
              </Card>
            </Link>
          </div>
        ) : null}

        {similarInTier.length > 0 || pairsWellWith ? (
          <>
            <Divider label="While you're looking" />
            {similarInTier.length > 0 ? (
              <div>
                <p className="text-[11px] uppercase tracking-widest text-foreground-subtle mb-2">
                  Similar in this tier
                </p>
                <div className="-mx-6 flex gap-3 overflow-x-auto px-6 pb-1 snap-x snap-mandatory">
                  {similarInTier.map((p) => {
                    return (
                      <Link
                        key={p.product_id}
                        href={`/products/${p.product_id}`}
                        className="snap-start shrink-0 w-[168px]"
                      >
                        <Card className="h-full hover:bg-surface-2 transition-colors">
                          <p className="text-sm text-foreground line-clamp-3 leading-snug">
                            {p.name}
                          </p>
                          {p.brand ? (
                            <p className="text-xs text-foreground-muted truncate mt-1">{p.brand}</p>
                          ) : null}
                          {p.subtitle ? (
                            <p className="text-[10px] text-foreground-muted truncate mt-1">
                              {p.subtitle}
                            </p>
                          ) : null}
                        </Card>
                      </Link>
                    );
                  })}
                </div>
              </div>
            ) : null}
            {pairsWellWith && !tryTonight ? (
              <div>
                <p className="text-[11px] uppercase tracking-widest text-foreground-subtle mb-2">
                  Pairs well with
                </p>
                <CrossTypeCard pick={pairsWellWith} />
              </div>
            ) : null}
          </>
        ) : null}
      </div>
    </div>
  );
}
