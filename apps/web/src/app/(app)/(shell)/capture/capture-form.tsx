"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { Button, Card, Voice } from "@/components/primitives";
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
  const photoInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const libraryInputRef = useRef<HTMLInputElement>(null);

  async function handlePhotoSelected(file: File | undefined) {
    const input = photoInputRef.current;
    if (!file || !input) {
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
      if (cameraInputRef.current) cameraInputRef.current.value = "";
      if (libraryInputRef.current) libraryInputRef.current.value = "";
    }
  }

  if (pending) {
    return <CapturePendingState type={type} preview={preview} />;
  }

  const voiceLine =
    type === "cigar"
      ? "Hold the band steady, sir. I'll do the rest."
      : "Hold the label steady, sir. I'll do the rest.";

  return (
    <form action={action} className="flex flex-col gap-6">
      <input type="hidden" name="type" value={type} />

      <Voice className="text-center mb-2">{voiceLine}</Voice>

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

      <input
        ref={photoInputRef}
        id="photo"
        name="photo"
        type="file"
        accept="image/*"
        required
        className="sr-only"
        tabIndex={-1}
        aria-hidden="true"
      />
      <input
        ref={cameraInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="sr-only"
        tabIndex={-1}
        aria-hidden="true"
        onChange={(e) => void handlePhotoSelected(e.target.files?.[0])}
      />
      <input
        ref={libraryInputRef}
        type="file"
        accept="image/*"
        className="sr-only"
        tabIndex={-1}
        aria-hidden="true"
        onChange={(e) => void handlePhotoSelected(e.target.files?.[0])}
      />

      <div
        className={cn(
          "relative flex flex-col items-center justify-center",
          "aspect-square rounded-[16px] border-2 border-dashed border-border",
          "bg-surface overflow-hidden",
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
            <p className="text-xl mb-1 font-display">Add a photo</p>
            <p className="text-sm text-foreground-subtle">
              {type === "cigar" ? "Show the band clearly" : "Show the label"}
            </p>
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 gap-2">
        <Button
          type="button"
          variant="secondary"
          disabled={pending || preparingPhoto}
          onClick={() => cameraInputRef.current?.click()}
        >
          Take photo
        </Button>
        <Button
          type="button"
          variant="secondary"
          disabled={pending || preparingPhoto}
          onClick={() => libraryInputRef.current?.click()}
        >
          Choose saved
        </Button>
      </div>

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

/**
 * Rendered while the capture server action is in flight. Now a short window
 * (~15-20s) — just vision identify + match + draft creation. Catalog
 * enrichment narration takes over on the product detail page.
 */
function CapturePendingState({ type, preview }: { type: ProductType; preview: string | null }) {
  const lines =
    type === "cigar"
      ? [
          "Reading the band…",
          "Checking the catalog for a match.",
          "Almost there…",
        ]
      : [
          "Reading the label…",
          "Checking the catalog for a match.",
          "Almost there…",
        ];

  const [idx, setIdx] = useState(0);
  useEffect(() => {
    const t = window.setInterval(() => {
      setIdx((i) => (i < lines.length - 1 ? i + 1 : i));
    }, 7000);
    return () => window.clearInterval(t);
  }, [lines.length]);

  return (
    <div className="flex flex-col gap-8 items-center text-center">
      {preview ? (
        // biome-ignore lint/performance/noImgElement: data URL preview not optimized via next/image
        <img
          src={preview}
          alt="Your capture"
          className="w-full aspect-square object-cover rounded-[16px] opacity-70"
        />
      ) : null}

      <Voice className="text-lg leading-relaxed">{lines[idx]}</Voice>

      <div
        role="progressbar"
        aria-label="Working"
        aria-busy="true"
        className="h-1 w-32 rounded-full bg-surface-2 overflow-hidden"
      >
        <div className="h-full bg-accent animate-pulse" />
      </div>
    </div>
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
