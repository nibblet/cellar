"use client";

import { useState } from "react";
import type { CellarInsight } from "@/lib/cellar/insight";
import { Card, Voice } from "@/components/primitives";

type CellarInsightCardProps = {
  insight: CellarInsight;
};

function firstSentence(text: string): string {
  const match = text.match(/^[^.!?]+[.!?]/);
  return match ? match[0] : text;
}

export function CellarInsightCard({ insight }: CellarInsightCardProps) {
  const [expanded, setExpanded] = useState(false);
  const hasBourbons = Boolean(insight.bourbons);
  const hasCigars = Boolean(insight.cigars);

  if (!hasBourbons && !hasCigars) return null;

  const bourbonTeaser = insight.bourbons ? firstSentence(insight.bourbons) : null;
  const cigarTeaser = insight.cigars ? firstSentence(insight.cigars) : null;
  const hasMore =
    (insight.bourbons && insight.bourbons !== bourbonTeaser) ||
    (insight.cigars && insight.cigars !== cigarTeaser);

  return (
    <Card className="mb-5">
      <button
        type="button"
        onClick={() => hasMore && setExpanded(!expanded)}
        className="w-full text-left"
      >
        <p className="text-[11px] uppercase tracking-widest text-foreground-subtle mb-3">
          Winston on your shelf
        </p>
        {hasBourbons ? (
          <div className={hasCigars ? "mb-3" : undefined}>
            <p className="text-[11px] uppercase tracking-widest text-foreground-subtle mb-1">
              Bourbons
            </p>
            <Voice className="block text-sm">
              {expanded ? `"${insight.bourbons}"` : `"${bourbonTeaser}"`}
            </Voice>
          </div>
        ) : null}
        {hasCigars ? (
          <div>
            <p className="text-[11px] uppercase tracking-widest text-foreground-subtle mb-1">
              Cigars
            </p>
            <Voice className="block text-sm">
              {expanded ? `"${insight.cigars}"` : `"${cigarTeaser}"`}
            </Voice>
          </div>
        ) : null}
        {hasMore ? (
          <p className="text-[11px] text-foreground-subtle mt-2">
            {expanded ? "Show less" : "Read more"}
          </p>
        ) : null}
      </button>
    </Card>
  );
}
