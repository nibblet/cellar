import Link from "next/link";
import { notFound } from "next/navigation";
import { NCCCLogo } from "@/components/brand";
import { Divider, Voice } from "@/components/primitives";
import { loadFeed } from "@/lib/feed/queries";
import { formatMemberName, type MemberNameFields } from "@/lib/identity";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { ProductType } from "@/lib/wheel";

type Params = Promise<{ id: string }>;

type EventRow = {
  id: string;
  name: string;
  date: string;
  host_user_id: string | null;
  notes: string | null;
};

/**
 * Screenshot-friendly recap of a meetup. Tells the night's story in a
 * single self-contained card: NCCC mark, date, stats, top picks, the
 * Bartender's line. Designed so a member can scroll to it and grab a
 * clean screenshot for the club thread.
 */
export default async function EventRecapPage({ params }: { params: Params }) {
  const { id } = await params;
  const supabase = await createSupabaseServerClient();

  const { data: rawEvent } = await supabase
    .from("events")
    .select("id, name, date, host_user_id, notes")
    .eq("id", id)
    .maybeSingle();
  if (!rawEvent) notFound();
  const event = rawEvent as EventRow;

  const { data: host } = event.host_user_id
    ? await supabase
        .from("users")
        .select("name_first, name_last_initial")
        .eq("id", event.host_user_id)
        .maybeSingle()
    : { data: null };

  const entries = await loadFeed(supabase, { eventId: id, limit: 200 });

  // Aggregate the night.
  const memberSet = new Set(entries.map((e) => e.user_id));
  const recommendCount = entries.filter((e) => e.recommend).length;
  const topProductByType: Record<
    ProductType,
    { id: string; name: string; brand: string | null; votes: number } | null
  > = {
    cigar: null,
    bourbon: null,
  };

  for (const type of ["cigar", "bourbon"] as const) {
    const typeEntries = entries.filter((e) => e.product_type === type && e.recommend);
    const tally = new Map<string, { name: string; brand: string | null; votes: number }>();
    for (const e of typeEntries) {
      const existing = tally.get(e.product_id) ?? {
        name: e.product_name,
        brand: e.product_brand,
        votes: 0,
      };
      existing.votes += 1;
      tally.set(e.product_id, existing);
    }
    const ranked = [...tally.entries()]
      .map(([id, v]) => ({ id, ...v }))
      .sort((a, b) => b.votes - a.votes);
    topProductByType[type] = ranked[0] ?? null;
  }

  const dateLabel = new Date(event.date).toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });

  return (
    <main className="mx-auto max-w-md px-5 py-6 pb-24 flex-1">
      <Link
        href={`/events/${event.id}`}
        className="text-sm text-foreground-muted hover:text-foreground"
      >
        ← back to meetup
      </Link>

      <section
        aria-label="Meetup recap card"
        className="mt-4 p-6 rounded-[16px] border-2 border-border bg-surface flex flex-col items-center text-center"
      >
        <NCCCLogo size={72} className="mb-3" decorative />

        <p className="text-[10px] tracking-[0.3em] uppercase text-foreground-subtle">
          The night of
        </p>
        <h1 className="text-3xl font-display mt-1">{event.name}</h1>
        <p className="text-sm text-foreground-muted mt-1">{dateLabel}</p>

        <div className="my-5 w-12 border-t border-border" />

        <div className="grid grid-cols-3 gap-3 w-full">
          <Stat label="Tastings" value={entries.length} />
          <Stat label="Members" value={memberSet.size} />
          <Stat label="Recommended" value={recommendCount} />
        </div>

        {topProductByType.cigar || topProductByType.bourbon ? (
          <>
            <Divider label="Of the night" />
            <div className="w-full flex flex-col gap-3">
              {topProductByType.cigar ? (
                <TopPick
                  label="Cigar"
                  name={topProductByType.cigar.name}
                  brand={topProductByType.cigar.brand}
                  votes={topProductByType.cigar.votes}
                />
              ) : null}
              {topProductByType.bourbon ? (
                <TopPick
                  label="Bourbon"
                  name={topProductByType.bourbon.name}
                  brand={topProductByType.bourbon.brand}
                  votes={topProductByType.bourbon.votes}
                />
              ) : null}
            </div>
          </>
        ) : null}

        {host ? (
          <p className="text-sm text-foreground-muted mt-6">
            Hosted by {formatMemberName(host as MemberNameFields)}
          </p>
        ) : null}

        <div className="my-4 w-12 border-t border-border" />

        <Voice className="block">{closingLine(entries.length, recommendCount)}</Voice>

        <p className="text-[10px] tracking-[0.3em] uppercase text-foreground-subtle mt-6">
          Norton Commons Cigar Club
        </p>
      </section>

      <p className="text-xs text-foreground-subtle text-center mt-6">
        Screenshot this card to share the night's archive.
      </p>
    </main>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex flex-col items-center">
      <span className="text-3xl tabular-nums font-display">{value}</span>
      <span className="text-[10px] tracking-widest uppercase text-foreground-subtle">{label}</span>
    </div>
  );
}

function TopPick({
  label,
  name,
  brand,
  votes,
}: {
  label: string;
  name: string;
  brand: string | null;
  votes: number;
}) {
  return (
    <div className="flex items-baseline justify-between gap-2 px-3 py-2 rounded-[10px] bg-surface-2">
      <div className="min-w-0">
        <p className="text-[10px] tracking-widest uppercase text-foreground-subtle">{label}</p>
        <p className="text-base text-foreground truncate">{name}</p>
        {brand ? <p className="text-xs text-foreground-muted truncate">{brand}</p> : null}
      </div>
      <span className="text-xs text-ember-500 tabular-nums shrink-0">{votes} ●</span>
    </div>
  );
}

function closingLine(tastings: number, recommends: number): string {
  if (tastings === 0) {
    return `"A quiet night, sir. Nothing made it into the archive."`;
  }
  if (recommends === 0) {
    return `"A night of curious choices, sir. Better luck next month."`;
  }
  if (recommends === tastings) {
    return `"A full slate, sir — everything came up roses. Rare and worth marking."`;
  }
  return `"A fine evening. ${recommends} of ${tastings} for the archive."`;
}
