"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { identifyPairingPhoto } from "@/app/(app)/(shell)/pairings/capture/actions";
import type {
  IdentifiedHalfPayload,
  IdentifyPairingState,
} from "@/app/(app)/(shell)/pairings/capture/types";
import { Button, Card, Voice } from "@/components/primitives";
import { compressPhotoForUpload } from "@/lib/image/compress-for-upload";
import { cn } from "@/lib/utils";
import { PairingCapturePicker } from "./pairing-capture-picker";
import { PairingQuickRecommendForm } from "./pairing-quick-recommend-form";
import { PairingTasteFormCollapsed } from "./pairing-taste-form-collapsed";
import { ProductPickerSection } from "./product-picker-section";

type Step = "photo" | "confirm" | "catalog" | "taste";

type ConfirmedHalf = {
  productId: string;
  name: string;
  brand: string | null;
  releaseLabel: string | null;
  extractedName: string;
  extractedBrand: string | null;
};

type PairingCaptureFlowProps = {
  recentEvents: Array<{ id: string; name: string; date: string }>;
  bourbonReleasePattern: string | null;
  bourbonKnownReleaseLabels: string[];
  initialCigar: { id: string; name: string; brand: string | null } | null;
};

const identifyInitial: IdentifyPairingState = { status: "idle" };

