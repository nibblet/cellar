"use client";

import { useActionState, useState } from "react";
import { ChipInput } from "@/app/(app)/products/[id]/recommend/chip-input";
import { Button, Card, Voice } from "@/components/primitives";
import type { BourbonSessionPhases, CigarSessionPhases } from "@/lib/tasting/merge-session";
import type { ProductType } from "@/lib/wheel";
import { submitSession } from "./actions";

type SessionPhaseKey = keyof CigarSessionPhases | keyof BourbonSessionPhases;

type SessionFormProps = {
  productId: string;
  productType: ProductType;
  leafLabels: string[];
  eventId: string | null;
};

type State = { status: "idle" | "error"; message?: string };
const initial: State = { status: "idle" };

const CIGAR_PHASES = [
  { key: "first", label: "First Third" },
  { key: "second", label: "Second Third" },
  { key: "final", label: "Final Third" },
] as const;

const BOURBON_PHASES = [
  { key: "nose", label: "Nose" },
  { key: "palate", label: "Palate" },
  { key: "finish", label: "Finish" },
] as const;

export function SessionForm({ productId, productType, leafLabels, eventId }: SessionFormProps) {
  const [state, action, pending] = useActionState(submitSession, initial);
  const [step, setStep] = useState<"phases" | "finish">("phases");
  const phases = productType === "cigar" ? CIGAR_PHASES : BOURBON_PHASES;
  const [activePhase, setActivePhase] = useState<SessionPhaseKey>(phases[0].key);

  const chipPlaceholder =
    productType === "cigar" ? "e.g. cocoa, leather, pepper" : "e.g. caramel, oak, rye";

  return (
    <form action={action} className="flex flex-col gap-5">
      <input type="hidden" name="product_id" value={productId} />
      {eventId ? <input type="hidden" name="event_id" value={eventId} /> : null}

      <SessionHelp productType={productType} />

      {step === "phases" ? (
        <div className="flex gap-2" role="tablist" aria-label="Session phases">
          {phases.map((phase) => (
            <button
              key={phase.key}
              type="button"
              role="tab"
              aria-selected={activePhase === phase.key}
              onClick={() => setActivePhase(phase.key)}
              className={`flex-1 px-2 py-2 text-xs rounded-[10px] border transition-colors ${
                activePhase === phase.key
                  ? "border-accent bg-accent-tint text-foreground"
                  : "border-border bg-surface text-foreground-muted hover:bg-surface-2"
              }`}
            >
              {phase.label}
            </button>
          ))}
        </div>
      ) : null}

      {/* Phase inputs stay mounted so ChipInput state survives the finish step. */}
      {phases.map((phase) => (
        <div
          key={phase.key}
          hidden={step === "finish" || activePhase !== phase.key}
          className="flex flex-col gap-4"
        >
          <ChipInput
            name={`${phase.key}_chips`}
            leafLabels={leafLabels}
            placeholder={chipPlaceholder}
          />
          <label className="flex flex-col gap-2">
            <span className="text-sm text-foreground-muted">Notes for this phase (optional)</span>
            <textarea
              name={`${phase.key}_note`}
              rows={2}
              maxLength={200}
              className="rounded-[12px] bg-surface border border-border focus:border-accent transition-colors p-3 text-base outline-none"
              placeholder="A line or two for this pass."
            />
          </label>
        </div>
      ))}

      {step === "phases" ? (
        <Button type="button" size="large" className="w-full" onClick={() => setStep("finish")}>
          Finish session →
        </Button>
      ) : (
        <>
          <Voice className="text-sm">
            {productType === "cigar"
              ? '"Session complete, sir. Shall we tell the club?"'
              : '"The pour has spoken, sir. Recommend it?"'}
          </Voice>

          <label className="flex items-center gap-2 text-sm text-foreground-muted">
            <input
              type="checkbox"
              name="add_to_cellar"
              value="yes"
              className="rounded border-border"
            />
            Add to Cellar
          </label>

          {state.status === "error" ? (
            <Card className="border-ember-500">
              <p className="text-sm text-ember-500" role="alert">
                {state.message}
              </p>
            </Card>
          ) : null}

          <div className="flex flex-col gap-3">
            <Button
              type="submit"
              name="recommend"
              value="yes"
              size="large"
              disabled={pending}
              className="w-full"
            >
              {pending ? "Saving…" : "Recommend to NCCC"}
            </Button>
            <Button
              type="submit"
              name="recommend"
              value="no"
              variant="ghost"
              disabled={pending}
              className="w-full"
            >
              Pass — not for me
            </Button>
            <Button
              type="button"
              variant="ghost"
              disabled={pending}
              className="w-full"
              onClick={() => setStep("phases")}
            >
              ← Back to session
            </Button>
          </div>
        </>
      )}
    </form>
  );
}

function SessionHelp({ productType }: { productType: ProductType }) {
  if (productType === "cigar") {
    return (
      <details className="text-sm text-foreground-muted">
        <summary className="cursor-pointer hover:text-foreground">What are thirds?</summary>
        <Voice className="block mt-2 text-sm">
          "A cigar evolves as you smoke it, sir. The first third is the opening — what you taste
          right away. The second is where the blend settles. The final third is the close, often the
          boldest. Skip any phase you like; chips are optional throughout."
        </Voice>
      </details>
    );
  }

  return (
    <details className="text-sm text-foreground-muted">
      <summary className="cursor-pointer hover:text-foreground">
        What's nose, palate, finish?
      </summary>
      <Voice className="block mt-2 text-sm">
        "Nose is what you smell before the sip. Palate is the taste on the tongue. Finish is what
        lingers after. Take your time — or skip straight to the end if you're in a hurry, sir."
      </Voice>
    </details>
  );
}
