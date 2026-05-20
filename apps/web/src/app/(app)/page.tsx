import Link from "next/link";
import { TastingCard } from "@/components/feed";
import { Button, Card, Divider, Voice } from "@/components/primitives";
import { loadFeed, signImagePaths } from "@/lib/feed/queries";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export default async function FeedPage() {
  const supabase = await createSupabaseServerClient();
  const entries = await loadFeed(supabase, { limit: 50 });
  const signed = await signImagePaths(
    supabase,
    entries.map((e) => e.hero_image_path),
  );

  return (
    <main className="mx-auto max-w-md px-5 py-6 pb-24 flex-1">
      <header className="text-center mb-6">
        <h1 className="text-3xl">NCCC</h1>
        <p className="text-sm tracking-widest uppercase text-foreground-subtle">Recent tastings</p>
      </header>

      {entries.length === 0 ? (
        <Card>
          <Voice className="block mb-3">"Nothing logged yet, sir. The night is young."</Voice>
          <Link href="/capture" className="block">
            <Button size="large" className="w-full">
              Open the humidor
            </Button>
          </Link>
        </Card>
      ) : (
        <>
          <div className="flex flex-col gap-3">
            {entries.map((entry) => (
              <TastingCard
                key={entry.tasting_id}
                entry={entry}
                signedHero={
                  entry.hero_image_path ? (signed.get(entry.hero_image_path) ?? null) : null
                }
              />
            ))}
          </div>
          <Divider label="That's all" />
          <p className="text-sm text-foreground-subtle text-center">
            Snap something to add to the archive.
          </p>
        </>
      )}
    </main>
  );
}
