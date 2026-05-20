import Link from "next/link";
import { Card, Divider } from "@/components/primitives";
import { createSupabaseServerClient } from "@/lib/supabase/server";

type EventRow = {
  id: string;
  name: string;
  date: string;
  host_user_id: string | null;
  notes: string | null;
};

export default async function EventsPage() {
  const supabase = await createSupabaseServerClient();

  const { data } = await supabase
    .from("events")
    .select("id, name, date, host_user_id, notes")
    .order("date", { ascending: false });

  const rows = (data ?? []) as EventRow[];

  // Tasting counts per event.
  const { data: tastings } = await supabase.from("tastings").select("event_id");
  const counts = new Map<string, number>();
  for (const row of (tastings ?? []) as Array<{ event_id: string | null }>) {
    if (!row.event_id) continue;
    counts.set(row.event_id, (counts.get(row.event_id) ?? 0) + 1);
  }

  return (
    <main className="mx-auto max-w-md px-5 py-6 pb-24 flex-1">
      <header className="mb-6">
        <p className="text-sm tracking-widest uppercase text-foreground-subtle">The Calendar</p>
        <h1 className="text-3xl mt-1">Meetups</h1>
      </header>

      {rows.length === 0 ? (
        <Card>
          <p className="text-sm text-foreground-subtle">
            No meetups recorded. Admins set them up in settings.
          </p>
        </Card>
      ) : (
        <ul className="flex flex-col gap-3">
          {rows.map((e) => {
            const tastingCount = counts.get(e.id) ?? 0;
            return (
              <li key={e.id}>
                <Link href={`/events/${e.id}`} className="block">
                  <Card className="hover:bg-surface-2 transition-colors">
                    <div className="flex items-baseline justify-between gap-3">
                      <h2 className="text-lg text-foreground">{e.name}</h2>
                      <time className="text-xs text-foreground-subtle tabular-nums">
                        {formatDate(e.date)}
                      </time>
                    </div>
                    <p className="text-xs text-foreground-muted mt-1">
                      {tastingCount} tasting{tastingCount === 1 ? "" : "s"}
                    </p>
                    {e.notes ? (
                      <p className="text-sm text-foreground-muted mt-1 line-clamp-2">{e.notes}</p>
                    ) : null}
                  </Card>
                </Link>
              </li>
            );
          })}
        </ul>
      )}

      <Divider label="" />
      <p className="text-sm text-foreground-subtle text-center">
        Tag a tasting to a meetup from the capture screen.
      </p>
    </main>
  );
}

function formatDate(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  } catch {
    return iso;
  }
}
