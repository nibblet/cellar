"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { Card, Voice } from "@/components/primitives";

type WinstonTastingNoteProps = {
  text: string;
};

export function WinstonTastingNote({ text }: WinstonTastingNoteProps) {
  const sentences = splitToFirstBreak(text);
  const hasMore = sentences.rest !== null;
  const [expanded, setExpanded] = useState(false);

  return (
    <Card className="px-5 py-5">
      <Voice>{expanded || !hasMore ? text : sentences.preview}</Voice>

      {hasMore ? (
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="mt-3 flex items-center gap-1 text-xs text-foreground-muted hover:text-foreground transition-colors"
        >
          <ChevronDown
            className={`w-3.5 h-3.5 transition-transform ${expanded ? "rotate-180" : ""}`}
          />
          {expanded ? "Less" : "More"}
        </button>
      ) : null}
    </Card>
  );
}

function splitToFirstBreak(text: string): { preview: string; rest: string | null } {
  const periodBreak = findSentenceBreak(text, 2);
  if (periodBreak !== null && periodBreak < text.length - 1) {
    return { preview: text.slice(0, periodBreak).trim(), rest: text.slice(periodBreak).trim() };
  }
  return { preview: text, rest: null };
}

function findSentenceBreak(text: string, afterNSentences: number): number | null {
  let count = 0;
  for (let i = 0; i < text.length - 1; i++) {
    if (text[i] === "." && text[i + 1] === " " && !isAbbreviation(text, i)) {
      count++;
      if (count >= afterNSentences) return i + 1;
    }
  }
  return null;
}

function isAbbreviation(text: string, dotIndex: number): boolean {
  if (dotIndex < 1) return false;
  const before = text.slice(Math.max(0, dotIndex - 4), dotIndex);
  return /\b[A-Z]$/.test(before) || /\b(Mr|Mrs|Ms|Dr|St|Jr|Sr|vs|etc|e\.g|i\.e)$/i.test(before);
}
