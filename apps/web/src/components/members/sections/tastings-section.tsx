import { PairingFeedCard, TastingCard } from "@/components/feed";
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

  const tastingCount = entries.reduce(
    (n, e) => n + (e.kind === "pairing" ? 2 : 1),
    0,
  );
  const recommended = entries.filter((e) => e.recommend).length;

  return (
    <>
      <p className="text-sm text-foreground-muted mb-4">
        {tastingCount} tasting{tastingCount === 1 ? "" : "s"}
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
          {entries.map((entry) =>
            entry.kind === "pairing" ? (
              <PairingFeedCard
                key={entry.pairing_session_id}
                entry={entry}
                signedHero={
                  entry.hero_image_path ? (signed.get(entry.hero_image_path) ?? null) : null
                }
              />
            ) : (
              <TastingCard
                key={entry.tasting_id}
                entry={entry}
                signedHero={
                  entry.hero_image_path ? (signed.get(entry.hero_image_path) ?? null) : null
                }
              />
            ),
          )}
        </div>
      )}
    </>
  );
}
