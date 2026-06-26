import { Divider } from "@/components/primitives";

export function TryNextSkeleton() {
  return (
    <section className="mb-5" role="status" aria-busy="true" aria-label="Loading suggestions">
      <Divider label="Try next" />
      <div className="mt-3 space-y-2 animate-pulse">
        <div className="h-4 bg-surface-2 rounded w-3/4" />
        <div className="h-16 rounded-[12px] bg-surface-2" />
        <div className="h-16 rounded-[12px] bg-surface-2" />
      </div>
    </section>
  );
}
