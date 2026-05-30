"use client";

import { useActionState, useRef, useState } from "react";
import { submitPairingTaste } from "@/app/(app)/(shell)/pairings/[cigarId]/[bourbonId]/taste/actions";
import { Button, Card, Divider } from "@/components/primitives";
import { ReleaseLabelInput } from "@/components/product/release-label-input";
import { compressPhotoForUpload } from "@/lib/image/compress-for-upload";
import { cn } from "@/lib/utils";

type ProductSummary = {
  id: string;
  name: string;
  brand: string | null;
};

type Props = {
  cigar: ProductSummary;
  bourbon: ProductSummary;
  recentEvents: Array<{ id: string; name: string; date: string }>;
  /** Pre-uploaded pairing photo from capture identify step. */
  photoStoragePath?: string | null;
  photoPreviewUrl?: string | null;
  bourbonReleasePattern?: string | null;
  bourbonKnownReleaseLabels?: string[];
  visionReleaseLabel?: string | null;
  /** Detail route: member uploads photo on this screen. */
  requirePhotoUpload?: boolean;
  cigarExtractedName?: string | null;
  cigarExtractedBrand?: string | null;
  bourbonExtractedName?: string | null;
  bourbonExtractedBrand?: string | null;
};

type State = { status: "idle" | "error"; message?: string };
const initial: State = { status: "idle" };

