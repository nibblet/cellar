import { PenLine } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { CellarToggle } from "@/components/cellar";
import { AppShell } from "@/components/layout/app-shell";
import { Card, Divider } from "@/components/primitives";
import {
  CaptureConfirmBanner,
  ClubVoice,
  EnrichmentTrigger,
  ExploreLinks,
  ProductDepthSection,
  ProductHero,
  type ProductHeroImage,
  ReleaseVariantChips,
  TastingActionSegment,
  WinstonSuggests,
  WinstonTastingNote,
} from "@/components/product";
import type { GroupVoice } from "@/lib/aggregation/group-voice";
import { loadGroupVoice } from "@/lib/aggregation/group-voice";
import { composeProductSubtitle } from "@/lib/catalog/product-subtitle";
import { loadCellarRow } from "@/lib/cellar/load";
import { ZERO_ROW } from "@/lib/cellar/types";
import { productNeedsCatalogEnrichment } from "@/lib/enrich/needs-enrichment";
import { signImagePaths } from "@/lib/feed/queries";
import { formatMemberName } from "@/lib/identity";
import { makerSlug } from "@/lib/makers/slug";
import { ensureWinstonProse } from "@/lib/product/ensure-winston-prose";
import type { AdjacentProduct } from "@/lib/similarity/suggest-adjacent";
import { suggestAdjacentProducts } from "@/lib/similarity/suggest-adjacent";
import { loadProductSuggestions } from "@/lib/suggestions";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { collectKnownReleaseLabels } from "@/lib/tasting/known-release-labels";
import type { ProductType, WheelVector } from "@/lib/wheel";
import { DraftConfirmBanner } from "./draft-confirm";
import { RerollWinstonButton } from "./reroll-winston-button";

type Params = Promise<{ id: string }>;
type SearchParams = Promise<{
  just_captured?: string;
  just_saved?: string;
  event?: string;
  release_label?: string;
}>;

