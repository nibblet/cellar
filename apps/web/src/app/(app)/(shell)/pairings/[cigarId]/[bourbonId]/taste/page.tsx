import Link from "next/link";
import { notFound } from "next/navigation";
import { AppShell } from "@/components/layout/app-shell";
import { PairingTasteFormCollapsed } from "@/components/pairing/pairing-taste-form-collapsed";
import { Voice } from "@/components/primitives";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { collectKnownReleaseLabels } from "@/lib/tasting/known-release-labels";
type Params = Promise<{ cigarId: string; bourbonId: string }>;

/**
 * "Tasted this pairing" from pair detail — catalog IDs known; photo + collapsed taste.
 */
export default async function PairingTastePage({ params }: { params: Params }) {
  const { cigarId, bourbonId } = await params;
  const supabase = await createSupabaseServerClient();

  const { data: products } = await supabase
    .from("products")
    .select("id, type, name, brand, release_pattern, specs")
    .in("id", [cigarId, bourbonId]);

  const cigar = products?.find((p) => p.id === cigarId && p.type === "cigar");
  const bourbon = products?.find((p) => p.id === bourbonId && p.type === "bourbon");
  if (!cigar || !bourbon) notFound();

  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) notFound();

  const { data: bourbonReleaseRows } = await supabase
    .from("tastings")
    .select("release_label")
    .eq("product_id", bourbonId)
    .not("release_label", "is", null);

  const bourbonKnownReleaseLabels = collectKnownReleaseLabels(
    (bourbon.specs ?? {}) as Record<string, unknown>,
    (bourbonReleaseRows ?? []).map((row) => row.release_label),
  );

  const { data: events } = await supabase
    .from("events")
    .select("id, name, date")
    .order("date", { ascending: false })
    .limit(6);

  return (
    <AppShell spacious>
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

      <Voice className="mb-6">"One photo of the pair — then tell us how it sat."</Voice>

      <PairingTasteFormCollapsed
        cigar={{ id: cigar.id, name: cigar.name, brand: cigar.brand }}
        bourbon={{ id: bourbon.id, name: bourbon.name, brand: bourbon.brand }}
        recentEvents={(events ?? []) as Array<{ id: string; name: string; date: string }>}
        bourbonReleasePattern={bourbon.release_pattern ?? null}
        bourbonKnownReleaseLabels={bourbonKnownReleaseLabels}
        requirePhotoUpload
      />
    </AppShell>
  );
}
