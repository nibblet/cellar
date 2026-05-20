import type { MemberNameFields } from "@/lib/identity";
import { formatMemberName } from "@/lib/identity";
import { cn } from "@/lib/utils";

type MemberTagProps = {
  member: MemberNameFields;
  recommendStatus?: "lit" | "dim" | "neutral";
  className?: string;
};

const dotColor: Record<NonNullable<MemberTagProps["recommendStatus"]>, string> = {
  lit: "bg-ember-500",
  dim: "bg-ink-500",
  neutral: "bg-border",
};

/**
 * Universal identity element. Always renders as "First L" via the global
 * formatter. Optional colored dot signals recommend status on takes lists.
 */
export function MemberTag({ member, recommendStatus = "neutral", className }: MemberTagProps) {
  return (
    <span className={cn("inline-flex items-center gap-2 text-base font-medium", className)}>
      <span
        aria-hidden="true"
        className={cn("inline-block w-3 h-3 rounded-full", dotColor[recommendStatus])}
      />
      {formatMemberName(member)}
    </span>
  );
}
