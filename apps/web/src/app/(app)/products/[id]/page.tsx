import Link from "next/link";
import { notFound } from "next/navigation";
import { PhotoFrame, PhotoPlaceholder } from "@/components/feed";
import { MemberTakes, RecommendBar, TagCloud } from "@/components/group-voice";
import { PairsWith } from "@/components/pairing";
import { Button, Card, Divider, Voice } from "@/components/primitives";
import { ConstructionPanel, DepthAffordance, FactsStrip } from "@/components/product";
import { loadGroupVoice } from "@/lib/aggregation/group-voice";
import { loadOrComputeTopPairings } from "@/lib/pairing/engine";
import { checkGroupValidation } from "@/lib/pairing/group-validation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { ProductType } from "@/lib/wheel";

type Params = Promise<{ id: string }>;
type SearchParams = Promise<{
  just_captured?: string;
  just_saved?: string;
  event?: string;
}>;

// Keys we surfaced in the Construction panel — exclude from the dense
// Facts strip below so we don't repeat values.
const CIGAR_CONSTRUCTION_KEYS = [
  "wrapper",
  "wrapper_color",
  "binder",
  "filler",
  "country",
  "vitola",
  "strength",
];
const BOURBON_CONSTRUCTION_KEYS = [
  "distillery",
  "mash_bill",
  "proof",
  "abv",
  "age_years",
  "age_label",
  "style_family",
  "dsp",
];

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
    .select("id, type, name, brand, specs, status, created_at")
    .eq("id", id)
    .maybeSingle();

  if (error || !product) notFound();

  const productType = product.type as ProductType;

  const { data: auth } = await supabase.auth.getUser();
  const userId = auth.user?.id ?? null;

  const groupVoice = await loadGroupVoice(supabase, id, productType);
  const myTake = userId ? groupVoice.takes.find((t) => t.user_id === userId) : undefined;
  const otherTakes = groupVoice.takes.filter((t) => t.user_id !== userId);

  const pairings = await loadOrComputeTopPairings(supabase, id, { limit: 3 });
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

  // Hero image + the member who first contributed it (for the overlay).
  const { data: images } = await supabase
    .from("product_images")
    .select(
      "image_url, is_hero, contributed_by, contributor:users!product_images_contributed_by_fkey(name_first, name_last_initial)",
    )
    .eq("product_id", id)
    .order("is_hero", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(1);

  type HeroRow = {
    image_url: string;
    is_hero: boolean;
    contributed_by: string | null;
    contributor: { name_first: string; name_last_initial: string } | null;
  };
  const hero = (images as unknown as HeroRow[] | null)?.[0] ?? null;
  const heroSignedUrl = hero?.image_url ? await signImage(supabase, hero.image_url) : null;
  const contributorName = hero?.contributor
    ? `${hero.contributor.name_first} ${hero.contributor.name_last_initial}`
    : null;

  const isDraft = product.status === "draft";

  // Pick a top descriptor for the Bartender intro line. Falls back to a
  // generic line when the cloud is empty.
  const topTag = groupVoice.tag_cloud[0]?.label ?? null;
  const bartenderIntro = composeIntro({
    memberCount: groupVoice.member_count,
    recommendCount: groupVoice.recommend_count,
    topTag,
  });

  return (
    <main className="mx-auto max-w-md px-5 py-6 pb-24 flex-1">
      {just_saved ? (
        <Voice className="text-center mb-4">"Noted. Thank you, sir."</Voice>
      ) : just_captured ? (
        <Voice className="text-center mb-4">"Here we are. A fine choice."</Voice>
      ) : null}

      {/* Hero photo — inherits the photo-as-card primitive from Feed.
          Member-who-first-captured overlay bottom-left + ember-aware corner. */}
      <div className="relative aspect-[4/5] rounded-[16px] border border-border overflow-hidden mb-5">
        {heroSignedUrl ? (
          <PhotoFrame src={heroSignedUrl} alt={product.name}>
            <HeroOverlay contributorName={contributorName} />
          </PhotoFrame>
        ) : (
          <PhotoPlaceholder productType={productType}>
            <HeroOverlay contributorName={contributorName} />
          </PhotoPlaceholder>
        )}
      </div>

      {/* Product header */}
      <h1 className="text-3xl mb-1">{product.name}</h1>
      {product.brand ? <p className="text-base text-foreground-muted">{product.brand}</p> : null}
      <p className="text-[11px] uppercase tracking-widest text-foreground-subtle mt-1">
        {productType}
      </p>

      {/* Bartender intro line */}
      <Voice className="block mt-4">{bartenderIntro}</Voice>

      {isDraft ? (
        <Card className="mt-6 border border-ember-500">
          <p className="text-sm text-foreground-muted">
            <span className="text-ember-500 font-medium">Draft.</span> The Bartender wasn't certain
            — confirm or edit the details below.
          </p>
        </Card>
      ) : null}

      <Divider label="The club says" />

      <Card>
        <RecommendBar
          productType={productType}
          recommendCount={groupVoice.recommend_count}
          memberCount={groupVoice.member_count}
        />
      </Card>

      {otherTakes.length > 0 ? (
        <Card className="mt-4">
          <MemberTakes takes={otherTakes} />
        </Card>
      ) : null}

      {myTake ? (
        <Card className="mt-4">
          <p className="text-sm text-foreground-subtle uppercase tracking-widest mb-2">
            Your tasting
          </p>
          <p className="text-base mb-2">
            <span className={myTake.recommend ? "text-ember-500" : "text-foreground-subtle"}>
              ●
            </span>{" "}
            {myTake.recommend ? "You recommend this." : "You passed on this."}
          </p>
          {myTake.chips.length > 0 ? (
            <div className="flex flex-wrap gap-1.5 mb-2">
              {myTake.chips.map((c: string) => (
                <span
                  key={c}
                  className="px-2 py-0.5 rounded-full bg-accent-tint text-xs text-foreground border border-accent"
                >
                  {c}
                </span>
              ))}
            </div>
          ) : null}
          {myTake.note ? <p className="text-sm text-foreground italic">"{myTake.note}"</p> : null}
        </Card>
      ) : null}

      <div className="mt-6 flex flex-col gap-3">
        <Link
          href={`/products/${product.id}/recommend${event ? `?event=${encodeURIComponent(event)}` : ""}`}
        >
          <Button size="large" className="w-full">
            {myTake ? "Edit your tasting" : "Recommend to NCCC"}
          </Button>
        </Link>
        <Link href={`/products/${product.id}/edit`}>
          <Button variant="ghost" className="w-full">
            Not quite right? Edit
          </Button>
        </Link>
      </div>

      <Divider label="How it tastes" />

      <Card className="py-6">
        <TagCloud entries={groupVoice.tag_cloud} />
      </Card>

      <DepthAffordance />

      <Divider label="Pairs with" />

      <PairsWith
        sourceType={productType}
        sourceId={id}
        candidates={pairings}
        validatedPairs={validatedPairs}
      />

      <Divider label="Construction" />

      <ConstructionPanel productType={productType} specs={product.specs} />

      <Divider label="The facts" />

      <FactsStrip
        productType={productType}
        specs={product.specs}
        excludeKeys={productType === "cigar" ? CIGAR_CONSTRUCTION_KEYS : BOURBON_CONSTRUCTION_KEYS}
      />
    </main>
  );
}

