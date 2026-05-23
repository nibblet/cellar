export type SessionPhase = {
  chips: string[];
  note: string;
};

export type CigarSessionPhases = {
  first: SessionPhase;
  second: SessionPhase;
  final: SessionPhase;
};

export type BourbonSessionPhases = {
  nose: SessionPhase;
  palate: SessionPhase;
  finish: SessionPhase;
};

export const CIGAR_PHASE_LABELS: Record<keyof CigarSessionPhases, string> = {
  first: "First third",
  second: "Second third",
  final: "Final third",
};

export const BOURBON_PHASE_LABELS: Record<keyof BourbonSessionPhases, string> = {
  nose: "Nose",
  palate: "Palate",
  finish: "Finish",
};

/** Deduped merge of all phase chip arrays (case-insensitive). */
export function mergeSessionChips(phases: SessionPhase[]): string[] {
  const seen = new Set<string>();
  const merged: string[] = [];

  for (const phase of phases) {
    for (const chip of phase.chips) {
      const trimmed = chip.trim();
      if (!trimmed) continue;
      const key = trimmed.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      merged.push(trimmed);
    }
  }

  return merged;
}

/** Concatenate non-empty phase notes with human-readable labels. */
export function formatSessionNote(entries: Array<{ label: string; note: string }>): string | null {
  const lines = entries
    .map(({ label, note }) => {
      const trimmed = note.trim();
      if (!trimmed) return null;
      return `${label}: ${trimmed}`;
    })
    .filter((line): line is string => line !== null);

  return lines.length > 0 ? lines.join("\n") : null;
}

export function mergeCigarSession(phases: CigarSessionPhases): {
  chips: string[];
  note: string | null;
} {
  const ordered = [
    { label: CIGAR_PHASE_LABELS.first, ...phases.first },
    { label: CIGAR_PHASE_LABELS.second, ...phases.second },
    { label: CIGAR_PHASE_LABELS.final, ...phases.final },
  ];

  return {
    chips: mergeSessionChips(ordered),
    note: formatSessionNote(ordered),
  };
}

export function mergeBourbonSession(phases: BourbonSessionPhases): {
  chips: string[];
  note: string | null;
} {
  const ordered = [
    { label: BOURBON_PHASE_LABELS.nose, ...phases.nose },
    { label: BOURBON_PHASE_LABELS.palate, ...phases.palate },
    { label: BOURBON_PHASE_LABELS.finish, ...phases.finish },
  ];

  return {
    chips: mergeSessionChips(ordered),
    note: formatSessionNote(ordered),
  };
}
