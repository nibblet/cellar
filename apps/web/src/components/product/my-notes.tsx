import { Card } from "@/components/primitives";
import type { MemberTake } from "@/lib/aggregation/group-voice";

type MyNotesProps = {
  take: MemberTake;
};

/**
 * The personal notes card on product detail. In the solo app there is no
 * club voice — this surfaces my own chips + note for the product.
 */
export function MyNotes({ take }: MyNotesProps) {
  return (
    <Card className="px-5 py-5">
      {take.chips.length > 0 ? (
        <div className="flex flex-wrap gap-1.5">
          {take.chips.map((c) => (
            <span
              key={c}
              className="px-2 py-0.5 rounded-full bg-accent-tint text-xs text-foreground border border-accent"
            >
              {c}
            </span>
          ))}
        </div>
      ) : null}
      {take.note ? (
        <p className="text-sm text-foreground-muted italic mt-2">"{take.note}"</p>
      ) : null}
      {take.chips.length === 0 && !take.note ? (
        <p className="text-sm text-foreground-subtle">No notes recorded.</p>
      ) : null}
    </Card>
  );
}
