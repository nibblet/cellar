import Link from "next/link";
import { Winston } from "@/components/brand";
import { AppShell } from "@/components/layout/app-shell";
import {
  Button,
  Card,
  Divider,
  interactiveCardClassName,
  Voice,
  validatedCardClassName,
} from "@/components/primitives";
import { loadOrComputeTopPairings, type PairingCandidate } from "@/lib/pairing/engine";
import { loadCachedPairingProse } from "@/lib/pairing/prose-cache";
import { pairingTierLabel } from "@/lib/pairing/tier";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { cn } from "@/lib/utils";
import type { ProductType } from "@/lib/wheel";

type TastingRow = {
  product_id: string;
  product: {
    id: string;
    name: string;
    brand: string | null;
    type: ProductType;
  } | null;
};

type ValidatedCacheRow = {
  cigar_id: string;
  bourbon_id: string;
  score: number;
  rationale_text: string | null;
  cigar: { name: string; brand: string | null } | null;
  bourbon: { name: string; brand: string | null } | null;
};

type RecommendationEntry = {
  source: { id: string; name: string; brand: string | null; type: ProductType };
  candidate: PairingCandidate;
  cached_prose: string | null;
};

export default async function PairingsIndexPage() {
  const supabase = await createSupabaseServerClient();
  const { data: auth } = await supabase.auth.getUser();
  const userId = auth.user?.id ?? null;

  // Find products the member has Recommended. For each, compute the top
  // pairing on the fly (also populates pairings_cache as a side effect).
  // This is the personalized "for you" surface — beats the prior cache-only
  // approach which only had data after someone had viewed a product page.
  const recommendations: RecommendationEntry[] = userId
    ? await loadRecommendations(supabase, userId)
    : [];

  // Knowing whether the member has *any* recommends lets us distinguish
  // "nothing on your shelf yet" from "you have a shelf but Winston
  // can't pair these products yet" (typically: source missing trait_vector).
  const recommendCount = userId
    ? ((
        await supabase
          .from("tastings")
          .select("id", { count: "exact", head: true })
          .eq("user_id", userId)
          .eq("recommend", true)
      ).count ?? 0)
    : 0;

  // Club-validated pairings from cache. These show up regardless of whose
  // tastings drove them — moss-marked, top of page when present.
  const { data: validatedRaw } = await supabase
    .from("pairings_cache")
    .select(
      "cigar_id, bourbon_id, score, rationale_text, cigar:cigar_id(name, brand), bourbon:bourbon_id(name, brand)",
    )
    .eq("is_group_validated", true)
    .order("score", { ascending: false })
    .limit(10);
  const validated = (validatedRaw as unknown as ValidatedCacheRow[] | null) ?? [];

  const hasContent = recommendations.length > 0 || validated.length > 0;
  const recommendedButNoPairs = !hasContent && recommendCount > 0;

  return (
    <AppShell>
      <header className="text-center mb-6 flex flex-col items-center">
        <Winston variant="bust" size={64} className="mb-2 rounded-full" />
        <h1 className="text-3xl">Pairings</h1>
        <p className="text-sm tracking-widest uppercase text-foreground-subtle mt-1">
          Winston's matches
        </p>
      </header>

      <Link href="/pairings/capture" className="block mb-6">
        <Button size="large" className="w-full">
          Capture a pairing
        </Button>
      </Link>

      {!hasContent ? (
        <Card className="text-center">
          {recommendedButNoPairs ? (
            <>
              <Voice className="block mb-3">
                "I've got the names but not the measure of these yet. A few
                more notes and the matches will come."
              </Voice>
              <Link href="/" className="text-sm text-accent hover:text-accent-hover underline">
                Back to the lounge →
              </Link>
            </>
          ) : (
            <>
              <Voice className="block mb-3">
                "Recommend a cigar or a pour first — I work from what you've actually tasted."
              </Voice>
              <Link
                href="/capture"
                className="text-sm text-accent hover:text-accent-hover underline"
              >
                Open the humidor →
              </Link>
            </>
          )}
        </Card>
      ) : (
        <>
          {validated.length > 0 ? (
            <>
              <Divider label="Club-validated" />
              <div className="flex flex-col gap-3">
                {validated.map((v) => (
                  <ValidatedCard key={`${v.cigar_id}:${v.bourbon_id}`} entry={v} />
                ))}
              </div>
            </>
          ) : null}

          {recommendations.length > 0 ? (
            <>
              <Divider label="From your tastings" />
              <div className="flex flex-col gap-4">
                {recommendations.map((r) => (
                  <RecommendationCard key={`${r.source.id}:${r.candidate.product_id}`} entry={r} />
                ))}
              </div>
            </>
          ) : null}
        </>
      )}

      <p className="mt-8 text-xs text-foreground-subtle text-center">
        Pairings sharpen as you and the club log more.
      </p>
    </AppShell>
  );
}

