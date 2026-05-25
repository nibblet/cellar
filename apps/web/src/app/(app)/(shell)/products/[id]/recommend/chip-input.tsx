"use client";

import { useId, useMemo, useState } from "react";
import { cn } from "@/lib/utils";

type ChipInputProps = {
  name: string;
  /** Labels of every wheel leaf for the current product type — drives autocomplete. */
  leafLabels: string[];
  /** Initial chips (e.g., from server-side draft). */
  initial?: string[];
  placeholder?: string;
};

const MAX_CHIPS = 8;

/**
 * Pill-style chip input. The user types a descriptor; pressing Enter or comma
 * adds it. Autocomplete suggests wheel-leaf labels that match the current
 * prefix. Free text is allowed — anything not in the wheel still gets stored
 * on the tasting and the LLM mapper handles it later.
 *
 * Renders a hidden text input per chip so the form picks them up as an array
 * under the same name (FormData.getAll(name) returns string[]).
 */
export function ChipInput({ name, leafLabels, initial = [], placeholder }: ChipInputProps) {
  const inputId = useId();
  const [chips, setChips] = useState<string[]>(initial);
  const [draft, setDraft] = useState("");

  const suggestions = useMemo(() => {
    const q = draft.trim().toLowerCase();
    if (!q) return [];
    return leafLabels
      .filter((label) => label.toLowerCase().includes(q) && !chips.includes(label))
      .slice(0, 6);
  }, [draft, leafLabels, chips]);

  function commit(value: string) {
    const trimmed = value.trim();
    if (!trimmed) return;
    if (chips.length >= MAX_CHIPS) return;
    if (chips.some((c) => c.toLowerCase() === trimmed.toLowerCase())) {
      setDraft("");
      return;
    }
    setChips((prev) => [...prev, trimmed]);
    setDraft("");
  }

  function remove(idx: number) {
    setChips((prev) => prev.filter((_, i) => i !== idx));
  }

  return (
    <div className="flex flex-col gap-2">
      <label htmlFor={inputId} className="text-sm text-foreground-muted">
        Three words?
      </label>

      <div
        className={cn(
          "flex flex-wrap gap-2 p-3 rounded-[12px] bg-surface border border-border",
          "focus-within:border-accent transition-colors",
        )}
      >
        {chips.map((chip, idx) => (
          <span
            key={chip}
            data-idx={idx}
            className="inline-flex items-center gap-1.5 pl-3 pr-1 py-1 rounded-full bg-accent-tint border border-accent text-sm text-foreground"
          >
            {chip}
            <button
              type="button"
              onClick={() => remove(idx)}
              aria-label={`Remove ${chip}`}
              className="w-5 h-5 inline-flex items-center justify-center rounded-full hover:bg-accent/20 text-foreground-muted"
            >
              ×
            </button>
          </span>
        ))}

        {chips.length < MAX_CHIPS ? (
          <input
            id={inputId}
            type="text"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === ",") {
                e.preventDefault();
                commit(draft);
              } else if (e.key === "Backspace" && !draft && chips.length > 0) {
                e.preventDefault();
                remove(chips.length - 1);
              }
            }}
            onBlur={() => draft && commit(draft)}
            placeholder={chips.length === 0 ? placeholder : ""}
            className="flex-1 min-w-[8ch] bg-transparent outline-none text-base text-foreground placeholder:text-foreground-subtle"
          />
        ) : null}
      </div>

      {suggestions.length > 0 ? (
        <ul className="flex flex-wrap gap-2" aria-label="Suggestions">
          {suggestions.map((s) => (
            <li key={s}>
              <button
                type="button"
                onClick={() => commit(s)}
                className="px-3 py-1 text-sm rounded-full border border-border text-foreground-muted hover:bg-surface-2 transition-colors"
              >
                {s}
              </button>
            </li>
          ))}
        </ul>
      ) : null}

      {/* Each chip goes through the form as its own input under `name`. */}
      {chips.map((chip) => (
        <input key={`hidden-${chip}`} type="hidden" name={name} value={chip} />
      ))}
    </div>
  );
}
