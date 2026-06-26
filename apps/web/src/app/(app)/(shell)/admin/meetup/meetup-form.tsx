"use client";

import { useActionState } from "react";
import { Button, Card } from "@/components/primitives";
import { deleteMeetup, type UpsertMeetupState, upsertMeetup } from "./actions";

type MeetupFormProps = {
  existing: {
    id: string;
    name: string;
    date: string;
    notes: string | null;
  } | null;
};

const idle: UpsertMeetupState = { status: "idle" };

export function MeetupForm({ existing }: MeetupFormProps) {
  const [saveState, saveAction, savePending] = useActionState(upsertMeetup, idle);
  const [deleteState, deleteAction, deletePending] = useActionState(deleteMeetup, idle);

  const pending = savePending || deletePending;
  const error =
    saveState.status === "error"
      ? saveState.message
      : deleteState.status === "error"
        ? deleteState.message
        : null;
  const success =
    saveState.status === "ok"
      ? saveState.message
      : deleteState.status === "ok"
        ? deleteState.message
        : null;

  return (
    <Card>
      <form action={saveAction} className="flex flex-col gap-4">
        {existing ? <input type="hidden" name="event_id" value={existing.id} /> : null}

        <label className="flex flex-col gap-1">
          <span className="text-xs uppercase tracking-widest text-foreground-subtle">Name</span>
          <input
            name="name"
            type="text"
            required
            defaultValue={existing?.name ?? "Monthly Meetup"}
            placeholder="Monthly Meetup"
            className="h-12 rounded-[12px] border border-border bg-surface px-4 text-base text-foreground placeholder:text-foreground-subtle focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-2 focus:ring-offset-background"
          />
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-xs uppercase tracking-widest text-foreground-subtle">Date</span>
          <input
            name="date"
            type="date"
            required
            defaultValue={existing?.date ?? ""}
            className="h-12 rounded-[12px] border border-border bg-surface px-4 text-base text-foreground focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-2 focus:ring-offset-background [color-scheme:dark]"
          />
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-xs uppercase tracking-widest text-foreground-subtle">
            Notes{" "}
            <span className="normal-case tracking-normal text-foreground-subtle">(optional)</span>
          </span>
          <textarea
            name="notes"
            rows={2}
            defaultValue={existing?.notes ?? ""}
            placeholder="Theme, location, host..."
            className="rounded-[12px] border border-border bg-surface px-4 py-3 text-base text-foreground placeholder:text-foreground-subtle focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-2 focus:ring-offset-background resize-none"
          />
        </label>

        {error ? <p className="text-sm text-red-400">{error}</p> : null}

        {success ? <p className="text-sm text-foreground-muted">{success}</p> : null}

        <Button type="submit" disabled={pending}>
          {savePending ? "Saving…" : existing ? "Update meetup" : "Create meetup"}
        </Button>
      </form>

      {existing ? (
        <form action={deleteAction} className="mt-3">
          <input type="hidden" name="event_id" value={existing.id} />
          <Button type="submit" variant="ghost" disabled={pending} className="w-full text-red-400">
            {deletePending ? "Removing…" : "Remove this meetup"}
          </Button>
        </form>
      ) : null}
    </Card>
  );
}
