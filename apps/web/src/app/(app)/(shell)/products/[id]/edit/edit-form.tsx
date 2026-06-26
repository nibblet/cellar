"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { Button, Card, Divider, Voice } from "@/components/primitives";
import type { ProductType } from "@/lib/wheel";
import { type EditProductState, updateProduct } from "./actions";

const initial: EditProductState = { status: "idle" };

type Specs = {
  wrapper_color?: string;
  country?: string;
  vitola?: string;
  strength?: string;
  price_tier?: number;
  distillery?: string;
  mash_bill?: string;
  proof?: number;
  age_label?: string;
  tier?: number;
  availability_rarity?: string;
  price_usd?: number;
};

type Props = {
  product: {
    id: string;
    type: ProductType;
    name: string;
    brand: string | null;
    specs: Specs;
  };
  canReEnrich?: boolean;
};

const COBB_TIERS = [
  { value: 1, label: "1 — Everyday" },
  { value: 2, label: "2 — Common" },
  { value: 3, label: "3 — Uncommon" },
  { value: 4, label: "4 — Rare" },
  { value: 5, label: "5 — Unicorn" },
] as const;

const CIGAR_PRICE_TIERS = [
  { value: 1, label: "1 — Value" },
  { value: 2, label: "2 — Affordable" },
  { value: 3, label: "3 — Premium" },
  { value: 4, label: "4 — Luxury" },
  { value: 5, label: "5 — Ultra-premium" },
] as const;

const AVAILABILITY_OPTIONS = [
  { value: "", label: "— not set —" },
  { value: "everyday", label: "Everyday" },
  { value: "seasonal", label: "Seasonal" },
  { value: "allocated", label: "Allocated" },
  { value: "lottery", label: "Lottery" },
  { value: "secondary-only", label: "Secondary only" },
  { value: "discontinued", label: "Discontinued" },
] as const;

const inputClass =
  "h-11 px-3 rounded-[10px] bg-surface border border-border text-base text-foreground focus:border-accent outline-none";

export function EditForm({ product, canReEnrich }: Props) {
  const [state, action, pending] = useActionState(updateProduct, initial);
  const isCigar = product.type === "cigar";
  const [enriching, setEnriching] = useState(false);
  const [enrichResult, setEnrichResult] = useState<{
    ok?: boolean;
    error?: string;
    reviewsWritten?: number;
  } | null>(null);

  async function handleReEnrich() {
    setEnriching(true);
    setEnrichResult(null);
    try {
      const res = await fetch("/api/enrich-draft", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ productId: product.id, force: true }),
      });
      const data = await res.json();
      if (!res.ok) {
        setEnrichResult({ error: data.error ?? "Failed" });
      } else {
        setEnrichResult({ ok: true, reviewsWritten: data.reviewsWritten });
      }
    } catch {
      setEnrichResult({ error: "Network error" });
    } finally {
      setEnriching(false);
    }
  }

  return (
    <form action={action} className="flex flex-col gap-5">
      <input type="hidden" name="product_id" value={product.id} />

      <label htmlFor="name" className="flex flex-col gap-1.5">
        <span className="text-sm tracking-wider uppercase text-foreground-subtle">Name</span>
        <input
          id="name"
          name="name"
          type="text"
          required
          defaultValue={product.name}
          className="h-12 px-3 rounded-[10px] bg-surface border border-border text-base text-foreground focus:border-accent outline-none"
        />
      </label>

      <label htmlFor="brand" className="flex flex-col gap-1.5">
        <span className="text-sm tracking-wider uppercase text-foreground-subtle">Brand</span>
        <input
          id="brand"
          name="brand"
          type="text"
          defaultValue={product.brand ?? ""}
          className="h-12 px-3 rounded-[10px] bg-surface border border-border text-base text-foreground focus:border-accent outline-none"
        />
      </label>

      <fieldset className="grid grid-cols-2 gap-2 p-1 bg-surface border border-border rounded-[12px]">
        <legend className="sr-only">Type</legend>
        <TypeOption value="cigar" label="Cigar" defaultChecked={isCigar} />
        <TypeOption value="bourbon" label="Bourbon" defaultChecked={!isCigar} />
      </fieldset>

      {isCigar ? (
        <>
          <SpecField name="wrapper_color" label="Wrapper" value={product.specs.wrapper_color} />
          <SpecField name="country" label="Country" value={product.specs.country} />
          <SpecField name="vitola" label="Vitola" value={product.specs.vitola} />
          <SpecField name="strength" label="Strength" value={product.specs.strength} />

          <Divider label="CATALOG" />

          <TierSelectField
            name="price_tier"
            label="Price tier"
            value={product.specs.price_tier}
            tiers={CIGAR_PRICE_TIERS}
          />
          <NumberSpecField
            name="price_usd"
            label="Price (USD)"
            value={product.specs.price_usd}
            step="0.01"
          />
        </>
      ) : (
        <>
          <SpecField name="distillery" label="Distillery" value={product.specs.distillery} />
          <SpecField name="mash_bill" label="Mash bill" value={product.specs.mash_bill} />

          <Divider label="AGING & PROOF" />

          <NumberSpecField
            name="proof"
            label="Proof"
            value={product.specs.proof}
            step="0.1"
            placeholder="e.g. 90"
          />
          <SpecField
            name="age_label"
            label="Age"
            value={product.specs.age_label}
            placeholder="e.g. 12 yr or NAS"
          />

          <Divider label="CATALOG" />

          <TierSelectField name="tier" label="Tier" value={product.specs.tier} tiers={COBB_TIERS} />
          <AvailabilitySelectField value={product.specs.availability_rarity} />
          <NumberSpecField
            name="price_usd"
            label="Price (USD)"
            value={product.specs.price_usd}
            step="0.01"
            placeholder="e.g. 49.99"
          />
        </>
      )}

      {state.status === "error" ? (
        <Card className="border-ember-500">
          <p className="text-sm text-ember-500" role="alert">
            {state.message}
          </p>
        </Card>
      ) : null}

      <div className="flex gap-3 mt-2">
        <Link href={`/products/${product.id}`} className="flex-1">
          <Button type="button" variant="ghost" className="w-full">
            Cancel
          </Button>
        </Link>
        <Button type="submit" disabled={pending} className="flex-1">
          {pending ? "Saving…" : "Save"}
        </Button>
      </div>

      {canReEnrich ? (
        <div className="mt-6 pt-6 border-t border-border">
          <p className="text-xs uppercase tracking-widest text-foreground-subtle mb-3">
            Catalog enrichment
          </p>
          <Voice className="text-sm mb-4">
            Save first, then re-enrich to pull fresh reviews and specs for the updated name.
          </Voice>
          <Button
            type="button"
            variant="ghost"
            disabled={enriching || pending}
            className="w-full"
            onClick={handleReEnrich}
          >
            {enriching ? "Re-enriching…" : "Re-enrich from web"}
          </Button>
          {enrichResult?.ok ? (
            <p className="text-xs text-foreground-muted mt-2 text-center">
              Done — {enrichResult.reviewsWritten ?? 0} reviews pulled. Return to detail page to see
              updates.
            </p>
          ) : null}
          {enrichResult?.error ? (
            <p className="text-xs text-ember-500 mt-2 text-center">{enrichResult.error}</p>
          ) : null}
        </div>
      ) : null}
    </form>
  );
}

