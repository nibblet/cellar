"use client";

import { useActionState } from "react";
import { Card } from "@/components/primitives";
import {
  deleteSuggestion,
  updateSuggestionStatus,
  type UpdateSuggestionState,
} from "../../roadmap/actions";

const initial: UpdateSuggestionState = { status: "idle" };

const STATUS_LABELS: Record<string, string> = {
  open: "Open",
  reviewing: "Reviewing",
  done: "Done",
  "wont-do": "Won't do",
};

const STATUS_CLASS: Record<string, string> = {
  open: "text-accent",
  reviewing: "text-foreground",
  done: "text-moss-600",
  "wont-do": "text-foreground-subtle",
};

const KIND_CLASS: Record<string, string> = {
  feature: "text-accent",
  bug: "text-ember-500",
  other: "text-foreground-muted",
};

type Props = {
  id: string;
  kind: "feature" | "bug" | "other";
  body: string;
  status: "open" | "reviewing" | "done" | "wont-do";
  createdAt: string;
  memberName: string;
};

export function SuggestionRow({ id, kind, body, status, createdAt, memberName }: Props) {
  const [, updateAction, updating] = useActionState(updateSuggestionStatus, initial);
  const [, deleteAction, deleting] = useActionState(deleteSuggestion, initial);

  return (
    <Card>
      <div className="flex items-baseline justify-between gap-3 mb-2">
        <span className={`text-xs uppercase tracking-widest ${KIND_CLASS[kind]}`}>{kind}</span>
        <span className="text-xs text-foreground-subtle">
          {memberName} ·{" "}
          {new Date(createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
        </span>
      </div>

      <p className="text-sm text-foreground whitespace-pre-wrap mb-4">{body}</p>

      <div className="flex items-center justify-between gap-3">
        <form action={updateAction} className="flex items-center gap-2">
          <input type="hidden" name="id" value={id} />
          <select
            name="status"
            defaultValue={status}
            disabled={updating}
            className={`h-9 px-2 rounded-[8px] bg-surface-2 border border-border text-xs uppercase tracking-widest ${STATUS_CLASS[status]} focus:outline-none focus:border-accent`}
          >
            {(["open", "reviewing", "done", "wont-do"] as const).map((s) => (
              <option key={s} value={s}>
                {STATUS_LABELS[s]}
              </option>
            ))}
          </select>
          <button
            type="submit"
            disabled={updating}
            className="h-9 px-3 rounded-[8px] text-xs uppercase tracking-widest text-foreground-muted hover:text-foreground disabled:opacity-50"
          >
            {updating ? "Saving…" : "Save"}
          </button>
        </form>

        <form action={deleteAction}>
          <input type="hidden" name="id" value={id} />
          <button
            type="submit"
            disabled={deleting}
            className="h-9 px-3 rounded-[8px] text-xs uppercase tracking-widest text-foreground-subtle hover:text-ember-500 disabled:opacity-50"
          >
            {deleting ? "…" : "Delete"}
          </button>
        </form>
      </div>
    </Card>
  );
}
