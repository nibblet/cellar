"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { Button, Card, Voice } from "@/components/primitives";
import { ReleaseLabelInput } from "@/components/product/release-label-input";
import { EnrichmentTrigger } from "@/components/product/enrichment-trigger";
import type { ProductType } from "@/lib/wheel";
import { confirmDraftProduct } from "./draft-actions";

type Props = {
  productId: string;
  productType: ProductType;
  productName: string;
  brand: string | null;
  releasePattern: string | null;
  releaseLabel: string | null;
  justCaptured: boolean;
  needsEnrichment: boolean;
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
  needsEnrichment,
}: Props) {
  const [state, action, pending] = useActionState(
    async (_prev: State) => confirmDraftProduct(productId),
    initial,
  );

  const shouldBlockEnrich = justCaptured && needsEnrichment;
  const [enrichReady, setEnrichReady] = useState(!shouldBlockEnrich);

  if (shouldBlockEnrich && !enrichReady) {
    return (
      <EnrichmentTrigger
        productId={productId}
        productType={productType}
        needsEnrichment
        blocking
        onSettled={() => setEnrichReady(true)}
      />
    );
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
