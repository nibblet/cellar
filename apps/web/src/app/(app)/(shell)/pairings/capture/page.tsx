import Link from "next/link";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/layout/app-shell";
import { PairingCaptureFlow } from "@/components/pairing/pairing-capture-flow";
import { Voice } from "@/components/primitives";
import { PERSONAL_PAIRINGS_PATH } from "@/lib/navigation/paths";
import { loadPickerProductById } from "@/lib/pairing/picker-products";
import { createSupabaseServerClient } from "@/lib/supabase/server";
export const maxDuration = 60;

type SearchParams = Promise<{ cigar?: string }>;

export default async function PairingCapturePage({ searchParams }: { searchParams: SearchParams }) {
  const { cigar: initialCigarId } = await searchParams;
  const supabase = await createSupabaseServerClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) redirect("/login");

  const initialCigar = initialCigarId
    ? await loadPickerProductById(supabase, initialCigarId)
    : null;

  const { data: events } = await supabase
    .from("events")
    .select("id, name, date")
    .order("date", { ascending: false })
    .limit(6);

  return (
    <AppShell spacious>
      <header className="mb-4">
        <Link
          href={PERSONAL_PAIRINGS_PATH}
          className="text-sm text-foreground-muted hover:text-foreground"
        >
          ← Your pairings
        </Link>
        <h1 className="text-3xl mt-3">Capture a pairing</h1>
        <p className="text-sm text-foreground-muted mt-1">
          One photo of cigar and pour — we&apos;ll name both.
        </p>
      </header>

      <Voice className="mb-4 block text-sm">
        "One photo of the pair — I'll name the cigar and the pour."
      </Voice>

      <PairingCaptureFlow
        recentEvents={(events ?? []) as Array<{ id: string; name: string; date: string }>}
        bourbonReleasePattern={null}
        bourbonKnownReleaseLabels={[]}
        initialCigar={initialCigar}
      />
    </AppShell>
  );
}
