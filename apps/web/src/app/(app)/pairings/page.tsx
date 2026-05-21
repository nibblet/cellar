import Link from "next/link";
import { NCCCLogo } from "@/components/brand";
import { Card, Divider, Voice } from "@/components/primitives";
import { createSupabaseServerClient } from "@/lib/supabase/server";

type PairingRow = {
  cigar_id: string;
  bourbon_id: string;
  score: number;
  rationale_text: string | null;
  is_group_validated: boolean;
  cigar: { name: string; brand: string | null } | null;
  bourbon: { name: string; brand: string | null } | null;
};

export default async function PairingsIndexPage() {
  const supabase = await createSupabaseServerClient();

  // Pull the top cached pairings — group-validated first, then by score.
  // For v1 this is just the catalog-wide top hits; personalized "for you"
  // pairings ride on the Pairing Preferences work (Tier 2 #5).
  const { data: rawPairings } = await supabase
    .from("pairings_cache")
    .select(
      "cigar_id, bourbon_id, score, rationale_text, is_group_validated, cigar:cigar_id(name, brand), bourbon:bourbon_id(name, brand)",
    )
    .order("is_group_validated", { ascending: false })
    .order("score", { ascending: false })
    .limit(20);

  const pairings = (rawPairings as unknown as PairingRow[] | null) ?? [];
  const validated = pairings.filter((p) => p.is_group_validated);
  const suggested = pairings.filter((p) => !p.is_group_validated);

  return (
    <main className="mx-auto max-w-md px-5 py-6 pb-24 flex-1">
      <header className="text-center mb-6 flex flex-col items-center">
        <NCCCLogo variant="bust" size={56} className="mb-2" decorative />
        <h1 className="text-3xl">Pairings</h1>
        <p className="text-sm tracking-widest uppercase text-foreground-subtle mt-1">
          The Bartender's matches
        </p>
      </header>

      {pairings.length === 0 ? (
        <Card className="text-center">
          <Voice className="block mb-3">
            "Nothing in the rotation yet, sir. Recommend a cigar or pour first."
          </Voice>
        </Card>
      ) : (
        <>
          {validated.length > 0 ? (
            <>
              <Divider label="Club-validated" />
              <div className="flex flex-col gap-3">
                {validated.map((p) => (
                  <PairingRowCard key={`${p.cigar_id}:${p.bourbon_id}`} entry={p} />
                ))}
              </div>
            </>
          ) : null}

          {suggested.length > 0 ? (
            <>
              <Divider label="The Bartender suggests" />
              <div className="flex flex-col gap-3">
                {suggested.slice(0, 10).map((p) => (
                  <PairingRowCard key={`${p.cigar_id}:${p.bourbon_id}`} entry={p} />
                ))}
              </div>
            </>
          ) : null}
        </>
      )}

      <p className="mt-8 text-xs text-foreground-subtle text-center">
        Pairings update as members log tastings.
      </p>
    </main>
  );
}

function PairingRowCard({ entry }: { entry: PairingRow }) {
  if (!entry.cigar || !entry.bourbon) return null;

  return (
    <Link href={`/pairings/${entry.cigar_id}/${entry.bourbon_id}`} className="block">
      <Card
        className={
          entry.is_group_validated
            ? "border border-moss-600 hover:bg-surface-2 transition-colors"
            : "hover:bg-surface-2 transition-colors"
        }
      >
        <div className="flex items-baseline justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[11px] uppercase tracking-widest text-foreground-subtle">Cigar</p>
            <p className="text-base text-foreground truncate">{entry.cigar.name}</p>
            {entry.cigar.brand ? (
              <p className="text-xs text-foreground-muted truncate">{entry.cigar.brand}</p>
            ) : null}
          </div>
          {entry.is_group_validated ? (
            <span
              className="text-[10px] uppercase tracking-widest text-moss-600 shrink-0"
              title="The club has tasted this pairing"
            >
              ● club
            </span>
          ) : null}
        </div>

        <p className="my-2 text-[10px] uppercase tracking-[0.3em] text-foreground-subtle text-center">
          paired with
        </p>

        <div className="min-w-0">
          <p className="text-[11px] uppercase tracking-widest text-foreground-subtle">Bourbon</p>
          <p className="text-base text-foreground truncate">{entry.bourbon.name}</p>
          {entry.bourbon.brand ? (
            <p className="text-xs text-foreground-muted truncate">{entry.bourbon.brand}</p>
          ) : null}
        </div>

        {entry.rationale_text ? (
          <p className="mt-3 text-sm text-foreground-muted italic line-clamp-2">
            "{entry.rationale_text}"
          </p>
        ) : null}
      </Card>
    </Link>
  );
}
