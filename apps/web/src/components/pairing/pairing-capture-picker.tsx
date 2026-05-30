"use client";

import { useState } from "react";
import { Button } from "@/components/primitives";
import type { PickerProduct } from "@/lib/pairing/picker-products";
import { ProductPickerSection } from "./product-picker-section";

type PairingCapturePickerProps = {
  initialCigar: PickerProduct | null;
  onBothSelected: (cigar: PickerProduct, bourbon: PickerProduct) => void;
};

export function PairingCapturePicker({ initialCigar, onBothSelected }: PairingCapturePickerProps) {
  const [cigar, setCigar] = useState<PickerProduct | null>(initialCigar);
  const [bourbon, setBourbon] = useState<PickerProduct | null>(null);

  return (
    <div className="flex flex-col gap-6">
      <ProductPickerSection label="Pick a cigar" productType="cigar" onSelect={setCigar} />

      <ProductPickerSection label="Pick a bourbon" productType="bourbon" onSelect={setBourbon} />

      {cigar && bourbon ? (
        <Button
          type="button"
          size="large"
          className="w-full"
          onClick={() => onBothSelected(cigar, bourbon)}
        >
          Continue
        </Button>
      ) : null}
    </div>
  );
}
