import type { MemberBadge } from "@/lib/badges/definitions";
import { cn } from "@/lib/utils";

type MemberBadgesProps = {
  badges: MemberBadge[];
  className?: string;
  /** Compact marks for roster rows; profile view shows labels on hover only. */
  variant?: "inline" | "profile";
};

/**
 * Micro-badges earned from tastings and meetups (Tier 3 #15). Subdued
 * marks — flavor, not competition. Full names live in the title tooltip.
 */
export function MemberBadges({ badges, className, variant = "inline" }: MemberBadgesProps) {
  if (badges.length === 0) return null;

  return (
    <span className={cn("inline-flex items-center gap-1 flex-wrap", className)}>
      {badges.map((badge) => (
        <span
          key={badge.id}
          title={badge.hint}
          className={cn(
            "inline-flex items-center justify-center rounded-full border border-border bg-surface-2 text-foreground-muted font-medium tabular-nums",
            variant === "inline"
              ? "min-w-[1.25rem] h-5 px-1 text-[9px] tracking-wide"
              : "min-w-[1.5rem] h-6 px-1.5 text-[10px] tracking-wide",
          )}
        >
          <span aria-hidden="true">{badge.mark}</span>
          <span className="sr-only">{badge.label}</span>
        </span>
      ))}
    </span>
  );
}

export function MemberNameWithBadges({
  name,
  badges,
  className,
}: {
  name: string;
  badges: MemberBadge[];
  className?: string;
}) {
  return (
    <span className={cn("inline-flex items-center gap-2 min-w-0", className)}>
      <span className="truncate">{name}</span>
      <MemberBadges badges={badges} />
    </span>
  );
}