async function loadRecommendations(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  userId: string,
): Promise<RecommendationEntry[]> {
  const { data: tastingsRaw } = await supabase
    .from("tastings")
    .select("product_id, product:products(id, name, brand, type)")
    .eq("user_id", userId)
    .eq("recommend", true)
    .order("created_at", { ascending: false })
    .limit(12);

  const tastings = (tastingsRaw as unknown as TastingRow[] | null) ?? [];

  // Compute top pairing per recommended product. Sequential — for ~12 rows
  // the cumulative latency is well under 1s and we get cache writes for
  // free.
  const results: RecommendationEntry[] = [];
  for (const t of tastings) {
    if (!t.product) continue;
    const candidates = await loadOrComputeTopPairings(supabase, t.product_id, { limit: 1 });
    const top = candidates[0];
    if (!top) continue;
    const cigarId = t.product.type === "cigar" ? t.product.id : top.product_id;
    const bourbonId = t.product.type === "bourbon" ? t.product.id : top.product_id;
    const cached = await loadCachedPairingProse(supabase, cigarId, bourbonId);
    results.push({ source: t.product, candidate: top, cached_prose: cached?.notes ?? null });
  }
  return results;
}

function ValidatedCard({ entry }: { entry: ValidatedCacheRow }) {
  if (!entry.cigar || !entry.bourbon) return null;
  return (
    <Link href={`/pairings/${entry.cigar_id}/${entry.bourbon_id}`} className="block group">
      <div className={cn(validatedCardClassName, "px-4 py-4")}>
        <div className="flex items-baseline justify-between gap-3">
          <p className="text-[10px] uppercase tracking-widest text-moss-600">● club tried</p>
          <p className="text-[10px] uppercase tracking-widest text-foreground-subtle">
            {pairingTierLabel(entry.score)}
          </p>
        </div>
        <p className="text-base text-foreground mt-1 truncate group-hover:text-accent transition-colors">
          {entry.cigar.name}
        </p>
        <p className="text-[11px] tracking-widest uppercase text-foreground-subtle my-1.5">
          paired with
        </p>
        <p className="text-base text-foreground truncate group-hover:text-accent transition-colors">
          {entry.bourbon.name}
        </p>
        {entry.rationale_text ? (
          <p className="text-sm text-foreground-muted italic mt-2 line-clamp-2">
            "{entry.rationale_text}"
          </p>
        ) : null}
      </div>
    </Link>
  );
}

function RecommendationCard({ entry }: { entry: RecommendationEntry }) {
  const { source, candidate } = entry;
  // The pairing URL is always /pairings/<cigarId>/<bourbonId>; figure out
  // which side is the source.
  const cigarId = source.type === "cigar" ? source.id : candidate.product_id;
  const bourbonId = source.type === "bourbon" ? source.id : candidate.product_id;

  return (
    <div>
      <p className="text-[11px] uppercase tracking-widest text-foreground-subtle mb-1.5">
        You recommended <span className="text-foreground">{source.name}</span>
      </p>
      <Link href={`/pairings/${cigarId}/${bourbonId}`} className="block group">
        <div className={cn(interactiveCardClassName, "px-4 py-4")}>
          <div className="flex items-baseline justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[10px] uppercase tracking-widest text-foreground-subtle">
                Winston suggests
              </p>
              <p className="text-base text-foreground truncate mt-0.5 group-hover:text-accent transition-colors">
                {candidate.name}
              </p>
              {candidate.brand ? (
                <p className="text-xs text-foreground-muted truncate">{candidate.brand}</p>
              ) : null}
            </div>
            <p className="text-[10px] uppercase tracking-widest text-foreground-subtle shrink-0">
              {pairingTierLabel(candidate.score)}
            </p>
          </div>
          {(entry.cached_prose ?? candidate.reasons[0]?.reason) ? (
            <p className="text-sm text-foreground-muted italic mt-2 line-clamp-2">
              "{entry.cached_prose ?? candidate.reasons[0]?.reason}"
            </p>
          ) : null}
        </div>
      </Link>
    </div>
  );
}
