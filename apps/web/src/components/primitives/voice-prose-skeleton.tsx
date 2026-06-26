import { Card } from "./card";

type VoiceProseSkeletonProps = {
  lines?: number;
  className?: string;
};

export function VoiceProseSkeleton({ lines = 3, className }: VoiceProseSkeletonProps) {
  return (
    <Card className={className ?? "px-5 py-5"}>
      <div
        className="space-y-2.5 animate-pulse"
        role="status"
        aria-busy="true"
        aria-label="Loading"
      >
        {Array.from({ length: lines }, (_, i) => (
          <div
            // biome-ignore lint/suspicious/noArrayIndexKey: static skeleton bars, order never changes
            key={i}
            className="h-[17px] bg-surface-2 rounded"
            style={{ width: `${100 - i * 8}%` }}
          />
        ))}
      </div>
    </Card>
  );
}
