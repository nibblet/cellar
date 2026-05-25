import { releasePatternPrompt } from "@/lib/tasting/release-label";

type ReleaseLabelInputProps = {
  name?: string;
  releasePattern: string | null;
  defaultValue?: string | null;
  visionValue?: string | null;
};

export function ReleaseLabelInput({
  name = "release_label",
  releasePattern,
  defaultValue,
  visionValue,
}: ReleaseLabelInputProps) {
  const prompt = releasePatternPrompt(releasePattern);
  if (!prompt && !defaultValue && !visionValue) return null;

  return (
    <label className="flex flex-col gap-2">
      <span className="text-sm text-foreground-muted">
        {prompt ?? "Release detail (optional)"}
      </span>
      <input
        type="text"
        name={name}
        defaultValue={defaultValue ?? visionValue ?? ""}
        maxLength={120}
        className="rounded-[12px] bg-surface border border-border focus:border-accent transition-colors px-3 py-2.5 text-base outline-none"
        placeholder={
          releasePattern === "year"
            ? "2021"
            : releasePattern === "batch"
              ? "Batch 22F"
              : releasePattern === "pick"
                ? "Total Wine pick"
                : "Year, batch, or pick"
        }
      />
      {visionValue ? (
        <input type="hidden" name="vision_release_label" value={visionValue} />
      ) : null}
    </label>
  );
}
