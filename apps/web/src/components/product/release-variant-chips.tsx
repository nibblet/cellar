import { releasePatternHeading } from "@/lib/tasting/known-release-labels";

type ReleaseVariantChipsProps = {
  labels: string[];
  releasePattern?: string | null;
  className?: string;
};

/**
 * Read-only chip row for collapsed catalog variants and logged member releases.
 */
export function ReleaseVariantChips({
  labels,
  releasePattern,
  className,
}: ReleaseVariantChipsProps) {
  if (labels.length === 0) return null;

  const heading = releasePatternHeading(releasePattern);

  return (
    <div className={className}>
      {heading ? (
        <p className="text-[10px] uppercase tracking-widest text-foreground-subtle mb-2">
          {heading}
        </p>
      ) : null}
      <div className="flex flex-wrap gap-1.5">
        {labels.map((label) => (
          <span
            key={label}
            className="px-2 py-0.5 rounded-full bg-surface-2 text-xs text-foreground-muted border border-border"
          >
            {label}
          </span>
        ))}
      </div>
    </div>
  );
}
