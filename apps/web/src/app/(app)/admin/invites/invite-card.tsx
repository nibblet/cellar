"use client";

import { useActionState, useState } from "react";
import { Button, Card } from "@/components/primitives";
import { type CreateInviteState, createInvite } from "./actions";

const initial: CreateInviteState = { status: "idle" };

type Props = {
  /** Origin (e.g. https://nccc.forvex.app) used to build the copyable link. */
  origin: string;
};

export function InviteCard({ origin }: Props) {
  const [state, action, pending] = useActionState(createInvite, initial);
  const [copied, setCopied] = useState(false);

  const inviteUrl = state.token ? `${origin}/accept-invite?token=${state.token}` : null;

  return (
    <Card>
      <form action={action}>
        <Button type="submit" disabled={pending} className="w-full" size="large">
          {pending ? "Generating…" : "Generate new invite"}
        </Button>
      </form>

      {state.status === "error" ? (
        <p className="mt-3 text-sm text-ember-500" role="alert">
          {state.message}
        </p>
      ) : null}

      {inviteUrl ? (
        <div className="mt-4 flex flex-col gap-2">
          <p className="text-xs uppercase tracking-widest text-foreground-subtle">
            Send this link to your guest
          </p>
          <div className="flex gap-2">
            <input
              readOnly
              value={inviteUrl}
              onClick={(e) => e.currentTarget.select()}
              className="flex-1 px-3 h-11 rounded-[10px] bg-surface-2 border border-border text-sm text-foreground font-mono"
            />
            <Button
              type="button"
              variant="ghost"
              onClick={async () => {
                await navigator.clipboard.writeText(inviteUrl);
                setCopied(true);
                setTimeout(() => setCopied(false), 1500);
              }}
            >
              {copied ? "Copied" : "Copy"}
            </Button>
          </div>
          {state.expiresAt ? (
            <p className="text-xs text-foreground-subtle">
              Expires{" "}
              {new Date(state.expiresAt).toLocaleDateString("en-US", {
                month: "short",
                day: "numeric",
                year: "numeric",
              })}
              .
            </p>
          ) : null}
        </div>
      ) : null}
    </Card>
  );
}
