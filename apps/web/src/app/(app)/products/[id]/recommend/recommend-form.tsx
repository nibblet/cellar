"use client";

import { useActionState } from "react";
import { Button, Card } from "@/components/primitives";
import type { ProductType } from "@/lib/wheel";
import { submitRecommend } from "./actions";
import { ChipInput } from "./chip-input";

type RecommendFormProps = {
  productId: string;
  productType: ProductType;
  leafLabels: string[];
  initial: { recommend: boolean; chips: string[]; note: string | null } | null;
};

type State = { status: "idle" | "error"; message?: string };
const initial: State = { status: "idle" };

export function RecommendForm({
  productId,
  productType,
  leafLabels,
  initial: prior,
}: RecommendFormProps) {
  const [state, action, pending] = useActionState(submitRecommend, initial);

  const placeholder =
    productType === "cigar" ? "e.g. cocoa, leather, pepper" : "e.g. caramel, oak, rye";

  return (
    <form action={action} className="flex flex-col gap-5">
      <input type="hidden" name="product_id" value={productId} />

      <ChipInput
        name="chips"
        leafLabels={leafLabels}
        initial={prior?.chips ?? []}
        placeholder={placeholder}
      />

      <label className="flex flex-col gap-2">
        <span className="text-sm text-foreground-muted">A sentence or two? (optional)</span>
        <textarea
          name="note"
          defaultValue={prior?.note ?? ""}
          rows={3}
          maxLength={500}
          className="rounded-[12px] bg-surface border border-border focus:border-accent transition-colors p-3 text-base outline-none"
          placeholder="Stronger than I expected. Coffee on the retrohale."
        />
      </label>

      {state.status === "error" ? (
        <Card className="border-ember-500">
          <p className="text-sm text-ember-500" role="alert">
            {state.message}
          </p>
        </Card>
      ) : null}

      <div className="flex flex-col gap-3 mt-2">
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
      </div>
    </form>
  );
}
