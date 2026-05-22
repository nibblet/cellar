import Link from "next/link";
import { notFound } from "next/navigation";
import { Voice } from "@/components/primitives";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getWheel } from "@/lib/wheel";
import { PairingTasteForm } from "./pairing-taste-form";

type Params = Promise<{ cigarId: string; bourbonId: string }>;

/**
 * "Tasted this pairing" capture flow. Skips vision identification — we
 * already know both products from the route. Member shoots one photo, scores
 * each half with chips + a recommend toggle, optionally writes a shared note
 * about how they worked together; submit creates two linked tastings.
 */
export default async function PairingTastePage({ params }: { params: Params }) {
  const { cigarId, bourbonId } = await params;
  const supabase = await createSupabaseServerClient();

  const { data: products } = await supabase
    .from("products")
    .select("id, type, name, brand")
    .in("id", [cigarId, bourbonId]);

  const cigar = products?.find((p) => p.id === cigarId && p.type === "cigar");
  const bourbon = products?.find((p) => p.id === bourbonId && p.type === "bourbon");
  if (!cigar || !bourbon) notFound();

  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) notFound();

  // If the member has already tasted either side, prefill that half so they
  // can revise rather than start over. We don't lock the form on existing
  // tastings — they're free to update either or both.
  const { data: existing } = await supabase
    .from("tastings")
    .select("product_id, recommend, chips, note")
    .eq("user_id", auth.user.id)
    .in("product_id", [cigarId, bourbonId]);

  const priorCigar = existing?.find((t) => t.product_id === cigarId) ?? null;
  const priorBourbon = existing?.find((t) => t.product_id === bourbonId) ?? null;

  const cigarLeafLabels = getWheel("cigar").leaves.map((l) => l.label);
  const bourbonLeafLabels = getWheel("bourbon").leaves.map((l) => l.label);

  return (
    <main className="mx-auto max-w-md px-5 py-8 pb-24 flex-1">
      <Link
        href={`/pairings/${cigarId}/${bourbonId}`}
        className="text-sm text-foreground-muted hover:text-foreground"
      >
        ← back
      </Link>

      <header className="mt-3 mb-6">
        <p className="text-sm tracking-widest uppercase text-foreground-subtle">
          Tasted this pairing
        </p>
        <h1 className="text-2xl mt-1">
          {cigar.name} <span className="text-foreground-muted">with</span> {bourbon.name}
        </h1>
      </header>

      <Voice className="mb-6">"One photo of the pair, sir — I'll log both."</Voice>

      <PairingTasteForm
        cigar={{ id: cigar.id, name: cigar.name, brand: cigar.brand }}
        bourbon={{ id: bourbon.id, name: bourbon.name, brand: bourbon.brand }}
        cigarLeafLabels={cigarLeafLabels}
        bourbonLeafLabels={bourbonLeafLabels}
        priorCigar={
          priorCigar
            ? { recommend: priorCigar.recommend, chips: priorCigar.chips, note: priorCigar.note }
            : null
        }
        priorBourbon={
          priorBourbon
            ? {
                recommend: priorBourbon.recommend,
                chips: priorBourbon.chips,
                note: priorBourbon.note,
              }
            : null
        }
      />
    </main>
  );
}