function TypeOption({
  value,
  label,
  defaultChecked,
}: {
  value: ProductType;
  label: string;
  defaultChecked: boolean;
}) {
  return (
    <label className="cursor-pointer">
      <input
        type="radio"
        name="type"
        value={value}
        defaultChecked={defaultChecked}
        className="peer sr-only"
      />
      <span className="block h-11 leading-[2.75rem] text-center rounded-[10px] text-base font-medium transition-colors text-foreground-muted hover:bg-surface-2 peer-checked:bg-accent peer-checked:text-ink-900">
        {label}
      </span>
    </label>
  );
}

function SpecField({
  name,
  label,
  value,
  placeholder,
}: {
  name: string;
  label: string;
  value?: string;
  placeholder?: string;
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-sm text-foreground-muted">{label}</span>
      <input
        name={`specs.${name}`}
        type="text"
        defaultValue={value ?? ""}
        placeholder={placeholder}
        className={inputClass}
      />
    </label>
  );
}

function NumberSpecField({
  name,
  label,
  value,
  step = "any",
  placeholder,
}: {
  name: string;
  label: string;
  value?: number;
  step?: string;
  placeholder?: string;
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-sm text-foreground-muted">{label}</span>
      <input
        name={`specs.${name}`}
        type="number"
        min="0"
        step={step}
        defaultValue={value ?? ""}
        placeholder={placeholder}
        className={inputClass}
      />
    </label>
  );
}

function TierSelectField({
  name,
  label,
  value,
  tiers,
}: {
  name: string;
  label: string;
  value?: number;
  tiers: readonly { value: number; label: string }[];
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-sm text-foreground-muted">{label}</span>
      <select
        name={`specs.${name}`}
        defaultValue={value ?? ""}
        className={`${inputClass} appearance-none`}
      >
        <option value="">— not set —</option>
        {tiers.map((t) => (
          <option key={t.value} value={t.value}>
            {t.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function AvailabilitySelectField({ value }: { value?: string }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-sm text-foreground-muted">Availability</span>
      <select
        name="specs.availability_rarity"
        defaultValue={value ?? ""}
        className={`${inputClass} appearance-none`}
      >
        {AVAILABILITY_OPTIONS.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}