/**
 * Bottom-left overlay on the hero — credits whoever first contributed the
 * photo. Same scrim treatment as the Feed cards for consistency.
 */
function HeroOverlay({ contributorName }: { contributorName: string | null }) {
  if (!contributorName) return null;
  return (
    <div className="absolute inset-x-0 bottom-0 p-3 pt-10 bg-gradient-to-t from-ink-900/65 via-ink-900/30 to-transparent">
      <p className="font-display italic text-sm text-paper-50 drop-shadow-md">
        photographed by {contributorName}
      </p>
    </div>
  );
}

function composeIntro({
  memberCount,
  recommendCount,
  topTag,
}: {
  memberCount: number;
  recommendCount: number;
  topTag: string | null;
}): string {
  if (memberCount === 0) {
    return "“No one's lit one up yet. Be the first, sir.”";
  }
  if (topTag && memberCount >= 3) {
    return `“${memberCount} of us have had it. ${recommendCount} would do it again — ${topTag} keeps coming up.”`;
  }
  if (topTag) {
    return `“${memberCount} ${memberCount === 1 ? "tasting" : "tastings"} so far. ${topTag} on the palate.”`;
  }
  if (recommendCount > 0) {
    return `“${recommendCount} of ${memberCount} would recommend. Worth a try.”`;
  }
  return `“${memberCount} ${memberCount === 1 ? "member has" : "members have"} weighed in.”`;
}

async function signImage(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  path: string,
): Promise<string | null> {
  const { data } = await supabase.storage.from("product-photos").createSignedUrl(path, 3600);
  return data?.signedUrl ?? null;
}
