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

/** Client-side ceiling — web search runs can exceed Vercel's 60s function limit. */
const ENRICH_FETCH_TIMEOUT_MS = 55_000;

/**
 * Fires POST /api/enrich-draft once when a capture-created product still lacks
 * catalog specs/wheel data. Safe to mount on every product page visit —
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
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), ENRICH_FETCH_TIMEOUT_MS);

    if (blocking) setRunning(true);

    fetch("/api/enrich-draft", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ productId }),
      signal: controller.signal,
    })
      .then(async (res) => {
        if (!res.ok) {
          const body = await res.json().catch(() => null);
          console.warn("[EnrichmentTrigger]", body?.error ?? res.statusText);
          if (active) setFailed(true);
          return;
        }
        if (active) router.refresh();
      })
      .catch(() => {
        if (active) setFailed(true);
      })
      .finally(() => {
        window.clearTimeout(timeout);
        if (!active) return;
        setRunning(false);
        onSettled?.();
      });

    return () => {
      active = false;
    };
  }, [needsEnrichment, productId, router, blocking, onSettled]);

  if (running) {
    return (
      <Card className="mt-5 border border-accent/40 bg-surface">
        <EnrichingState productType={productType} />
      </Card>
    );
  }

  if (failed) {
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
          "Filling in the details…",
          "Pulling reviews from the humidor.",
          "Still working — check back in a moment.",
        ]
      : [
          "Filling in the details…",
          "Checking the rickhouse log.",
          "Still working — check back in a moment.",
        ];

  const [idx, setIdx] = useState(0);
  useEffect(() => {
    const t = window.setInterval(() => {
      setIdx((i) => (i < lines.length - 1 ? i + 1 : i));
    }, 8000);
    return () => window.clearInterval(t);
  }, [lines.length]);

  return (
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
  );
}
