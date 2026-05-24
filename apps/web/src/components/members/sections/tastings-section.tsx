import { TastingCard } from "@/components/feed";
import { Card, Divider } from "@/components/primitives";
import { loadFeed, signImagePaths } from "@/lib/feed/queries";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function TastingsSection({
  memberId,
  displayName,
}: {
  memberId: string;
  displayName: string;
}) {
  const supabase = await createSupabaseServerClient();
  const entries = await loadFeed(supabase, { userId: memberId, limit: 100 });
  const signed = await signImagePaths(
    supabase,
    entries.map((e) => e.hero_image_path),
  );

  const total = entries.length;
  const recommended = entries.filter((e) => e.recommend).length;

  return (
    <>
      <p className="text-sm text-foreground-muted mb-4">
        {total} tasting{total === 1 ? "" : "s"}
        {recommended > 0 ? ` · ${recommended} recommended` : ""}
      </p>

      <Divider label="The archive" />

      {entries.length === 0 ? (
        <Card>
          <p className="text-sm text-foreground-subtle">
            {displayName} hasn't logged a tasting yet.
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
    </>
  );
}
