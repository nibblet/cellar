import Link from "next/link";
import { Card, Divider } from "@/components/primitives";
import { formatMemberName, type MemberNameFields } from "@/lib/identity";
import { createSupabaseServerClient } from "@/lib/supabase/server";

type MemberRow = MemberNameFields & {
  id: string;
  joined_at: string;
};

export default async function MembersPage() {
  const supabase = await createSupabaseServerClient();

  const { data: members } = await supabase
    .from("users")
    .select("id, name_first, name_last_initial, joined_at")
    .order("name_first", { ascending: true });

  const rows = (members ?? []) as MemberRow[];

  // Tasting counts per member, in one query.
  const { data: tastingsByMember } = await supabase.from("tastings").select("user_id, recommend");

  const counts = new Map<string, { total: number; recommended: number }>();
  for (const row of (tastingsByMember ?? []) as Array<{ user_id: string; recommend: boolean }>) {
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
            return (
              <li key={m.id}>
                <Link
                  href={`/members/${m.id}`}
                  className="flex items-baseline justify-between py-3 px-4 hover:bg-surface-2 transition-colors"
                >
                  <span className="text-base font-medium text-foreground">
                    {formatMemberName(m)}
                  </span>
                  <span className="text-xs text-foreground-muted tabular-nums">
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
