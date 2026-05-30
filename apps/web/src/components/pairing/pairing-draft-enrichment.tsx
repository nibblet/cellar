"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Card, Voice } from "@/components/primitives";
import type { EnrichmentJob } from "@/lib/enrich/enrichment-jobs";

const ENRICH_FETCH_TIMEOUT_MS = 55_000;

type Props = {
  jobs: EnrichmentJob[];
};

/**
 * After a pairing save, enrich any draft (or thin) catalog rows in the
 * background — same /api/enrich-draft pass as single-product capture.
 */
export function PairingDraftEnrichment({ jobs }: Props) {
  const router = useRouter();
  const startedRef = useRef(false);
  const [running, setRunning] = useState(jobs.length > 0);
  const [failed, setFailed] = useState(false);
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (jobs.length === 0 || startedRef.current) return;
    startedRef.current = true;

    let active = true;

    async function runAll() {
      let anyFailed = false;

      for (let i = 0; i < jobs.length; i++) {
        if (!active) return;
        setIndex(i);

        const job = jobs[i];
        const controller = new AbortController();
        const timeout = window.setTimeout(() => controller.abort(), ENRICH_FETCH_TIMEOUT_MS);

        try {
          const res = await fetch("/api/enrich-draft", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ productId: job.productId }),
            signal: controller.signal,
          });
          if (!res.ok) {
            const body = await res.json().catch(() => null);
            console.warn("[PairingDraftEnrichment]", body?.error ?? res.statusText);
            anyFailed = true;
          }
        } catch {
          anyFailed = true;
        } finally {
          window.clearTimeout(timeout);
        }
      }

      if (!active) return;
      setRunning(false);
      setFailed(anyFailed);
      router.refresh();
    }

    void runAll();

    return () => {
      active = false;
    };
  }, [jobs, router]);

  if (jobs.length === 0) return null;

  if (running) {
    const current = jobs[index];
    return (
      <Card className="mb-4 border border-accent/40 bg-surface">
        <p className="text-[10px] uppercase tracking-widest text-foreground-subtle mb-2">
          New picks in the catalog
        </p>
        <Voice className="text-sm block">
          Filling in details for the {current?.productType === "cigar" ? "cigar" : "pour"}
          {jobs.length > 1 ? ` (${index + 1} of ${jobs.length})` : ""}…
        </Voice>
        <div
          role="progressbar"
          aria-label="Enriching catalog"
          aria-busy="true"
          className="h-1 w-32 rounded-full bg-surface-2 overflow-hidden mt-3 mx-auto"
        >
          <div className="h-full bg-accent animate-pulse" />
        </div>
      </Card>
    );
  }

  if (failed) {
    return (
      <Card className="mb-4 border border-ember-500/40 bg-surface">
        <Voice className="text-sm block">
          Couldn&apos;t pull full catalog data just now. The pairing is saved — details will catch
          up later.
        </Voice>
      </Card>
    );
  }

  return null;
}
