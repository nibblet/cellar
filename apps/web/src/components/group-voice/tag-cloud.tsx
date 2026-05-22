"use client";

import { useState } from "react";
import type { TagCloudEntry } from "@/lib/aggregation/group-voice";

type TagCloudProps = {
  entries: TagCloudEntry[];
};

/**
 * Club flavor profile (UX-3). Shows the top 3 flavor descriptors prominently
 * in Playfair roman, then collapses the rest behind an "and N more" toggle.
 *
 * Replaced the size-weighted word cloud: the cloud's visual encoding was hard
 * to decode and a member's own chips dominated the view. This layout reads
 * like a tasting-note pull-quote — top notes first, supporting notes below.
 */
export function TagCloud({ entries }: TagCloudProps) {
  const [expanded, setExpanded] = useState(false);

  if (entries.length === 0) {
    return (
      <p className="text-sm text-foreground-subtle">
        Not enough impressions yet to draw a profile.
      </p>
    );
  }

  const top = entries.slice(0, 3);
  const rest = entries.slice(3);

  return (
    <div>
      {/* Top 3 — editorial pull-quote style */}
      <div className="flex flex-wrap gap-x-4 gap-y-1 items-baseline">
        {top.map((entry, i) => (
          <span
            key={entry.leaf_id}
            className="font-display text-foreground leading-tight"
            style={{
              // Primary note larger, supporting notes step down subtly
              fontSize: i === 0 ? 22 : i === 1 ? 18 : 15,
              fontWeight: i === 0 ? 700 : i === 1 ? 600 : 500,
              opacity: i === 0 ? 1 : i === 1 ? 0.85 : 0.7,
            }}
          >
            {entry.label}
          </span>
        ))}
      </div>

      {/* Rest — shown inline when expanded */}
      {rest.length > 0 ? (
        <div className="mt-2">
          {expanded ? (
            <div className="flex flex-wrap gap-x-3 gap-y-1">
              {rest.map((entry) => (
                <span key={entry.leaf_id} className="text-sm text-foreground-muted">
                  {entry.label}
                </span>
              ))}
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setExpanded(true)}
              className="text-xs text-foreground-subtle hover:text-foreground-muted mt-1"
            >
              and {rest.length} more
            </button>
          )}
        </div>
      ) : null}
    </div>
  );
}
