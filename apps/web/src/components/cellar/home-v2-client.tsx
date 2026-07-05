"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import type { HomeHuntNextPick, HomeTryNextPick, HomeV2Visibility } from "@/lib/cellar/home-v2";
import { setCellarState } from "@/lib/cellar/actions";
import {
  CellarEmptyState,
  CellarStatStrip,
  HuntNextRail,
  PalateTicker,
  TonightsPickCard,
  TryNextSection,
} from "./home-v2-sections";

type TonightsPickModel = {
  line: string;
  href: string;
  cigarName: string;
  bourbonName: string;
  cigarImageUrl: string | null;
  bourbonImageUrl: string | null;
  quote: string | null;
  noteNumber: string;
};

type CellarHomeClientProps = {
  headerMeta: string;
  bottleCount: number;
  cigarCount: number;
  initialHuntingCount: number;
  palateTraits: string[];
  tonightsPick: TonightsPickModel | null;
  tryNext: {
    bourbons: HomeTryNextPick[];
    cigars: HomeTryNextPick[];
  };
  initialHuntNext: HomeHuntNextPick[];
  visibility: HomeV2Visibility;
};

export function CellarHomeClient({
  headerMeta,
  bottleCount,
  cigarCount,
  initialHuntingCount,
  palateTraits,
  tonightsPick,
  tryNext,
  initialHuntNext,
  visibility,
}: CellarHomeClientProps) {
  const router = useRouter();
  const [huntNext, setHuntNext] = useState(initialHuntNext);
  const [huntingCount, setHuntingCount] = useState(initialHuntingCount);
  const [pendingProductId, setPendingProductId] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  useEffect(() => {
    setHuntNext(initialHuntNext);
  }, [initialHuntNext]);

  function handleWant(productId: string) {
    if (pendingProductId) return;

    const previousItems = huntNext;
    setPendingProductId(productId);
    setHuntNext((items) => items.filter((item) => item.product_id !== productId));
    setHuntingCount((count) => count + 1);

    startTransition(() => {
      setCellarState(productId, { want: true })
        .then(() => {
          router.refresh();
        })
        .catch(() => {
          setHuntNext(previousItems);
          setHuntingCount((count) => Math.max(0, count - 1));
        })
        .finally(() => {
          setPendingProductId(null);
        });
    });
  }

  return (
    <>
      <header className="mb-6">
        <div className="min-w-0">
          <h1 className="text-5xl leading-none">The Cellar</h1>
          <p className="mt-2 text-[11px] uppercase tracking-[0.28em] text-foreground-subtle">
            {headerMeta}
          </p>
        </div>
      </header>

      <CellarStatStrip
        bottleCount={bottleCount}
        cigarCount={cigarCount}
        huntingCount={huntingCount}
      />

      <PalateTicker traits={palateTraits} />

      {tonightsPick ? (
        <TonightsPickCard
          line={tonightsPick.line}
          href={tonightsPick.href}
          cigarName={tonightsPick.cigarName}
          bourbonName={tonightsPick.bourbonName}
          cigarImageUrl={tonightsPick.cigarImageUrl}
          bourbonImageUrl={tonightsPick.bourbonImageUrl}
          quote={tonightsPick.quote}
          noteNumber={tonightsPick.noteNumber}
        />
      ) : null}

      {visibility.showTryNext ? (
        <TryNextSection bourbons={tryNext.bourbons} cigars={tryNext.cigars} />
      ) : null}

      {huntNext.length > 0 ? (
        <HuntNextRail
          items={huntNext}
          onWant={handleWant}
          pendingProductId={pendingProductId}
        />
      ) : null}

      {visibility.showEmptyCta ? <CellarEmptyState href="/capture" /> : null}
    </>
  );
}