export function PairingTasteFormCollapsed({
  cigar,
  bourbon,
  recentEvents,
  photoStoragePath = null,
  photoPreviewUrl = null,
  bourbonReleasePattern = null,
  bourbonKnownReleaseLabels = [],
  visionReleaseLabel = null,
  requirePhotoUpload = false,
  cigarExtractedName = null,
  cigarExtractedBrand = null,
  bourbonExtractedName = null,
  bourbonExtractedBrand = null,
}: Props) {
  const [state, action, pending] = useActionState(submitPairingTaste, initial);
  const [recommend, setRecommend] = useState<"yes" | "no">("yes");
  const [preview, setPreview] = useState<string | null>(photoPreviewUrl);
  const [preparingPhoto, setPreparingPhoto] = useState(false);
  const [photoError, setPhotoError] = useState<string | null>(null);
  const photoInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const libraryInputRef = useRef<HTMLInputElement>(null);

  const hasStoredPhoto = Boolean(photoStoragePath);
  const showPhotoUpload = requirePhotoUpload || !hasStoredPhoto;
  const canSubmit = !pending && !preparingPhoto && (hasStoredPhoto || (showPhotoUpload && preview));

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

  return (
    <form action={action} className="flex flex-col gap-6">
      <input type="hidden" name="cigar_id" value={cigar.id} />
      <input type="hidden" name="bourbon_id" value={bourbon.id} />
      <input type="hidden" name="recommend" value={recommend} />
      {photoStoragePath ? (
        <input type="hidden" name="photo_storage_path" value={photoStoragePath} />
      ) : null}
      {visionReleaseLabel ? (
        <input type="hidden" name="vision_release_label" value={visionReleaseLabel} />
      ) : null}
      {cigarExtractedName ? (
        <input type="hidden" name="cigar_extracted_name" value={cigarExtractedName} />
      ) : null}
      {cigarExtractedBrand ? (
        <input type="hidden" name="cigar_extracted_brand" value={cigarExtractedBrand} />
      ) : null}
      {bourbonExtractedName ? (
        <input type="hidden" name="bourbon_extracted_name" value={bourbonExtractedName} />
      ) : null}
      {bourbonExtractedBrand ? (
        <input type="hidden" name="bourbon_extracted_brand" value={bourbonExtractedBrand} />
      ) : null}

      {showPhotoUpload ? (
        <>
          <input
            ref={photoInputRef}
            id="photo"
            name="photo"
            type="file"
            accept="image/*"
            required={requirePhotoUpload && !hasStoredPhoto}
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
              // biome-ignore lint/performance/noImgElement: data URL preview
              <img
                src={preview}
                alt="The pair"
                className="absolute inset-0 w-full h-full object-cover"
              />
            ) : (
              <div className="text-center px-6">
                <p className="text-xl mb-1 font-display">Add a photo</p>
                <p className="text-sm text-foreground-subtle">Cigar and pour together</p>
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
        </>
      ) : preview ? (
        <div className="relative aspect-square rounded-[16px] overflow-hidden border border-border">
          {/* biome-ignore lint/performance/noImgElement: data URL preview */}
          <img src={preview} alt="The pair" className="w-full h-full object-cover" />
        </div>
      ) : null}

      <header>
        <p className="text-sm tracking-widest uppercase text-foreground-subtle">The pairing</p>
        <p className="text-lg leading-snug mt-1">
          {cigar.name}
          <span className="text-foreground-muted"> with </span>
          {bourbon.name}
        </p>
        {(cigar.brand || bourbon.brand) && (
          <p className="text-xs text-foreground-muted mt-0.5">
            {[cigar.brand, bourbon.brand].filter(Boolean).join(" · ")}
          </p>
        )}
      </header>

      <div
        role="radiogroup"
        aria-label="Recommend this pairing?"
        className="grid grid-cols-2 gap-2 p-1 bg-surface border border-border rounded-[12px]"
      >
        <RecommendOption
          selected={recommend === "yes"}
          onSelect={() => setRecommend("yes")}
          label="Recommend"
        />
        <RecommendOption
          selected={recommend === "no"}
          onSelect={() => setRecommend("no")}
          label="Just logging it"
        />
      </div>

      {recentEvents.length > 0 ? (
        <>
          <Divider label="Meetup (optional)" />
          <label className="flex flex-col gap-2">
            <span className="text-sm text-foreground-muted">Tag a club night</span>
            <select
              name="event_id"
              defaultValue="none"
              className="rounded-[12px] bg-surface border border-border focus:border-accent transition-colors p-3 text-base outline-none"
            >
              <option value="none">No meetup</option>
              {recentEvents.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.name} · {e.date}
                </option>
              ))}
            </select>
          </label>
        </>
      ) : null}

      {bourbonReleasePattern != null || bourbonKnownReleaseLabels.length > 0 ? (
        <ReleaseLabelInput
          name="bourbon_release_label"
          releasePattern={bourbonReleasePattern}
          suggestions={bourbonKnownReleaseLabels}
        />
      ) : null}

      <Divider label="Notes on the pairing" />

      <label className="flex flex-col gap-2">
        <span className="text-sm text-foreground-muted">How did they sit together? (optional)</span>
        <textarea
          name="note"
          rows={3}
          maxLength={500}
          className="rounded-[12px] bg-surface border border-border focus:border-accent transition-colors p-3 text-base outline-none"
          placeholder="The cigar's pepper softened on the second pour. Caramel landed differently after a draw."
        />
      </label>

      {photoError ? (
        <Card className="border-ember-500">
          <p className="text-sm text-ember-500" role="alert">
            {photoError}
          </p>
        </Card>
      ) : null}

      {state.status === "error" ? (
        <Card className="border-ember-500">
          <p className="text-sm text-ember-500" role="alert">
            {state.message}
          </p>
        </Card>
      ) : null}

      <Button type="submit" size="large" disabled={!canSubmit} className="w-full">
        {pending ? "Saving…" : "Save the pairing"}
      </Button>
    </form>
  );
}

function RecommendOption({
  selected,
  onSelect,
  label,
}: {
  selected: boolean;
  onSelect: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onSelect}
      className={cn(
        "h-11 rounded-[10px] text-sm font-medium transition-colors",
        selected
          ? "bg-accent text-ink-900"
          : "bg-transparent text-foreground-muted hover:bg-surface-2",
      )}
    >
      {label}
    </button>
  );
}
