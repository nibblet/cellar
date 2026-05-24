import Link from "next/link";
import { MemberNameWithBadges } from "@/components/members";
import { Card, Divider } from "@/components/primitives";
import { badgesForMember, loadMemberBadges } from "@/lib/badges/load";
import { formatMemberName, type MemberNameFields } from "@/lib/identity";
import { createSupabaseServerClient } from "@/lib/supabase/server";

type MemberRow = MemberNameFields & {
  id: string;
  joined_at: string;
};

export default async function MembersPage() {
  const supabase = await createSupabaseServerClient();

  const [membersResult, tastingsResult, badgeMap] = await Promise.all([
    supabase
      .from("users")
      .select("id, name_first, name_last_initial, joined_at")
      .order("name_first", { ascending: true }),
    supabase.from("tastings").select("user_id, recommend"),
    loadMemberBadges(supabase),
  ]);

  const rows = (membersResult.data ?? []) as MemberRow[];

  const counts = new Map<string, { total: number; recommended: number }>();
  for (const row of (tastingsResult.data ?? []) as Array<{ user_id: string; recommend: boolean }>) {
    const c = counts.get(row.user_id) ?? { total: 0, recommended: 0 };
    c.total += 1;
    if (row.recommend) c.recommended += 1;
    counts.set(row.user_id, c);
  }

  return (
    <main className="mx-auto max-w-md px-5 py-6 pb-24 flex-1">
      <header className="mb-6">
        <p className="text-sm tracking-widest uppercase text-foreground-subtle">The Club</p>
        <h1 className="text-3xl mt-1">Members</h1>
      </header>

      {rows.length === 0 ? (
        <Card>
          <p className="text-sm text-foreground-subtle">No members yet.</p>
        </Card>
      ) : (
        <ul className="flex flex-col divide-y divide-border bg-surface border border-border rounded-[12px]">
          {rows.map((m) => {
            const c = counts.get(m.id) ?? { total: 0, recommended: 0 };
            const badges = badgesForMember(badgeMap, m.id);
            return (
              <li key={m.id}>
                <Link
                  href={`/members/${m.id}`}
                  className="flex items-baseline justify-between gap-3 py-3 px-4 hover:bg-surface-2 transition-colors"
                >
                  <MemberNameWithBadges
                    name={formatMemberName(m)}
                    badges={badges}
                    className="min-w-0 flex-1"
                  />
                  <span className="text-xs text-foreground-muted tabular-nums shrink-0">
                    {c.total} tasting{c.total === 1 ? "" : "s"}
                    {c.recommended > 0 ? ` · ${c.recommended} ${"recommended"}` : ""}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}

      <Divider label="" />
      <p className="text-sm text-foreground-subtle text-center">
        Invitations go out from settings.
      </p>
    </main>
  );
}
