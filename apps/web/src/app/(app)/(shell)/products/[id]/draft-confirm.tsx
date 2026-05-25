"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useActionState, useEffect, useRef, useState } from "react";
import { Button, Card, Voice } from "@/components/primitives";
import { ReleaseLabelInput } from "@/components/product/release-label-input";
import type { ProductType } from "@/lib/wheel";
import { confirmDraftProduct } from "./draft-actions";

type Props = {
  productId: string;
  productType: ProductType;
  productName: string;
  brand: string | null;
  releasePattern: string | null;
  releaseLabel: string | null;
  /** True when the member just came from /capture (just_captured=1). Switches
   *  the banner's role from passive draft notice to active capture flow:
   *  first show Winston narrating the enrichment pass, then the confirm. */
  justCaptured: boolean;
  /** True when products.image_url is already populated. Used to decide whether
   *  we still need to fire the async enrichment fetch on mount. */
  alreadyEnriched: boolean;
};

type State = { ok: boolean; error?: string };
const initial: State = { ok: false };

export function DraftConfirmBanner({
  productId,
  productType,
  productName,
  brand,
  releasePattern,
  releaseLabel,
  justCaptured,
  alreadyEnriched,
}: Props) {
  const router = useRouter();
  const [state, action, pending] = useActionState(
    async (_prev: State) => confirmDraftProduct(productId),
    initial,
  );

  // Enrichment fires exactly once on the first render when we arrive from
  // /capture and the catalog data isn't filled in yet. Stays on the
  // enriching screen until the fetch resolves; then we refresh the route
  // so the page re-renders with the new image_url and specs.
  const shouldEnrich = justCaptured && !alreadyEnriched;
  const [enriching, setEnriching] = useState(shouldEnrich);
  const firedRef = useRef(false);

  useEffect(() => {
    if (!shouldEnrich || firedRef.current) return;
    firedRef.current = true;
    let active = true;
    fetch("/api/enrich-draft", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ productId }),
    })
      .catch(() => {
        // Network failures still surface the confirm UI — better than hanging.
      })
      .finally(() => {
        if (!active) return;
        setEnriching(false);
        router.refresh();
      });
    return () => {
      active = false;
    };
  }, [shouldEnrich, productId, router]);

  if (enriching) {
    return <EnrichingState productType={productType} />;
  }

  const display = [brand, productName].filter(Boolean).join(" ");
  const opener = productType === "cigar" ? "The band reads" : "The label looks like";

  return (
    <Card className="mt-5 border border-ember-500/60 bg-surface">
      <div className="flex flex-col gap-4">
        {justCaptured ? (
          <Voice className="text-base">
            {opener} <span className="font-medium not-italic">{display}</span>. Look right?
          </Voice>
        ) : (
          <p className="text-sm text-foreground-muted">
            <span className="text-ember-500 font-medium">Draft.</span> Confirm the details or edit
            them first.
          </p>
        )}

        {state.error ? (
          <p className="text-sm text-ember-500" role="alert">
            {state.error}
          </p>
        ) : null}

        {justCaptured && productType === "bourbon" ? (
          <ReleaseLabelInput releasePattern={releasePattern} visionValue={releaseLabel} />
        ) : null}

        <form action={action} className="flex gap-2">
          <Button type="submit" disabled={pending} className="flex-1">
            {pending ? "Confirming…" : "Looks right"}
          </Button>
          <Link
            href={`/products/${productId}/edit`}
            className="flex-1 inline-flex items-center justify-center h-11 rounded-[10px] border border-border text-base font-medium text-foreground-muted hover:bg-surface-2"
          >
            Edit
          </Link>
        </form>
      </div>
    </Card>
  );
}

/**
 * Winston-narrated loading state shown while /api/enrich-draft is running.
 * The member is already on the product page with their own photo visible;
 * this just covers the ~30-60s wait for the catalog data to fill in.
 */
function EnrichingState({ productType }: { productType: ProductType }) {
  const lines =
    productType === "cigar"
      ? [
          "Reading up on this one…",
          "Pulling reviews from the humidor.",
          "Almost there. Annotating the band.",
        ]
      : [
          "Reading up on this one…",
          "Checking the rickhouse log.",
          "Almost there. Pouring a neat one.",
        ];

  const [idx, setIdx] = useState(0);
  useEffect(() => {
    const t = window.setInterval(() => {
      setIdx((i) => (i < lines.length - 1 ? i + 1 : i));
    }, 8000);
    return () => window.clearInterval(t);
  }, [lines.length]);

  return (
    <Card className="mt-5 border border-accent/40 bg-surface">
      <div className="flex flex-col items-center text-center gap-3 py-2">
        <Voice className="text-base">{lines[idx]}</Voice>
        <div
          role="progressbar"
          aria-label="Working"
          aria-busy="true"
          className="h-1 w-32 rounded-full bg-surface-2 overflow-hidden"
        >
          <div className="h-full bg-accent animate-pulse" />
        </div>
      </div>
    </Card>
  );
}
