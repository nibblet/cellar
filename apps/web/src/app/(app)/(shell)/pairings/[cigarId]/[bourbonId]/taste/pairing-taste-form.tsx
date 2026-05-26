"use client";

import { useActionState, useRef, useState } from "react";
import { ChipInput } from "@/app/(app)/(shell)/products/[id]/recommend/chip-input";
import { ReleaseLabelInput } from "@/components/product/release-label-input";
import { Button, Card, Divider } from "@/components/primitives";
import { compressPhotoForUpload } from "@/lib/image/compress-for-upload";
import { cn } from "@/lib/utils";
import { submitPairingTaste } from "./actions";

type Product = {
  id: string;
  name: string;
  brand: string | null;
  releasePattern?: string | null;
  knownReleaseLabels?: string[];
};
type PriorTasting = { recommend: boolean; chips: string[]; note: string | null };

type Props = {
  cigar: Product;
  bourbon: Product;
  cigarLeafLabels: string[];
  bourbonLeafLabels: string[];
  recentEvents: Array<{ id: string; name: string; date: string }>;
  priorCigar: PriorTasting | null;
  priorBourbon: PriorTasting | null;
};

type State = { status: "idle" | "error"; message?: string };
const initial: State = { status: "idle" };

/**
 * Pairing tasting form. Single photo at the top, two recommend/chip stacks
 * (one per product), one shared note about how the pair worked. Submit hits
 * the server action which creates two tastings sharing a pairing_session_id.
 */
export function PairingTasteForm({
  cigar,
  bourbon,
  cigarLeafLabels,
  bourbonLeafLabels,
  recentEvents,
  priorCigar,
  priorBourbon,
}: Props) {
  const [state, action, pending] = useActionState(submitPairingTaste, initial);
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

  const [cigarRecommend, setCigarRecommend] = useState<"yes" | "no">(
    priorCigar?.recommend === false ? "no" : "yes",
  );
  const [bourbonRecommend, setBourbonRecommend] = useState<"yes" | "no">(
    priorBourbon?.recommend === false ? "no" : "yes",
  );

  // Prefer the cigar's prior note since most pair-notes lean cigar-forward;
  // fall back to bourbon's if only that exists. Members can rewrite.
  const sharedNoteDefault = priorCigar?.note ?? priorBourbon?.note ?? "";

  return (
    <form action={action} className="flex flex-col gap-6">
      <input type="hidden" name="cigar_id" value={cigar.id} />
      <input type="hidden" name="bourbon_id" value={bourbon.id} />
      <input type="hidden" name="cigar_recommend" value={cigarRecommend} />
      <input type="hidden" name="bourbon_recommend" value={bourbonRecommend} />

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

      <ProductSlot
        product={cigar}
        kindLabel="cigar"
        leafLabels={cigarLeafLabels}
        chipFieldName="cigar_chips"
        priorChips={priorCigar?.chips ?? []}
        recommend={cigarRecommend}
        onRecommendChange={setCigarRecommend}
        chipPlaceholder="e.g. cocoa, leather, pepper"
      />

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

      <ProductSlot
        product={bourbon}
        kindLabel="bourbon"
        leafLabels={bourbonLeafLabels}
        chipFieldName="bourbon_chips"
        priorChips={priorBourbon?.chips ?? []}
        recommend={bourbonRecommend}
        onRecommendChange={setBourbonRecommend}
        chipPlaceholder="e.g. caramel, oak, rye"
        releasePattern={bourbon.releasePattern ?? null}
        knownReleaseLabels={bourbon.knownReleaseLabels ?? []}
      />

      <Divider label="Notes on the pairing" />

      <label className="flex flex-col gap-2">
        <span className="text-sm text-foreground-muted">How did they sit together? (optional)</span>
        <textarea
          name="note"
          defaultValue={sharedNoteDefault}
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

      <Button
        type="submit"
        size="large"
        disabled={pending || preparingPhoto || !preview}
        className="w-full"
      >
        {pending ? "Saving…" : "Save the pairing"}
      </Button>
    </form>
  );
}

function ProductSlot({
  product,
  kindLabel,
  leafLabels,
  chipFieldName,
  priorChips,
  recommend,
  onRecommendChange,
  chipPlaceholder,
  releasePattern,
  knownReleaseLabels,
}: {
  product: Product;
  kindLabel: string;
  leafLabels: string[];
  chipFieldName: string;
  priorChips: string[];
  recommend: "yes" | "no";
  onRecommendChange: (value: "yes" | "no") => void;
  chipPlaceholder: string;
  releasePattern?: string | null;
  knownReleaseLabels?: string[];
}) {
  return (
    <section className="flex flex-col gap-3">
      <header>
        <p className="text-[11px] uppercase tracking-widest text-foreground-subtle">{kindLabel}</p>
        <p className="text-lg leading-tight mt-0.5">{product.name}</p>
        {product.brand ? <p className="text-xs text-foreground-muted">{product.brand}</p> : null}
      </header>

      <div
        role="radiogroup"
        aria-label={`Recommend the ${kindLabel}?`}
        className="grid grid-cols-2 gap-2 p-1 bg-surface border border-border rounded-[12px]"
      >
        <RecommendOption
          selected={recommend === "yes"}
          onSelect={() => onRecommendChange("yes")}
          label="Recommend"
        />
        <RecommendOption
          selected={recommend === "no"}
          onSelect={() => onRecommendChange("no")}
          label="Pass"
        />
      </div>

      <ChipInput
        name={chipFieldName}
        leafLabels={leafLabels}
        initial={priorChips}
        placeholder={chipPlaceholder}
      />

      {kindLabel === "bourbon" ? (
        <ReleaseLabelInput
          name="bourbon_release_label"
          releasePattern={releasePattern ?? null}
          suggestions={knownReleaseLabels ?? []}
        />
      ) : null}
    </section>
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
      role="radio"
      aria-checked={selected}
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
