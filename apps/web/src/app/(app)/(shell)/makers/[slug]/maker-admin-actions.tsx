"use client";

import { useActionState, useState } from "react";
import { Button, Card } from "@/components/primitives";
import { type MakerAdminState, regenerateMakerBlurb, updateMakerBlurb } from "./admin-actions";

type MakerAdminActionsProps = {
  slug: string;
  initialBlurb: string | null;
  blurbSource: "ai" | "manual";
};

const INITIAL: MakerAdminState = { status: "idle" };

export function MakerAdminActions({ slug, initialBlurb, blurbSource }: MakerAdminActionsProps) {
  const [blurb, setBlurb] = useState(initialBlurb ?? "");
  const [saveState, saveAction, savePending] = useActionState(updateMakerBlurb, INITIAL);
  const [regenState, regenAction, regenPending] = useActionState(regenerateMakerBlurb, INITIAL);

  const pending = savePending || regenPending;
  const error =
    saveState.status === "error"
      ? saveState.message
      : regenState.status === "error"
        ? regenState.message
        : null;
  const success =
    saveState.status === "ok"
      ? saveState.message
      : regenState.status === "ok"
        ? regenState.message
        : null;

  return (
    <Card className="mt-8">
      <p className="text-[11px] uppercase tracking-widest text-foreground-subtle mb-3">
        Admin — edit blurb
      </p>
      <form action={saveAction} className="flex flex-col gap-3">
        <input type="hidden" name="slug" value={slug} />
        <textarea
          name="blurb"
          value={blurb}
          onChange={(e) => setBlurb(e.target.value)}
          rows={5}
          className="w-full rounded-[12px] border border-border bg-surface px-3 py-2 text-sm text-foreground"
        />
        <div className="flex flex-wrap gap-2">
          <Button type="submit" variant="secondary" disabled={pending}>
            {savePending ? "Saving…" : "Save blurb"}
          </Button>
        </div>
      </form>

      <form action={regenAction} className="mt-3">
        <input type="hidden" name="slug" value={slug} />
        <Button
          type="submit"
          variant="ghost"
          disabled={pending || blurbSource === "manual"}
          title={blurbSource === "manual" ? "Disabled after a manual edit" : undefined}
        >
          {regenPending ? "Regenerating…" : "Regenerate with Winston"}
        </Button>
      </form>

      {error ? <p className="text-sm text-red-400 mt-3">{error}</p> : null}
      {success ? <p className="text-sm text-foreground-muted mt-3">{success}</p> : null}
    </Card>
  );
}
