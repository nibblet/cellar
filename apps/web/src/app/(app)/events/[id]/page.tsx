import Link from "next/link";
import { notFound } from "next/navigation";
import { TastingCard } from "@/components/feed";
import { Button, Card, Divider, Voice } from "@/components/primitives";
import { loadFeed, signImagePaths } from "@/lib/feed/queries";
import { formatMemberName, type MemberNameFields } from "@/lib/identity";
import { createSupabaseServerClient } from "@/lib/supabase/server";

type Params = Promise<{ id: string }>;

export default async function EventDetailPage({ params }: { params: Params }) {
  const { id } = await params;
  const supabase = await createSupabaseServerClient();

  const { data: event } = await supabase
    .from("events")
    .select("id, name, date, host_user_id, notes")
    .eq("id", id)
    .maybeSingle();
  if (!event) notFound();

  const eventRow = event as {
    id: string;
    name: string;
    date: string;
    host_user_id: string | null;
    notes: string | null;
  };

  const { data: host } = eventRow.host_user_id
    ? await supabase
        .from("users")
        .select("name_first, name_last_initial")
        .eq("id", eventRow.host_user_id)
        .maybeSingle()
    : { data: null };

  const entries = await loadFeed(supabase, { eventId: id, limit: 200 });
  const signed = await signImagePaths(
    supabase,
    entries.map((e) => e.hero_image_path),
  );

  const memberCount = new Set(entries.map((e) => e.user_id)).size;
  const recommendedCount = entries.filter((e) => e.recommend).length;

  return (
    <main className="mx-auto max-w-md px-5 py-6 pb-24 flex-1">
      <header className="mb-6">
        <p className="text-sm tracking-widest uppercase text-foreground-subtle">Meetup</p>
        <h1 className="text-3xl mt-1">{eventRow.name}</h1>
        <p className="text-sm text-foreground-muted mt-1">
          {new Date(eventRow.date).toLocaleDateString("en-US", {
            weekday: "long",
            month: "long",
            day: "numeric",
            year: "numeric",
          })}
        </p>
        {host ? (
          <p className="text-sm text-foreground-muted">
            Hosted by {formatMemberName(host as MemberNameFields)}
          </p>
        ) : null}
        <p className="text-sm text-foreground mt-3">
          {entries.length} tasting{entries.length === 1 ? "" : "s"} · {memberCount} member
          {memberCount === 1 ? "" : "s"} · {recommendedCount} recommended
        </p>
        {eventRow.notes ? <Voice className="block mt-4">"{eventRow.notes}"</Voice> : null}
      </header>

      {entries.length > 0 ? (
        <Link href={`/events/${eventRow.id}/recap`} className="block mb-2">
          <Button variant="ghost" className="w-full">
            View the night's recap →
          </Button>
        </Link>
      ) : null}

      <Divider label="That night's archive" />

      {entries.length === 0 ? (
        <Card>
          <p className="text-sm text-foreground-subtle">Nothing logged for this meetup yet.</p>
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
