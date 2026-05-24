import { notFound } from "next/navigation";
import { CellarToggle } from "@/components/cellar";
import { PairsWith } from "@/components/pairing";
import { Divider } from "@/components/primitives";
import {
  ClubVoice,
  ProductDepthSection,
  ProductHero,
  type ProductHeroImage,
  TastingActionSegment,
} from "@/components/product";
import { buildClubSaysProse } from "@/lib/aggregation/club-says-prose";
import { loadGroupVoice } from "@/lib/aggregation/group-voice";
import { loadCellarRow } from "@/lib/cellar/load";
import { ZERO_ROW } from "@/lib/cellar/types";
import { formatPriceBucket, normalizeProductSpecs } from "@/lib/catalog/normalize-specs";
import { signImagePaths } from "@/lib/feed/queries";
import { loadOrComputeTopPairings } from "@/lib/pairing/engine";
import { checkGroupValidation } from "@/lib/pairing/group-validation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { ProductType, WheelVector } from "@/lib/wheel";
import { DraftConfirmBanner } from "./draft-confirm";

type Params = Promise<{ id: string }>;
type SearchParams = Promise<{
  just_captured?: string;
  just_saved?: string;
  event?: string;
}>;

export default async function ProductDetailPage({
  params,
  searchParams,
}: {
  params: Params;
  searchParams: SearchParams;
}) {
  const { id } = await params;
  const { just_captured, just_saved, event } = await searchParams;

  const supabase = await createSupabaseServerClient();

  const { data: product, error } = await supabase
    .from("products")
    .select(
      "id, type, name, brand, image_url, specs, status, created_at, trait_vector, wheel_vector",
    )
    .eq("id", id)
    .maybeSingle();

  if (error || !product) notFound();

  const productType = product.type as ProductType;
  const specs = (product.specs ?? {}) as Record<string, unknown>;
  const wheelVector = (product.wheel_vector ?? null) as WheelVector | null;

  const { data: auth } = await supabase.auth.getUser();
  const userId = auth.user?.id ?? null;

  const cellarRow = userId ? await loadCellarRow(supabase, userId, id) : ZERO_ROW;

  const [groupVoice, pairings, imagesResult] = await Promise.all([
    loadGroupVoice(supabase, id, productType),
    loadOrComputeTopPairings(supabase, id, { limit: 3, minScore: 45 }),
    supabase
      .from("product_images")
      .select(
        "image_url, is_hero, created_at, contributor:users!product_images_contributed_by_fkey(name_first, name_last_initial)",
      )
      .eq("product_id", id)
      .order("is_hero", { ascending: false })
      .order("created_at", { ascending: false }),
  ]);

  const myTake = userId ? groupVoice.takes.find((t) => t.user_id === userId) : undefined;
  const otherTakes = groupVoice.takes.filter((t) => t.user_id !== userId);
  const winstonProse = buildClubSaysProse(groupVoice, myTake);

  const validatedFlags = await Promise.all(
    pairings.map(async (c) => {
      const validated = await checkGroupValidation(
        supabase,
        productType === "cigar" ? id : c.product_id,
        productType === "cigar" ? c.product_id : id,
      );
      return validated ? c.product_id : null;
    }),
  );
  const validatedPairs = new Set(validatedFlags.filter((x): x is string => x !== null));

  type ImageRow = {
    image_url: string;
    is_hero: boolean;
    contributor: { name_first: string; name_last_initial: string } | null;
  };
  const imageRows = (imagesResult.data as unknown as ImageRow[] | null) ?? [];
  const signedMap = await signImagePaths(
    supabase,
    imageRows.map((r) => r.image_url),
  );
  const userImages: ProductHeroImage[] = imageRows
    .map((r) => {
      const url = signedMap.get(r.image_url);
      if (!url) return null;
      const contributor = r.contributor
        ? `${r.contributor.name_first} ${r.contributor.name_last_initial}`
        : null;
      return { url, contributor };
    })
    .filter((x): x is ProductHeroImage => x !== null);

  const stockUrl =
    (product as unknown as { image_url?: string | null }).image_url ||
    (typeof specs.image_url === "string" ? specs.image_url : null) ||
    null;

  const isDraft = product.status === "draft";
  const subtitle = composeSubtitle(productType, specs);
  const isBaseline = groupVoice.tag_cloud.length === 0 && wheelVector != null;

  return (
    <main className="mx-auto max-w-md px-5 py-6 pb-24 flex-1">
      {just_saved || just_captured ? (
        <div className="mb-4">
          <div className="flex items-center gap-2 text-[11px] uppercase tracking-widest text-foreground-subtle">
            <span className="block w-1.5 h-1.5 rounded-full bg-ember-500" aria-hidden="true" />
            {just_saved ? "Tasting saved" : "Added to the archive"}
          </div>
          {just_saved && userId && !cellarRow.have && !cellarRow.want ? (
            <div className="mt-3 flex items-center gap-2">
              <span className="text-xs text-foreground-muted">Add to cellar?</span>
              <CellarToggle productId={product.id} initialState={cellarRow} />
            </div>
          ) : null}
        </div>
      ) : null}

      <ProductHero
        productType={productType}
        productName={product.name}
        userImages={userImages}
        stockUrl={stockUrl}
      />

      <header className="mt-6">
        {product.brand ? (
          <p className="text-[11px] uppercase tracking-widest text-foreground-subtle mb-2">
            {product.brand}
          </p>
        ) : null}
        <h1 className="text-[28px] leading-[1.1] tracking-tight">{product.name}</h1>
        {subtitle ? <p className="text-sm text-foreground-muted mt-2">{subtitle}</p> : null}
      </header>

      {userId ? (
        <div className="mt-4">
          <CellarToggle productId={product.id} initialState={cellarRow} />
        </div>
      ) : null}

      {isDraft ? (
        <DraftConfirmBanner
          productId={product.id}
          productType={productType}
          productName={product.name}
          brand={product.brand ?? null}
          justCaptured={Boolean(just_captured)}
          alreadyEnriched={Boolean(stockUrl)}
        />
      ) : null}

      <Divider label="The club says" />

      <ClubVoice
        productType={productType}
        groupVoice={groupVoice}
        otherTakes={otherTakes}
        myTake={myTake}
        winstonProse={winstonProse}
      />

      <div className="mt-6">
        <Divider label="Pairs with" />
        <PairsWith
          sourceType={productType}
          sourceId={id}
          candidates={pairings}
          validatedPairs={validatedPairs}
        />
      </div>

      {userId ? (
        <div className="mt-6">
          <TastingActionSegment
            productId={product.id}
            hasTasting={Boolean(myTake)}
            event={event}
          />
        </div>
      ) : null}

      <div className="mt-8" id="depth">
        <ProductDepthSection
          productType={productType}
          specs={specs}
          tagCloud={groupVoice.tag_cloud}
          wheelVector={wheelVector}
          isBaseline={isBaseline}
        />
      </div>
    </main>
  );
}

function composeSubtitle(productType: ProductType, specs: Record<string, unknown>): string | null {
  const { priceBucket } = normalizeProductSpecs(productType, specs);
  const tokens: string[] = [];
  if (priceBucket != null) tokens.push(formatPriceBucket(priceBucket));
  if (productType === "cigar") {
    if (typeof specs.vitola === "string" && specs.vitola) tokens.push(specs.vitola);
    if (typeof specs.strength === "string" && specs.strength) tokens.push(specs.strength);
    if (typeof specs.country === "string" && specs.country) tokens.push(specs.country);
  } else {
    if (typeof specs.age_label === "string" && specs.age_label) tokens.push(specs.age_label);
    if (typeof specs.proof === "number") tokens.push(`${specs.proof}°`);
    if (typeof specs.style_family === "string" && specs.style_family)
      tokens.push(specs.style_family);
  }
  return tokens.length > 0 ? tokens.join(" · ") : null;
}
