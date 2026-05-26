"use client";

import { useState } from "react";
import { releasePatternPrompt } from "@/lib/tasting/release-label";
import { cn } from "@/lib/utils";

type ReleaseLabelInputProps = {
  name?: string;
  releasePattern: string | null;
  defaultValue?: string | null;
  visionValue?: string | null;
  suggestions?: string[];
};

export function ReleaseLabelInput({
  name = "release_label",
  releasePattern,
  defaultValue,
  visionValue,
  suggestions = [],
}: ReleaseLabelInputProps) {
  const prompt = releasePatternPrompt(releasePattern);
  const initial = defaultValue ?? visionValue ?? "";
  const [value, setValue] = useState(initial);

  if (!prompt && !initial && suggestions.length === 0) return null;

  return (
    <div className="flex flex-col gap-2">
      {prompt ? <span className="text-sm text-foreground-muted">{prompt}</span> : null}

      {suggestions.length > 0 ? (
        <div className="flex flex-wrap gap-1.5" role="listbox" aria-label="Known releases">
          {suggestions.map((label) => {
            const selected = value === label;
            return (
              <button
                key={label}
                type="button"
                role="option"
                aria-selected={selected}
                onClick={() => setValue(selected ? "" : label)}
                className={cn(
                  "px-2.5 py-1 rounded-full text-xs border transition-colors",
                  selected
                    ? "bg-accent-tint text-foreground border-accent"
                    : "bg-surface-2 text-foreground-muted border-border hover:border-accent/60",
                )}
              >
                {label}
              </button>
            );
          })}
        </div>
      ) : null}

      <input
        type="text"
        name={name}
        value={value}
        onChange={(event) => setValue(event.target.value)}
        maxLength={120}
        className="rounded-[12px] bg-surface border border-border focus:border-accent transition-colors px-3 py-2.5 text-base outline-none"
        placeholder={
          releasePattern === "year"
            ? "2021"
            : releasePattern === "batch"
              ? "Batch 22F or 2009"
              : releasePattern === "pick"
                ? "Total Wine pick"
                : "Year, batch, or pick"
        }
      />

      {visionValue ? (
        <input type="hidden" name="vision_release_label" value={visionValue} />
      ) : null}
    </div>
  );
}
