"use client";

import Link from "next/link";
import { Button, Card, Voice } from "@/components/primitives";
import type { ProductType } from "@/lib/wheel";
import { ReleaseLabelInput } from "./release-label-input";

type Props = {
  productId: string;
  productType: ProductType;
  productName: string;
  brand: string | null;
  releasePattern: string | null;
  releaseLabel: string | null;
  eventId: string | null;
  knownReleaseLabels?: string[];
};

/**
 * Shown after capture when vision matched a confirmed catalog expression.
 * Lets the member confirm the match and edit the vision-extracted release label
 * before heading to recommend.
 */
export function CaptureConfirmBanner({
  productId,
  productType,
  productName,
  brand,
  releasePattern,
  releaseLabel,
  eventId,
  knownReleaseLabels = [],
}: Props) {
  const display = [brand, productName].filter(Boolean).join(" ");
  const opener = productType === "cigar" ? "The band reads" : "The label looks like";

  return (
    <Card className="mt-5 border border-ember-500/60 bg-surface">
      <form
        action={`/products/${productId}/recommend`}
        method="get"
        className="flex flex-col gap-4"
      >
        {eventId ? <input type="hidden" name="event" value={eventId} /> : null}
        <input type="hidden" name="confirmed" value="1" />
        <input type="hidden" name="release_label_source" value="vision" />
        {releaseLabel ? (
          <input type="hidden" name="vision_release_label" value={releaseLabel} />
        ) : null}

        <Voice className="text-base">
          Found it in the catalog. {opener}{" "}
          <span className="font-medium not-italic">{display}</span>. Look right?
        </Voice>

        <ReleaseLabelInput
          releasePattern={releasePattern}
          visionValue={releaseLabel}
          suggestions={knownReleaseLabels}
        />

        <div className="flex gap-2">
          <Button type="submit" className="flex-1">
            Looks right
          </Button>
          <Link
            href={`/products/${productId}/edit`}
            className="flex-1 inline-flex items-center justify-center h-11 rounded-[10px] border border-border text-base font-medium text-foreground-muted hover:bg-surface-2"
          >
            Edit
          </Link>
        </div>
      </form>
    </Card>
  );
}
