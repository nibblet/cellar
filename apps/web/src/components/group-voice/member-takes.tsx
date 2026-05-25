"use client";

import { useState } from "react";
import type { MemberTake } from "@/lib/aggregation/group-voice";

type MemberTakesProps = {
  takes: MemberTake[];
  initialVisible?: number;
};

export function MemberTakes({ takes, initialVisible = 3 }: MemberTakesProps) {
  const [expanded, setExpanded] = useState(false);
  if (takes.length === 0) return null;

  const visible = expanded ? takes : takes.slice(0, initialVisible);
  const hidden = takes.length - visible.length;

  return (
    <div className="flex flex-col gap-3">
      <ul className="flex flex-col divide-y divide-border">
        {visible.map((t) => (
          <li key={`${t.user_id}-${t.release_label ?? ""}-${t.created_at}`} className="py-3 first:pt-0 last:pb-0">
            <div className="flex items-baseline gap-2 flex-wrap">
              <span
                className={t.recommend ? "text-ember-500" : "text-foreground-subtle"}
                aria-hidden="true"
              >
                ●
              </span>
              <span className="font-medium text-foreground">{t.display_name}</span>
              {t.release_label ? (
                <span className="px-2 py-0.5 rounded-full bg-surface-2 text-[11px] text-foreground-muted">
                  {t.release_label}
                </span>
              ) : null}
              <span className="sr-only">{t.recommend ? "recommends" : "passed"}</span>
            </div>
            {t.note ? <p className="text-sm text-foreground italic mt-1">"{t.note}"</p> : null}
            {t.chips.length > 0 ? (
              <div className="flex flex-wrap gap-1.5 mt-1.5">
                {t.chips.map((chip) => (
                  <span
                    key={chip}
                    className="px-2 py-0.5 rounded-full bg-surface-2 text-xs text-foreground-muted"
                  >
                    {chip}
                  </span>
                ))}
              </div>
            ) : null}
          </li>
        ))}
      </ul>

      {hidden > 0 ? (
        <button
          type="button"
          onClick={() => setExpanded(true)}
          className="text-sm text-foreground-muted hover:text-foreground self-start"
        >
          + {hidden} more {hidden === 1 ? "take" : "takes"}
        </button>
      ) : null}
    </div>
  );
}
