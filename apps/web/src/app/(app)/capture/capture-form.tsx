"use client";

import { useActionState, useState } from "react";
import { Button, Card } from "@/components/primitives";
import { compressPhotoForUpload } from "@/lib/image/compress-for-upload";
import { cn } from "@/lib/utils";
import { submitCapture } from "./actions";

type State = { status: "idle" | "error"; message?: string };
const initial: State = { status: "idle" };

type ProductType = "cigar" | "bourbon";

type CaptureFormProps = {
  recentEvents: Array<{ id: string; name: string; date: string }>;
};

export function CaptureForm({ recentEvents }: CaptureFormProps) {
  const [state, action, pending] = useActionState(submitCapture, initial);
  const [type, setType] = useState<ProductType>("cigar");
  const [preview, setPreview] = useState<string | null>(null);
  const [preparingPhoto, setPreparingPhoto] = useState(false);
  const [photoError, setPhotoError] = useState<string | null>(null);

  return (
    <form action={action} className="flex flex-col gap-6">
      <input type="hidden" name="type" value={type} />

      <fieldset className="grid grid-cols-2 gap-2 p-1 bg-surface border border-border rounded-[12px]">
        <legend className="sr-only">What are you tasting?</legend>
        <TypeOption
          value="cigar"
          label="Cigar"
          selected={type === "cigar"}
          onSelect={() => setType("cigar")}
        />
        <TypeOption
          value="bourbon"
          label="Bourbon"
          selected={type === "bourbon"}
          onSelect={() => setType("bourbon")}
        />
      </fieldset>

      <label
        htmlFor="photo"
        className={cn(
          "relative flex flex-col items-center justify-center",
          "aspect-square rounded-[16px] border-2 border-dashed border-border",
          "bg-surface hover:bg-surface-2 transition-colors cursor-pointer overflow-hidden",
        )}
      >
        {preview ? (
          // biome-ignore lint/performance/noImgElement: data URL preview not optimized via next/image
          <img
            src={preview}
            alt="Selected"
            className="absolute inset-0 w-full h-full object-cover"
          />
        ) : (
          <div className="text-center px-6">
            <p className="text-xl mb-1 font-display">Tap to capture</p>
            <p className="text-sm text-foreground-subtle">
              {type === "cigar" ? "Show the band clearly" : "Show the label"}
            </p>
          </div>
        )}
        <input
          id="photo"
          name="photo"
          type="file"
          accept="image/*"
          capture="environment"
          required
          className="sr-only"
          onChange={async (e) => {
            const input = e.target;
            const file = input.files?.[0];
            if (!file) {
              setPreview(null);
              setPhotoError(null);
              return;
            }

            setPreparingPhoto(true);
            setPhotoError(null);

            try {
              const compressed = await compressPhotoForUpload(file);
              const transfer = new DataTransfer();
              transfer.items.add(compressed);
              input.files = transfer.files;

              const reader = new FileReader();
              reader.onload = (ev) => setPreview(ev.target?.result as string);
              reader.readAsDataURL(compressed);
            } catch {
              setPreview(null);
              input.value = "";
              setPhotoError("Couldn't prepare that photo. Try again.");
            } finally {
              setPreparingPhoto(false);
            }
          }}
        />
      </label>

      {recentEvents.length > 0 ? (
        <label className="flex flex-col gap-1.5">
          <span className="text-sm text-foreground-muted">Tag a meetup? (optional)</span>
          <select
            name="event_id"
            defaultValue=""
            className="h-11 rounded-[10px] bg-surface border border-border px-3 text-base text-foreground focus:border-accent outline-none"
          >
            <option value="">— none —</option>
            {recentEvents.map((ev) => (
              <option key={ev.id} value={ev.id}>
                {ev.name} ·{" "}
                {new Date(ev.date).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
              </option>
            ))}
          </select>
        </label>
      ) : null}

      {photoError ? (
        <Card className="border-ember-500">
          <p className="text-sm text-ember-500" role="alert">
            {photoError}
          </p>
        </Card>
      ) : null}

      {state.status === "error" && (
        <Card className="border-ember-500">
          <p className="text-sm text-ember-500" role="alert">
            {state.message}
          </p>
        </Card>
      )}

      <Button type="submit" size="large" disabled={pending || preparingPhoto || !preview}>
        {pending ? "Identifying…" : preparingPhoto ? "Preparing photo…" : "Identify"}
      </Button>
    </form>
  );
}

function TypeOption({
  label,
  selected,
  onSelect,
}: {
  value: ProductType;
  label: string;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      className={cn(
        "h-11 rounded-[10px] text-base font-medium transition-colors",
        selected
          ? "bg-accent text-ink-900"
          : "bg-transparent text-foreground-muted hover:bg-surface-2",
      )}
    >
      {label}
    </button>
  );
}
