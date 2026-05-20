import { notFound } from "next/navigation";
import { TastingCard } from "@/components/feed";
import { Card, Divider } from "@/components/primitives";
import { loadFeed, signImagePaths } from "@/lib/feed/queries";
import { formatMemberName, type MemberNameFields } from "@/lib/identity";
import { createSupabaseServerClient } from "@/lib/supabase/server";

type Params = Promise<{ id: string }>;

export default async function MemberProfilePage({ params }: { params: Params }) {
  const { id } = await params;
  const supabase = await createSupabaseServerClient();

  const { data: member } = await supabase
    .from("users")
    .select("id, name_first, name_last_initial, joined_at")
    .eq("id", id)
    .maybeSingle();
  if (!member) notFound();

  const profile = member as MemberNameFields & { id: string; joined_at: string };

  const entries = await loadFeed(supabase, { userId: id, limit: 100 });
  const signed = await signImagePaths(
    supabase,
    entries.map((e) => e.hero_image_path),
  );

  const total = entries.length;
  const recommended = entries.filter((e) => e.recommend).length;

  return (
    <main className="mx-auto max-w-md px-5 py-6 pb-24 flex-1">
      <header className="mb-6">
        <p className="text-sm tracking-widest uppercase text-foreground-subtle">Member</p>
        <h1 className="text-3xl mt-1">{formatMemberName(profile)}</h1>
        <p className="text-sm text-foreground-muted mt-1">
          {total} tasting{total === 1 ? "" : "s"}
          {recommended > 0 ? ` · ${recommended} recommended` : ""}
        </p>
      </header>

      <Divider label="Their archive" />

      {entries.length === 0 ? (
        <Card>
          <p className="text-sm text-foreground-subtle">
            {formatMemberName(profile)} hasn't logged a tasting yet.
          </p>
        </Card>
      ) : (
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
      )}
    </main>
  );
}
