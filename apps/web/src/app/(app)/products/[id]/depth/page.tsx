import Link from "next/link";
import { notFound } from "next/navigation";
import { Divider } from "@/components/primitives";
import { ConstructionPanel, FactsStrip } from "@/components/product";
import { buildTagCloud, loadGroupVoice, type TagCloudEntry } from "@/lib/aggregation/group-voice";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { ProductType, WheelVector } from "@/lib/wheel";

type Params = Promise<{ id: string }>;

// Keys surfaced in the Construction panel — excluded from the dense Facts
// strip so values don't repeat.
const CIGAR_CONSTRUCTION_KEYS = [
  "wrapper",
  "wrapper_color",
  "binder",
  "filler",
  "country",
  "vitola",
  "length",
  "ring_gauge",
  "strength",
];
const BOURBON_CONSTRUCTION_KEYS = [
  "distillery",
  "mash_bill",
  "proof",
  "abv",
  "age_years",
  "age_label",
  "aging_period_years",
  "style_family",
  "dsp",
];

/**
 * Depth view — full spec table, flavor bar chart, and correction affordance.
 * Accessible whether or not a trait_vector exists; the flavor chart simply
 * shows a placeholder when no tastings have been logged.
 */
export default async function ProductDepthPage({ params }: { params: Params }) {
  const { id } = await params;
  const supabase = await createSupabaseServerClient();

  const { data: product } = await supabase
    .from("products")
    .select("id, type, name, brand, specs, wheel_vector")
    .eq("id", id)
    .maybeSingle();

  if (!product) notFound();

  const productType = product.type as ProductType;
  const specs = (product.specs ?? {}) as Record<string, unknown>;

  const groupVoice = await loadGroupVoice(supabase, id, productType);

  // Fall back to the catalog baseline (wheel_vector from enrichment) when no
  // member tastings have been logged yet.
  const wheelVector = (product as unknown as { wheel_vector?: WheelVector | null }).wheel_vector;
  const flavorEntries =
    groupVoice.tag_cloud.length > 0
      ? groupVoice.tag_cloud
      : buildTagCloud(productType, wheelVector ? [wheelVector] : []);
  const isBaseline = groupVoice.tag_cloud.length === 0 && flavorEntries.length > 0;

  return (
    <main className="mx-auto max-w-md px-5 py-6 pb-24 flex-1">
      <header className="mb-6">
        <Link
          href={`/products/${id}`}
          className="text-[11px] uppercase tracking-widest text-foreground-subtle hover:text-foreground-muted"
        >
          ← Back
        </Link>
        <h1 className="text-3xl mt-2">{product.name}</h1>
        {product.brand ? (
          <p className="text-sm text-foreground-muted mt-1">
            {product.brand} ·{" "}
            <span className="uppercase tracking-widest text-foreground-subtle">{productType}</span>
          </p>
        ) : null}
      </header>

      <Divider label="Construction" />
      <ConstructionPanel productType={productType} specs={specs} />

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
          {/* Notes grouped by wheel branch (Wood / Earth / Spice / …). The
              underlying 0-5 intensities saturate and tie at the top, so we
              don't draw bars; instead each branch heads its own row and notes
              appear in rank order. Branches themselves are ordered by their
              top-ranked leaf, so the most-prominent family leads. */}
          <dl className="space-y-3">
            {groupByCategory(flavorEntries).map((group) => (
              <div
                key={group.category_id}
                className="grid grid-cols-[88px,1fr] gap-3 items-baseline"
              >
                <dt className="text-[11px] uppercase tracking-widest text-foreground-subtle">
                  {group.category_label}
                </dt>
                <dd className="text-base leading-relaxed text-foreground">
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

      <div className="mt-10 pt-6 border-t border-border">
        <Link
          href={`/products/${id}/edit`}
          className="text-sm text-foreground-subtle hover:text-foreground-muted"
        >
          Spot something wrong? Suggest a correction →
        </Link>
      </div>
    </main>
  );
}

/**
 * "The reviewers say" — surfaces specs.tasting_notes_raw from the enrichment
 * pipeline as a single italicized prose block. Only renders when the field
 * is populated; cigars don't have an equivalent populated field yet, so this
 * shows up for bourbons only in practice.
 *
 * The source URL (specs.review_url) is intentionally not linked from here —
 * the depth view is for browsing, not source-chasing. Curious members can
 * still find it via the product edit page.
 */
function ReviewersSay({ specs }: { specs: Record<string, unknown> }) {
  const raw = specs.tasting_notes_raw;
  if (typeof raw !== "string" || !raw.trim()) return null;
  return (
    <>
      <Divider label="The reviewers say" />
      <blockquote className="text-base leading-relaxed text-foreground-muted italic font-display">
        "{raw.trim()}"
      </blockquote>
    </>
  );
}

/**
 * Group ranked tag-cloud entries by wheel branch, preserving the input rank
 * order both across branches (first branch = branch of the top-ranked leaf)
 * and within a branch (leaves stay in rank order). Entries without a known
 * branch fall into an "Other" group at the end.
 */
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
