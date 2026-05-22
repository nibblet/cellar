"use client";

import { useActionState, useRef, useEffect } from "react";
import { Button, Card } from "@/components/primitives";
import { type SubmitSuggestionState, submitSuggestion } from "./actions";

const initial: SubmitSuggestionState = { status: "idle" };

export function SuggestionForm() {
  const [state, action, pending] = useActionState(submitSuggestion, initial);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.status === "sent") formRef.current?.reset();
  }, [state.status]);

  return (
    <Card>
      <form ref={formRef} action={action} className="flex flex-col gap-4">
        <div>
          <p className="text-xs uppercase tracking-widest text-foreground-subtle mb-2">Type</p>
          <div className="flex gap-2">
            {(["feature", "bug", "other"] as const).map((k, i) => (
              <label
                key={k}
                className="flex-1 cursor-pointer rounded-[10px] border border-border bg-surface px-3 h-11 flex items-center justify-center text-sm capitalize has-[:checked]:border-accent has-[:checked]:bg-accent-tint has-[:checked]:text-foreground transition-colors"
              >
                <input
                  type="radio"
                  name="kind"
                  value={k}
                  defaultChecked={i === 0}
                  className="sr-only"
                />
                {k}
              </label>
            ))}
          </div>
        </div>

        <div>
          <label
            htmlFor="suggestion-body"
            className="block text-xs uppercase tracking-widest text-foreground-subtle mb-2"
          >
            What's on your mind?
          </label>
          <textarea
            id="suggestion-body"
            name="body"
            rows={5}
            required
            maxLength={4000}
            placeholder="A feature you wish the app had, or a bug you noticed…"
            className="w-full px-3 py-3 rounded-[10px] bg-surface-2 border border-border text-sm text-foreground placeholder:text-foreground-subtle resize-y focus:outline-none focus:border-accent"
          />
        </div>

        <Button type="submit" disabled={pending} size="large" className="w-full">
          {pending ? "Sending…" : "Send to Paul"}
        </Button>

        {state.status === "error" ? (
          <p className="text-sm text-ember-500" role="alert">
            {state.message}
          </p>
        ) : null}
        {state.status === "sent" ? (
          <p className="text-sm text-moss-600">Thanks — Paul will see this.</p>
        ) : null}
      </form>
    </Card>
  );
}
