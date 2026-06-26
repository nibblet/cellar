import { Divider, VoiceProseSkeleton } from "@/components/primitives";

export function CellarInsightSkeleton() {
  return (
    <section className="mb-5">
      <Divider label="Winston on your shelf" />
      <VoiceProseSkeleton className="mt-3 px-5 py-5" lines={4} />
    </section>
  );
}
