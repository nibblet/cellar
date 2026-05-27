"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { Divider } from "@/components/primitives";
import { buildTagCloud, type TagCloudEntry } from "@/lib/aggregation/group-voice";
import type { ProductType, WheelVector } from "@/lib/wheel";
import { ConstructionPanel } from "./construction-panel";
import { FactsStrip } from "./facts-strip";

const CIGAR_CONSTRUCTION_KEYS = [
  "wrapper",
  "wrapper_color",
  "binder",
  "filler",
  "country",
  "factory",
  "vitola",
  "length_inches",
  "length",
  "ring_gauge",
  "dimension",
  "size",
  "strength",
  "body",
];
const BOURBON_CONSTRUCTION_KEYS = [
  "whiskey_type",
  "distillery",
  "expression_type",
  "mash_bill",
  "proof",
  "abv",
  "age_years",
  "age_label",
  "aging_period_years",
  "style_family",
];

type ProductDepthSectionProps = {
  productType: ProductType;
  productName?: string | null;
  specs: Record<string, unknown>;
  tagCloud: TagCloudEntry[];
  wheelVector: WheelVector | null;
  isBaseline: boolean;
};

export function ProductDepthSection({
  productType,
  productName,
  specs,
  tagCloud,
  wheelVector,
  isBaseline,
}: ProductDepthSectionProps) {
  const [open, setOpen] = useState(false);
  const flavorEntries =
    tagCloud.length > 0 ? tagCloud : buildTagCloud(productType, wheelVector ? [wheelVector] : []);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full"
      >
        <Divider
          label={
            <span className="inline-flex items-center gap-1.5">
              Details
              <ChevronDown
                className={`w-3.5 h-3.5 transition-transform ${open ? "rotate-180" : ""}`}
              />
            </span>
          }
        />
      </button>

      {open ? (
        <div className="animate-in fade-in slide-in-from-top-1 duration-200">
          <ConstructionPanel productType={productType} specs={specs} productName={productName} />

          <div className="mt-3">
            <FactsStrip
              productType={productType}
              specs={specs}
              excludeKeys={
                productType === "cigar" ? CIGAR_CONSTRUCTION_KEYS : BOURBON_CONSTRUCTION_KEYS
              }
            />
          </div>

          <ReviewersSay specs={specs} />

          <Divider label="Flavor profile" />

          {flavorEntries.length > 0 ? (
            <>
              <dl className="space-y-3">
                {groupByCategory(flavorEntries).map((group) => (
                  <div
                    key={group.category_id}
                    className="grid grid-cols-[88px,1fr] gap-3 items-baseline"
                  >
                    <dt className="text-[11px] uppercase tracking-widest text-foreground-subtle">
                      {group.category_label}
                    </dt>
                    <dd className="text-base leading-relaxed text-foreground break-words">
                      {group.entries.map((e) => e.label).join(" · ")}
                    </dd>
                  </div>
                ))}
              </dl>
              {isBaseline ? (
                <p className="text-[11px] uppercase tracking-widest text-foreground-subtle mt-4">
                  Catalog baseline · Fills in as the club weighs in
                </p>
              ) : null}
            </>
          ) : (
            <p className="text-sm text-foreground-subtle">
              No tastings logged yet — the profile fills in as the club weighs in.
            </p>
          )}
        </div>
      ) : null}
    </>
  );
}

function ReviewersSay({ specs }: { specs: Record<string, unknown> }) {
  const raw = specs.tasting_notes_raw;
  if (typeof raw !== "string" || !raw.trim()) return null;
  return (
    <>
      <Divider label="The reviewers say" />
      <blockquote className="text-base leading-relaxed text-foreground-muted italic font-display break-words">
        "{raw.trim()}"
      </blockquote>
    </>
  );
}

function groupByCategory(
  entries: TagCloudEntry[],
): { category_id: string; category_label: string; entries: TagCloudEntry[] }[] {
  const groups = new Map<
    string,
    { category_id: string; category_label: string; entries: TagCloudEntry[] }
  >();
  for (const entry of entries) {
    const key = entry.category_id || "other";
    const existing = groups.get(key);
    if (existing) {
      existing.entries.push(entry);
    } else {
      groups.set(key, {
        category_id: key,
        category_label: entry.category_label || "Other",
        entries: [entry],
      });
    }
  }
  return Array.from(groups.values());
}
