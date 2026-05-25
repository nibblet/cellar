"use client";

import { useActionState, useState } from "react";
import { type MemberSinceFormState, updateClubJoinedAt } from "./actions";

type MemberSinceEditorProps = {
  /** Current display label, e.g. "Member since June 2019" or null. */
  currentLabel: string | null;
  /** Pre-parsed values for the selects (null when unset). */
  currentMonth: number | null;
  currentYear: number | null;
};

const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

const FOUNDING_YEAR = 2014;

function yearOptions() {
  const current = new Date().getFullYear();
  const years: number[] = [];
  for (let y = current; y >= FOUNDING_YEAR; y--) years.push(y);
  return years;
}

const initial: MemberSinceFormState = { ok: false, message: null };

export function MemberSinceEditor({
  currentLabel,
  currentMonth,
  currentYear,
}: MemberSinceEditorProps) {
  const [editing, setEditing] = useState(false);
  const [state, action, isPending] = useActionState(updateClubJoinedAt, initial);

  if (!editing) {
    return (
      <button
        type="button"
        onClick={() => setEditing(true)}
        className="text-[11px] text-foreground-subtle hover:text-foreground-muted transition-colors"
        title="Tap to update when you joined the club"
      >
        {currentLabel ?? "Set your join date"}
        <span className="ml-1.5 text-foreground-subtle opacity-60">✎</span>
      </button>
    );
  }

  return (
    <form
      action={async (fd) => {
        await action(fd);
        setEditing(false);
      }}
      className="flex flex-col items-center gap-2 mt-1"
    >
      <div className="flex gap-2">
        <select
          name="month"
          defaultValue={currentMonth ?? ""}
          className="text-base bg-surface border border-border rounded-md px-2 py-2 text-foreground"
          required
        >
          <option value="" disabled>
            Month
          </option>
          {MONTHS.map((m, i) => (
            <option key={m} value={i + 1}>
              {m}
            </option>
          ))}
        </select>

        <select
          name="year"
          defaultValue={currentYear ?? ""}
          className="text-base bg-surface border border-border rounded-md px-2 py-2 text-foreground"
          required
        >
          <option value="" disabled>
            Year
          </option>
          {yearOptions().map((y) => (
            <option key={y} value={y}>
              {y}
            </option>
          ))}
        </select>
      </div>

      <div className="flex gap-2">
        <button
          type="submit"
          disabled={isPending}
          className="text-xs text-accent hover:text-accent-hover disabled:opacity-50"
        >
          {isPending ? "Saving…" : "Save"}
        </button>
        <button
          type="button"
          onClick={() => setEditing(false)}
          className="text-xs text-foreground-subtle hover:text-foreground-muted"
        >
          Cancel
        </button>
      </div>

      {state.message && !state.ok ? (
        <p className="text-xs text-ember-500">{state.message}</p>
      ) : null}
    </form>
  );
}