export default async function ProductDetailPage({
  params,
  searchParams,
}: {
  params: Params;
  searchParams: SearchParams;
}) {
  const { id } = await params;
  const { just_captured, just_saved, event, release_label } = await searchParams;

  const supabase = await createSupabaseServerClient();

  const { data: product, error } = await supabase
    .from("products")
    .select(
      "id, type, name, brand, image_url, specs, status, source, created_at, wheel_vector, release_pattern, vintages_matter",
    )
    .eq("id", id)
    .maybeSingle();

  if (error || !product) notFound();

  const productType = product.type as ProductType;
  const specs = (product.specs ?? {}) as Record<string, unknown>;
  const wheelVector = (product.wheel_vector ?? null) as WheelVector | null;
  const { data: auth } = await supabase.auth.getUser();
  const userId = auth.user?.id ?? null;

  const profileResult = userId
    ? await supabase.from("users").select("role").eq("id", userId).maybeSingle()
    : null;
  const isAdmin = profileResult?.data?.role === "admin";
  const isCreator = (product as { created_by?: string }).created_by === userId;
  const canEdit = isAdmin || (isCreator && product.status === "draft");

  const cellarRow = userId ? await loadCellarRow(supabase, userId, id) : ZERO_ROW;
  const productOnShelf = cellarRow.have;

  const [groupVoice, suggestions, adjacent, imagesResult, reviewCountResult] = await Promise.all([
    loadGroupVoice(supabase, id, productType),
    userId
      ? loadProductSuggestions(supabase, id, userId)
      : loadProductSuggestions(supabase, id, null),
    suggestAdjacentProducts(supabase, id, { limit: 3 }),
    supabase
      .from("product_images")
      .select(
        "image_url, is_hero, created_at, contributor:users!product_images_contributed_by_fkey(name_first, name_last_initial)",
      )
      .eq("product_id", id)
      .order("is_hero", { ascending: false })
      .order("created_at", { ascending: false }),
    supabase
      .from("product_reviews")
      .select("id", { count: "exact", head: true })
      .eq("product_id", id),
  ]);

  const myTake = userId ? groupVoice.takes.find((t) => t.user_id === userId) : undefined;
  const otherTakes = groupVoice.takes.filter((t) => t.user_id !== userId);

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
      const contributor = r.contributor ? formatMemberName(r.contributor) : null;
      return { url, contributor };
    })
    .filter((x): x is ProductHeroImage => x !== null);

  const stockUrl =
    (product as unknown as { image_url?: string | null }).image_url ||
    (typeof specs.image_url === "string" ? specs.image_url : null) ||
    null;

  const isDraft = product.status === "draft";
  const subtitle = composeProductSubtitle(productType, specs);
  const releasePattern = (product as { release_pattern?: string | null }).release_pattern ?? null;
  const knownReleaseLabels = collectKnownReleaseLabels(
    specs,
    groupVoice.takes.map((take) => take.release_label),
  );
  const isBaseline = groupVoice.tag_cloud.length === 0 && wheelVector != null;
  const reviewCount = reviewCountResult.count ?? 0;
  const needsEnrichment = productNeedsCatalogEnrichment({
    productType,
    source: product.source,
    specs,
    reviewCount,
    hasWheelVector: wheelVector != null && Object.keys(wheelVector).length > 0,
  });

  return (
    <AppShell>
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
          <Link
            href={`/makers/${makerSlug(product.brand)}`}
            className="block py-1 text-[11px] uppercase tracking-widest text-foreground-subtle mb-2 hover:text-foreground transition-colors"
          >
            {product.brand}
          </Link>
        ) : null}
        <div className="flex items-start gap-3">
          <h1 className="text-[28px] leading-[1.1] tracking-tight">{product.name}</h1>
          {canEdit ? (
            <Link
              href={`/products/${product.id}/edit`}
              className="shrink-0 mt-1 text-foreground-muted hover:text-foreground transition-colors"
              aria-label="Edit product"
            >
              <PenLine className="w-4 h-4" />
            </Link>
          ) : null}
        </div>
        {specs.club_staple === true ? (
          <p className="text-[11px] uppercase tracking-widest text-moss-500 mt-2">Club staple</p>
        ) : null}
        {subtitle ? <p className="text-sm text-foreground-muted mt-2">{subtitle}</p> : null}
        {productType === "bourbon" && knownReleaseLabels.length > 0 ? (
          <ReleaseVariantChips
            labels={knownReleaseLabels}
            releasePattern={releasePattern}
            className="mt-3"
          />
        ) : null}
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
          releasePattern={(product as { release_pattern?: string | null }).release_pattern ?? null}
          releaseLabel={release_label ?? null}
          eventId={event ?? null}
          justCaptured={Boolean(just_captured)}
        />
      ) : just_captured ? (
        <CaptureConfirmBanner
          productId={product.id}
          productType={productType}
          productName={product.name}
          brand={product.brand ?? null}
          releasePattern={releasePattern}
          releaseLabel={release_label ?? null}
          eventId={event ?? null}
          knownReleaseLabels={knownReleaseLabels}
        />
      ) : null}

      {needsEnrichment ? (
        <EnrichmentTrigger productId={product.id} productType={productType} needsEnrichment />
      ) : null}

      <Suspense fallback={<WinstonSkeleton />}>
        <WinstonSection
          productId={product.id}
          productType={productType}
          productName={product.name}
          brand={product.brand ?? null}
          specs={specs}
          wheelVector={wheelVector}
          groupVoice={groupVoice}
          adjacent={adjacent}
          userId={userId}
        />
      </Suspense>
      {isAdmin ? <RerollWinstonButton productId={product.id} /> : null}

      <div className="mt-6">
        <Divider label="The club says" />
        <ClubVoice
          productType={productType}
          groupVoice={groupVoice}
          otherTakes={otherTakes}
          myTake={myTake}
        />
      </div>

      {userId ? (
        <div className="mt-6">
          <TastingActionSegment productId={product.id} hasTasting={Boolean(myTake)} event={event} />
        </div>
      ) : null}

      {suggestions ? (
        <WinstonSuggests
          sourceType={productType}
          suggestions={suggestions}
          justCaptured={Boolean(just_captured)}
          productOnShelf={productOnShelf}
        />
      ) : null}

      <div className="mt-8" id="depth">
        <ProductDepthSection
          productType={productType}
          productName={product.name}
          specs={specs}
          tagCloud={groupVoice.tag_cloud}
          wheelVector={wheelVector}
          isBaseline={isBaseline}
        />
      </div>

      {productType === "cigar" ? (
        <div className="mt-6">
          <ExploreLinks brand={product.brand ?? null} name={product.name} />
        </div>
      ) : null}
    </AppShell>
  );
}

type WinstonSectionProps = {
  productId: string;
  productType: ProductType;
  productName: string;
  brand: string | null;
  specs: Record<string, unknown>;
  wheelVector: WheelVector | null;
  groupVoice: GroupVoice;
  adjacent: AdjacentProduct[];
  userId: string | null;
};

async function WinstonSection({
  productId,
  productType,
  productName,
  brand,
  specs,
  wheelVector,
  groupVoice,
  adjacent,
  userId,
}: WinstonSectionProps) {
  const supabase = await createSupabaseServerClient();
  const text = await ensureWinstonProse(
    supabase,
    {
      id: productId,
      type: productType,
      name: productName,
      brand,
      specs,
      wheel_vector: wheelVector,
    },
    groupVoice,
    adjacent,
    userId,
  );
  if (!text) return null;
  return (
    <>
      <Divider label="Winston's take" />
      <WinstonTastingNote text={text} />
    </>
  );
}

function WinstonSkeleton() {
  return (
    <>
      <Divider label="Winston's take" />
      <Card className="px-5 py-5">
        <div className="space-y-2.5 animate-pulse">
          <div className="h-[17px] bg-surface-2 rounded w-full" />
          <div className="h-[17px] bg-surface-2 rounded w-11/12" />
          <div className="h-[17px] bg-surface-2 rounded w-9/12" />
        </div>
      </Card>
    </>
  );
}
