import { MakerSummaryCard } from "@/components/makers/maker-summary-card";
import { Voice } from "@/components/primitives";
import type { MakerSummary } from "@/lib/makers/browse";

type Props = {
  summaries: MakerSummary[];
  emptyMessage: string;
};

export function MakerSummaryList({ summaries, emptyMessage }: Props) {
  if (summaries.length === 0) {
    return (
      <Voice className="block text-sm mt-2">{emptyMessage}</Voice>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {summaries.map((summary) => (
        <MakerSummaryCard key={`${summary.type}:${summary.slug}`} summary={summary} />
      ))}
    </div>
  );
}
