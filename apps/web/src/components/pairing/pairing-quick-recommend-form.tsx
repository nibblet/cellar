"use client";

import { useFormState } from "react-dom";
import { submitPairingTaste } from "@/app/(app)/(shell)/pairings/[cigarId]/[bourbonId]/taste/actions";
import { Button, Card } from "@/components/primitives";

type PairingQuickRecommendFormProps = {
  cigarId: string;
  bourbonId: string;
  photoStoragePath: string | null;
  cigarExtractedName?: string;
  cigarExtractedBrand?: string | null;
  bourbonExtractedName?: string;
  bourbonExtractedBrand?: string | null;
  visionReleaseLabel?: string | null;
  onAddNotes: () => void;
};

type State = { status: "idle" | "error"; message?: string };
const initial: State = { status: "idle" };

export function PairingQuickRecommendForm({
  cigarId,
  bourbonId,
  photoStoragePath,
  cigarExtractedName,
  cigarExtractedBrand,
  bourbonExtractedName,
  bourbonExtractedBrand,
  visionReleaseLabel,
  onAddNotes,
}: PairingQuickRecommendFormProps) {
  const [state, action, pending] = useFormState(submitPairingTaste, initial);

  return (
    <div className="flex flex-col gap-3">
      <form action={action} className="flex flex-col gap-3">
        <input type="hidden" name="cigar_id" value={cigarId} />
        <input type="hidden" name="bourbon_id" value={bourbonId} />
        <input type="hidden" name="recommend" value="yes" />
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

        <Button
          type="submit"
          size="large"
          className="w-full"
          disabled={pending || !photoStoragePath}
        >
          {pending ? "Saving…" : "Recommend this pairing"}
        </Button>
      </form>

      <button
        type="button"
        onClick={onAddNotes}
        className="text-sm text-foreground-muted hover:text-foreground text-center"
      >
        Add tasting notes
      </button>

      {state.status === "error" ? (
        <Card className="border-ember-500">
          <p className="text-sm text-ember-500" role="alert">
            {state.message}
          </p>
        </Card>
      ) : null}
    </div>
  );
}
