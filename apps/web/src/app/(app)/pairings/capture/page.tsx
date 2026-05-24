import Link from "next/link";
import { redirect } from "next/navigation";
import { PairingCapturePicker } from "@/components/pairing/pairing-capture-picker";
import { Voice } from "@/components/primitives";
import { loadPickerProducts } from "@/lib/pairing/picker-products";
import { createSupabaseServerClient } from "@/lib/supabase/server";

type SearchParams = Promise<{ cigar?: string }>;

export default async function PairingCapturePage({ searchParams }: { searchParams: SearchParams }) {
  const { cigar: initialCigarId } = await searchParams;
  const supabase = await createSupabaseServerClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) redirect("/login");

  const [cigars, bourbons] = await Promise.all([
    loadPickerProducts(supabase, "cigar"),
    loadPickerProducts(supabase, "bourbon"),
  ]);

  return (
    <main className="mx-auto max-w-md px-5 py-6 pb-24 flex-1">
      <header className="mb-4">
        <Link href="/pairings" className="text-sm text-foreground-muted hover:text-foreground">
          ← Pairings
        </Link>
        <h1 className="text-3xl mt-3">Capture a pairing</h1>
        <p className="text-sm text-foreground-muted mt-1">
          Pick both from the catalog, then log them together.
        </p>
      </header>

      <Voice className="mb-4 block text-sm">
        "Name the cigar and the pour, sir — one photo will do for both."
      </Voice>

      <PairingCapturePicker cigars={cigars} bourbons={bourbons} initialCigarId={initialCigarId} />
    </main>
  );
}