export function PairingCaptureFlow({
  recentEvents,
  bourbonReleasePattern,
  bourbonKnownReleaseLabels,
  initialCigar,
}: PairingCaptureFlowProps) {
  const [step, setStep] = useState<Step>(initialCigar ? "catalog" : "photo");
  const [identifyState, identifyAction, identifying] = useActionState(
    identifyPairingPhoto,
    identifyInitial,
  );
  const [preview, setPreview] = useState<string | null>(null);
  const [preparingPhoto, setPreparingPhoto] = useState(false);
  const [photoError, setPhotoError] = useState<string | null>(null);
  const [storagePath, setStoragePath] = useState<string | null>(null);
  const [cigar, setCigar] = useState<ConfirmedHalf | null>(
    initialCigar
      ? {
          productId: initialCigar.id,
          name: initialCigar.name,
          brand: initialCigar.brand,
          releaseLabel: null,
          extractedName: initialCigar.name,
          extractedBrand: initialCigar.brand,
        }
      : null,
  );
  const [bourbon, setBourbon] = useState<ConfirmedHalf | null>(null);
  const [changeTarget, setChangeTarget] = useState<"cigar" | "bourbon" | null>(null);

  useEffect(() => {
    if (identifyState.status === "identified") {
      setStoragePath(identifyState.storagePath);
      setCigar(halfToConfirmed(identifyState.cigar));
      setBourbon(halfToConfirmed(identifyState.bourbon));
      setStep("confirm");
    }
  }, [identifyState]);

  if (step === "taste" && cigar?.productId && bourbon?.productId) {
    return (
      <PairingTasteFormCollapsed
        cigar={{ id: cigar.productId, name: cigar.name, brand: cigar.brand }}
        bourbon={{ id: bourbon.productId, name: bourbon.name, brand: bourbon.brand }}
        recentEvents={recentEvents}
        photoStoragePath={storagePath}
        photoPreviewUrl={preview}
        bourbonReleasePattern={bourbonReleasePattern}
        bourbonKnownReleaseLabels={bourbonKnownReleaseLabels}
        visionReleaseLabel={bourbon.releaseLabel}
        cigarExtractedName={cigar.extractedName}
        cigarExtractedBrand={cigar.extractedBrand}
        bourbonExtractedName={bourbon.extractedName}
        bourbonExtractedBrand={bourbon.extractedBrand}
      />
    );
  }

  if (step === "catalog") {
    return (
      <div className="flex flex-col gap-4">
        <button
          type="button"
          className="text-sm text-foreground-muted hover:text-foreground text-left"
          onClick={() => setStep("photo")}
        >
          ← Back to photo
        </button>
        <PairingCapturePicker
          initialCigar={initialCigar}
          onBothSelected={(c, b) => {
            setCigar({
              productId: c.id,
              name: c.name,
              brand: c.brand,
              releaseLabel: null,
              extractedName: c.name,
              extractedBrand: c.brand,
            });
            setBourbon({
              productId: b.id,
              name: b.name,
              brand: b.brand,
              releaseLabel: null,
              extractedName: b.name,
              extractedBrand: b.brand,
            });
            setStep("taste");
          }}
        />
      </div>
    );
  }

  if (step === "confirm" && cigar && bourbon) {
    const canContinue = Boolean(cigar.productId && bourbon.productId);

    return (
      <div className="flex flex-col gap-6">
        {preview ? (
          <div className="relative aspect-square rounded-[16px] overflow-hidden border border-border">
            {/* biome-ignore lint/performance/noImgElement: data URL preview */}
            <img src={preview} alt="The pair" className="w-full h-full object-cover" />
          </div>
        ) : null}

        <DividerThin label="Confirm the pair" />

        <ConfirmRow kindLabel="Cigar" half={cigar} onChange={() => setChangeTarget("cigar")} />
        {changeTarget === "cigar" ? (
          <ProductPickerSection
            label="Pick a cigar"
            productType="cigar"
            onSelect={(p) => {
              setCigar({
                productId: p.id,
                name: p.name,
                brand: p.brand,
                releaseLabel: null,
                extractedName: cigar.extractedName,
                extractedBrand: cigar.extractedBrand,
              });
              setChangeTarget(null);
            }}
          />
        ) : null}

        <ConfirmRow
          kindLabel="Bourbon"
          half={bourbon}
          onChange={() => setChangeTarget("bourbon")}
        />
        {changeTarget === "bourbon" ? (
          <ProductPickerSection
            label="Pick a bourbon"
            productType="bourbon"
            onSelect={(p) => {
              setBourbon({
                productId: p.id,
                name: p.name,
                brand: p.brand,
                releaseLabel: bourbon.releaseLabel,
                extractedName: bourbon.extractedName,
                extractedBrand: bourbon.extractedBrand,
              });
              setChangeTarget(null);
            }}
          />
        ) : null}

        {!cigar.productId || !bourbon.productId ? (
          <Card>
            <p className="text-sm text-foreground-muted">
              Search and pick any missing product before continuing.
            </p>
          </Card>
        ) : null}

        {canContinue ? (
          <PairingQuickRecommendForm
            cigarId={cigar.productId}
            bourbonId={bourbon.productId}
            photoStoragePath={storagePath}
            cigarExtractedName={cigar.extractedName}
            cigarExtractedBrand={cigar.extractedBrand}
            bourbonExtractedName={bourbon.extractedName}
            bourbonExtractedBrand={bourbon.extractedBrand}
            visionReleaseLabel={bourbon.releaseLabel}
            onAddNotes={() => setStep("taste")}
          />
        ) : null}
      </div>
    );
  }

  if (identifying) {
    return (
      <div className="flex flex-col gap-8 items-center text-center">
        {preview ? (
          // biome-ignore lint/performance/noImgElement: data URL preview
          <img
            src={preview}
            alt="Your pairing"
            className="w-full aspect-square object-cover rounded-[16px] opacity-70"
          />
        ) : null}
        <Voice className="text-lg leading-relaxed">Reading the band and the label…</Voice>
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

  return (
    <PhotoStepForm
      preview={preview}
      photoError={photoError}
      identifyError={identifyState.status === "error" ? identifyState.message : null}
      disabled={identifying || preparingPhoto}
      onPhotoSelected={async (file, input) => {
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
        }
      }}
      onSubmit={identifyAction}
      onCatalogFallback={() => setStep("catalog")}
    />
  );
}

function halfToConfirmed(half: IdentifiedHalfPayload): ConfirmedHalf {
  return {
    productId: half.productId ?? "",
    name: half.displayName,
    brand: half.displayBrand,
    releaseLabel: half.releaseLabel,
    extractedName: half.extractedName,
    extractedBrand: half.extractedBrand,
  };
}

function ConfirmRow({
  kindLabel,
  half,
  onChange,
}: {
  kindLabel: string;
  half: ConfirmedHalf;
  onChange: () => void;
}) {
  return (
    <div className="flex items-start justify-between gap-3 rounded-[12px] border border-border bg-surface p-3">
      <div className="min-w-0 flex-1">
        <p className="text-[10px] uppercase tracking-widest text-foreground-subtle">{kindLabel}</p>
        <p className="text-base text-foreground truncate">{half.name}</p>
        {half.brand ? <p className="text-xs text-foreground-muted truncate">{half.brand}</p> : null}
        {!half.productId ? (
          <p className="text-xs text-ember-500 mt-1">No catalog match — tap Change to search</p>
        ) : null}
      </div>
      <button
        type="button"
        onClick={onChange}
        className="text-sm text-foreground-muted hover:text-accent shrink-0"
      >
        Change
      </button>
    </div>
  );
}

function DividerThin({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-3">
      <div className="flex-1 h-px bg-border" />
      <span className="text-[10px] uppercase tracking-widest text-foreground-subtle">{label}</span>
      <div className="flex-1 h-px bg-border" />
    </div>
  );
}

function PhotoStepForm({
  preview,
  photoError,
  identifyError,
  disabled,
  onPhotoSelected,
  onSubmit,
  onCatalogFallback,
}: {
  preview: string | null;
  photoError: string | null;
  identifyError: string | null;
  disabled: boolean;
  onPhotoSelected: (file: File | undefined, input: HTMLInputElement | null) => void;
  onSubmit: (formData: FormData) => void;
  onCatalogFallback: () => void;
}) {
  const photoInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const libraryInputRef = useRef<HTMLInputElement>(null);

  return (
    <form action={onSubmit} className="flex flex-col gap-6">
      <input
        ref={photoInputRef}
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
        onChange={(e) => void onPhotoSelected(e.target.files?.[0], photoInputRef.current)}
      />
      <input
        ref={libraryInputRef}
        type="file"
        accept="image/*"
        className="sr-only"
        onChange={(e) => void onPhotoSelected(e.target.files?.[0], photoInputRef.current)}
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
          disabled={disabled}
          onClick={() => cameraInputRef.current?.click()}
        >
          Take photo
        </Button>
        <Button
          type="button"
          variant="secondary"
          disabled={disabled}
          onClick={() => libraryInputRef.current?.click()}
        >
          Choose saved
        </Button>
      </div>

      {(photoError || identifyError) && (
        <Card className="border-ember-500">
          <p className="text-sm text-ember-500" role="alert">
            {photoError ?? identifyError}
          </p>
        </Card>
      )}

      <Button type="submit" size="large" disabled={disabled || !preview} className="w-full">
        {disabled ? "Identifying…" : "Identify the pair"}
      </Button>

      <button
        type="button"
        onClick={onCatalogFallback}
        className="text-sm text-foreground-muted hover:text-foreground text-center"
      >
        Pick from catalog instead
      </button>
    </form>
  );
}
