"use client";

import { useActionState, useEffect, useState } from "react";
import { pickMyPour } from "@/app/(app)/(shell)/pick-pour/actions";
import { Button } from "@/components/primitives";

type PickPourButtonProps = {
  variant?: "primary" | "ghost";
  label?: string;
  className?: string;
};

type State = { status: "idle" | "error"; message?: string };
const initial: State = { status: "idle" };

/**
 * On-demand pairing pick — submits roll_index to the server action and
 * redirects to the pair detail page. Each tap increments rollIndex for shuffle.
 */
export function PickPourButton({
  variant = "ghost",
  label = "Pick from my cellar →",
  className,
}: PickPourButtonProps) {
  const [rollIndex, setRollIndex] = useState(0);
  const [state, action, pending] = useActionState(pickMyPour, initial);

  useEffect(() => {
    if (state.status === "error") {
      setRollIndex((n) => Math.max(0, n - 1));
    }
  }, [state.status]);

  return (
    <form action={action} className={className} onSubmit={() => setRollIndex((n) => n + 1)}>
      <input type="hidden" name="roll_index" value={rollIndex} />
      {state.status === "error" ? (
        <p className="text-sm text-ember-500 mb-2" role="alert">
          {state.message}
        </p>
      ) : null}
      <Button
        type="submit"
        variant={variant === "primary" ? "primary" : "ghost"}
        size={variant === "primary" ? "large" : "default"}
        disabled={pending}
        className={variant === "primary" ? "w-full" : undefined}
      >
        {pending ? "Picking…" : label}
      </Button>
    </form>
  );
}
