import { Divider } from "@/components/primitives";

export function TonightsPickSkeleton() {
  return (
    <section className="mb-5" role="status" aria-busy="true" aria-label="Loading tonight's pick">
      <Divider label="Tonight's pick" />
      <div className="mt-3 space-y-2 animate-pulse">
        <div className="h-4 bg-surface-2 rounded w-full" />
        <div className="h-4 bg-surface-2 rounded w-5/6" />
        <div className="h-12 bg-surface-2 rounded-[12px] w-40 mt-2" />
      </div>
    </section>
  );
}
