import { Voice } from "@/components/primitives";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { CaptureForm } from "./capture-form";

// Vision ID + storage upload only. Catalog enrichment runs separately via
// /api/enrich-draft so this stays under Vercel Hobby's 60s ceiling.
export const maxDuration = 60;

export default async function CapturePage() {
  const supabase = await createSupabaseServerClient();

  // Show up to 6 recent meetups in the optional event-tag picker. Members
  // mostly want "tonight's meetup" — anything older than a couple weeks
  // gets stale and we deliberately don't surface it.
  const { data: events } = await supabase
    .from("events")
    .select("id, name, date")
    .order("date", { ascending: false })
    .limit(6);

  return (
    <main className="mx-auto max-w-md px-5 py-8 pb-24 flex-1">
      <header className="text-center mb-6">
        <p className="text-sm tracking-widest uppercase text-foreground-subtle">Capture</p>
        <h1 className="text-3xl mt-1">What are you having?</h1>
      </header>

      <Voice className="text-center mb-8">"Hold the band steady, sir. I'll do the rest."</Voice>

      <CaptureForm
        recentEvents={(events ?? []) as Array<{ id: string; name: string; date: string }>}
      />
    </main>
  );
}
