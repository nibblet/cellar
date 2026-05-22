import Link from "next/link";
import { notFound } from "next/navigation";
import { NCCCLogo } from "@/components/brand";
import { Button, Card, Divider, Voice } from "@/components/primitives";
import { suggestPairings } from "@/lib/pairing/engine";
import { checkGroupValidation } from "@/lib/pairing/group-validation";
import { ensurePairingProse } from "@/lib/pairing/prose-cache";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { TraitVector } from "@/lib/wheel";

type Params = Promise<{ cigarId: string; bourbonId: string }>;
type SearchParams = Promise<{ just_tasted?: string }>;

type ProductRow = {
  id: string;
  name: string;
  brand: string | null;
  type: "cigar" | "bourbon";
  trait_vector: TraitVector | null;
};

export default async function PairingPage({
  params,
  searchParams,
}: {
  params: Params;
  searchParams: SearchParams;
}) {
  const { cigarId, bourbonId } = await params;
  const { just_tasted } = await searchParams;
  const supabase = await createSupabaseServerClient();

  const { data: products } = await supabase
    .from("products")
    .select("id, name, brand, type, trait_vector")
    .in("id", [cigarId, bourbonId]);

  const cigar = (products as ProductRow[] | null)?.find((p) => p.id === cigarId) ?? null;
  const bourbon = (products as ProductRow[] | null)?.find((p) => p.id === bourbonId) ?? null;
  if (!cigar || !bourbon) notFound();
  if (cigar.type !== "cigar" || bourbon.type !== "bourbon") notFound();
  if (!cigar.trait_vector || !bourbon.trait_vector) notFound();

  // Load the structured prose + club validation + alternative bourbons for
  // this cigar in parallel. Alternatives query is bounded to a few rows.
  const [validated, prose, alternatives] = await Promise.all([
    checkGroupValidation(supabase, cigarId, bourbonId),
    ensurePairingProse(supabase, cigarId, bourbonId),
    suggestPairings(supabase, cigarId, { limit: 4, minScore: 55 }),
  ]);

  // Drop the current bourbon from the alternatives list; trim to 3 entries.
  const otherMatches = alternatives.filter((a) => a.product_id !== bourbonId).slice(0, 3);

  return (
    <main className="mx-auto max-w-md px-5 py-6 pb-24 flex-1">
      {just_tasted ? (
        <div className="mb-4 flex items-center gap-2 text-[11px] uppercase tracking-widest text-foreground-subtle">
          <span className="block w-1.5 h-1.5 rounded-full bg-ember-500" aria-hidden="true" />
          Pairing saved
        </div>
      ) : null}

      <header className="mb-6 flex flex-col items-center text-center">
        <NCCCLogo variant="bust" size={64} className="mb-3" decorative />
        <p className="text-sm tracking-widest uppercase text-foreground-subtle">
          The Bartender suggests
        </p>
        <h1 className="text-3xl mt-1">{cigar.name}</h1>
        <p className="text-sm text-foreground-muted">with</p>
        <h2 className="text-2xl">{bourbon.name}</h2>
      </header>

      <Divider label="Pairing notes" />

      <Card>
        <Voice className="block">"{prose.notes}"</Voice>
      </Card>

      {prose.why_bullets.length > 0 ? (
        <>
          <Divider label="Why it works" />
          <ul className="space-y-2 list-none">
            {prose.why_bullets.map((bullet) => (
              <li key={bullet} className="flex gap-3 text-sm text-foreground leading-relaxed">
                <span
                  className="text-foreground-subtle pt-1.5 shrink-0"
                  aria-hidden="true"
                >
                  ●
                </span>
                <span>{bullet}</span>
              </li>
            ))}
          </ul>
        </>
      ) : null}

      <Divider label="Club status" />

      {validated ? (
        <Card className="border border-moss-600">
          <p className="text-sm text-foreground">
            <span className="text-moss-600" aria-hidden="true">
              ●
            </span>{" "}
            <span className="font-medium">{validated.display_name}</span> paired this at{" "}
            <span className="font-medium">{validated.event_name}</span> and recommended it.
          </p>
        </Card>
      ) : (
        <Card>
          <p className="text-sm text-foreground-muted">
            ⊘ The club hasn't tested this combination yet.
          </p>
          <p className="text-sm text-foreground-subtle mt-1">Try it and tell us how it went.</p>
        </Card>
      )}

      {otherMatches.length > 0 ? (
        <>
          <Divider label="Alternatives" />
          <p className="text-xs text-foreground-subtle mb-3">
            Other bourbons that work with {cigar.name}.
          </p>
          <ul className="space-y-2">
            {otherMatches.map((alt) => (
              <li key={alt.product_id}>
                <Link
                  href={`/pairings/${cigar.id}/${alt.product_id}`}
                  className="block rounded-[12px] border border-border bg-surface px-3.5 py-3 hover:bg-surface-2 transition-colors"
                >
                  <p className="text-sm text-foreground truncate">{alt.name}</p>
                  <p className="text-[11px] text-foreground-muted truncate mt-0.5">
                    {alt.brand ? `${alt.brand} · ` : ""}
                    <span className="uppercase tracking-widest text-foreground-subtle">
                      {Math.round(alt.score)}/100
                    </span>
                  </p>
                </Link>
              </li>
            ))}
          </ul>
        </>
      ) : null}

      <div className="mt-6 flex flex-col gap-3">
        <Link href={`/pairings/${cigar.id}/${bourbon.id}/taste`}>
          <Button size="large" className="w-full">
            Tasted this pairing
          </Button>
        </Link>
        <Link href={`/products/${cigar.id}`}>
          <Button size="large" variant="ghost" className="w-full">
            View {cigar.name}
          </Button>
        </Link>
        <Link href={`/products/${bourbon.id}`}>
          <Button size="large" variant="ghost" className="w-full">
            View {bourbon.name}
          </Button>
        </Link>
      </div>
    </main>
  );
}
