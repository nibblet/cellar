import { Divider } from "@/components/primitives";

export function FindYourNextSkeleton() {
  return (
    <div className="mb-4" role="status" aria-busy="true" aria-label="Loading suggestions">
      <Divider label="Find your next" />
      <div className="mt-3 flex flex-col gap-2">
        <div className="h-24 rounded-[14px] bg-surface-2 animate-pulse" />
        <div className="grid grid-cols-2 gap-2">
          <div className="h-16 rounded-[14px] bg-surface-2 animate-pulse" />
          <div className="h-16 rounded-[14px] bg-surface-2 animate-pulse" />
        </div>
      </div>
    </div>
  );
}
