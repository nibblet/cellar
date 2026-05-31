import Link from "next/link";
import { Card } from "@/components/primitives";
import type { MakerSummary } from "@/lib/makers/browse";

type Props = {
  summary: MakerSummary;
};

export function MakerSummaryCard({ summary }: Props) {
  const countLabel =
    summary.product_count === 1 ? "1 product" : `${summary.product_count} products`;

  return (
    <Link href={`/makers/${summary.slug}`} className="block min-h-11">
      <Card className="py-3.5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="font-medium">{summary.name}</p>
            {summary.country ? (
              <p className="text-sm text-foreground-muted mt-0.5">{summary.country}</p>
            ) : null}
            {summary.house_style ? (
              <p className="text-[11px] uppercase tracking-widest text-foreground-subtle mt-1">
                {summary.house_style}
              </p>
            ) : null}
          </div>
          <p className="text-sm text-foreground-muted shrink-0">{countLabel}</p>
        </div>
      </Card>
    </Link>
  );
}
