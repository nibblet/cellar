import Link from "next/link";
import { notFound } from "next/navigation";
import { Button, Card, Divider, Voice } from "@/components/primitives";
import { fallbackProse, generatePairingProse } from "@/lib/openai/pairing-prose";
import { checkGroupValidation } from "@/lib/pairing/group-validation";
import { scorePair } from "@/lib/pairing/score";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { TraitVector } from "@/lib/wheel";

type Params = Promise<{ cigarId: string; bourbonId: string }>;

type ProductRow = {
  id: string;
  name: string;
  brand: string | null;
  type: "cigar" | "bourbon";
  trait_vector: TraitVector | null;
};

export default async function PairingPage({ params }: { params: Params }) {
  const { cigarId, bourbonId } = await params;
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

  const { score, reasons } = scorePair(cigar.trait_vector, bourbon.trait_vector);

  const validated = await checkGroupValidation(supabase, cigarId, bourbonId);

  // Load cached prose; generate if missing. LLM failures fall back to a
  // deterministic Bartender line composed from the rule reasons.
  const { data: cached } = await supabase
    .from("pairings_cache")
    .select("rationale_text")
    .eq("cigar_id", cigarId)
    .eq("bourbon_id", bourbonId)
    .maybeSingle();

  let prose: string;
  if (cached?.rationale_text) {
    prose = cached.rationale_text;
  } else {
    try {
      const { data: auth } = await supabase.auth.getUser();
      prose = await generatePairingProse({
        cigar: { name: cigar.name, brand: cigar.brand },
        bourbon: { name: bourbon.name, brand: bourbon.brand },
        reasons,
        score,
        supabase,
        userId: auth.user?.id ?? null,
      });
      // Best-effort cache. Don't block the response on the write.
      void supabase
        .from("pairings_cache")
        .upsert(
          { cigar_id: cigarId, bourbon_id: bourbonId, score, rationale_text: prose },
          { onConflict: "cigar_id,bourbon_id" },
        );
    } catch (err) {
      console.warn("[pairings] prose generation failed:", err);
      prose = fallbackProse({ reasons, score });
    }
  }

  return (
    <main className="mx-auto max-w-md px-5 py-6 pb-24 flex-1">
      <header className="mb-6">
        <p className="text-sm tracking-widest uppercase text-foreground-subtle">
          The Bartender suggests
        </p>
        <h1 className="text-3xl mt-1">{cigar.name}</h1>
        <p className="text-sm text-foreground-muted">with</p>
        <h2 className="text-2xl">{bourbon.name}</h2>
      </header>

      <Card>
        <p className="text-xs uppercase tracking-widest text-foreground-subtle mb-2">
          Why this pairing
        </p>
        <Voice className="block">"{prose}"</Voice>
      </Card>

      <Divider label="Club status" />

      {validated ? (
        <Card className="border border-moss-600">
          <p className="text-sm text-foreground">
            <span className="text-moss-600" aria-hidden="true">
              ●
            </span>{" "}
            <span className="font-medium">{validated.display_name}</span> paired this at{" "}
            <Link
              href={`/events/${validated.event_id}`}
              className="underline hover:text-foreground-muted"
            >
              {validated.event_name}
            </Link>{" "}
            and recommended it.
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

      <div className="mt-6 flex flex-col gap-3">
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
