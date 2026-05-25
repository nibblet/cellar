"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Card, Voice } from "@/components/primitives";
import type { ProductType } from "@/lib/wheel";

type Props = {
  productId: string;
  productType: ProductType;
  needsEnrichment: boolean;
  /** When true, block the page with Winston's loading state until enrichment finishes. */
  blocking?: boolean;
  onSettled?: () => void;
};

/**
 * Fires POST /api/enrich-draft once when a capture-created product still lacks
 * catalog reviews/specs/wheel data. Safe to mount on every product page visit —
 * the API route is idempotent.
 */
export function EnrichmentTrigger({
  productId,
  productType,
  needsEnrichment,
  blocking = false,
  onSettled,
}: Props) {
  const router = useRouter();
  const firedRef = useRef(false);
  const [running, setRunning] = useState(blocking && needsEnrichment);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!needsEnrichment || firedRef.current) return;
    firedRef.current = true;
    let active = true;

    if (blocking) setRunning(true);

    fetch("/api/enrich-draft", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ productId }),
    })
      .then(async (res) => {
        if (!res.ok) {
          const body = await res.json().catch(() => null);
          console.warn("[EnrichmentTrigger]", body?.error ?? res.statusText);
          if (active) setFailed(true);
        }
      })
      .catch(() => {
        if (active) setFailed(true);
      })
      .finally(() => {
        if (!active) return;
        setRunning(false);
        onSettled?.();
        router.refresh();
      });

    return () => {
      active = false;
    };
  }, [needsEnrichment, productId, router, blocking, onSettled]);

  if (running) {
    return <EnrichingState productType={productType} />;
  }

  if (failed && blocking) {
    return (
      <Card className="mt-5 border border-ember-500/40 bg-surface">
        <Voice className="text-base">
          Couldn&apos;t pull catalog data just now. You can still confirm and recommend — we&apos;ll
          fill in the details when the connection cooperates.
        </Voice>
      </Card>
    );
  }

  return null;
}

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
