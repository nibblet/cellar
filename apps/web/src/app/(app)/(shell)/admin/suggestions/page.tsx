import { redirect } from "next/navigation";
import { AppShell } from "@/components/layout/app-shell";
import { Card, Divider, Voice } from "@/components/primitives";
import { formatMemberName, type MemberNameFields } from "@/lib/identity";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { SuggestionRow } from "./suggestion-row";

type Row = {
  id: string;
  kind: "feature" | "bug" | "other";
  body: string;
  status: "open" | "reviewing" | "done" | "wont-do";
  created_at: string;
  member: MemberNameFields | null;
};

const STATUS_ORDER: Record<Row["status"], number> = {
  open: 0,
  reviewing: 1,
  done: 2,
  "wont-do": 3,
};

export default async function AdminSuggestionsPage() {
  const supabase = await createSupabaseServerClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) redirect("/login");

  const { data: profile } = await supabase
    .from("users")
    .select("role")
    .eq("id", auth.user.id)
    .maybeSingle();
  if (profile?.role !== "admin") redirect("/");

  const { data: suggestions } = await supabase
    .from("suggestions")
    .select(
      "id, kind, body, status, created_at, member:users!suggestions_member_id_fkey(name_first, name_last_initial)",
    )
    .order("created_at", { ascending: false });

  const rows = ((suggestions as unknown as Row[] | null) ?? []).slice().sort((a, b) => {
    const s = STATUS_ORDER[a.status] - STATUS_ORDER[b.status];
    if (s !== 0) return s;
    return b.created_at.localeCompare(a.created_at);
  });

  const openCount = rows.filter((r) => r.status === "open").length;

  return (
    <AppShell>
      <header className="mb-6">
        <p className="text-sm tracking-widest uppercase text-foreground-subtle">Admin</p>
        <h1 className="text-3xl mt-1">Suggestions</h1>
        <p className="text-sm text-foreground-muted mt-1">
          {openCount} open · {rows.length} total
        </p>
      </header>

      <Voice className="block mb-6">"The mailbag from the club, sir."</Voice>

      <Divider label="Inbox" />

      {rows.length === 0 ? (
        <Card>
          <p className="text-sm text-foreground-subtle">No suggestions yet.</p>
        </Card>
      ) : (
        <ul className="flex flex-col gap-3">
          {rows.map((row) => (
            <li key={row.id}>
              <SuggestionRow
                id={row.id}
                kind={row.kind}
                body={row.body}
                status={row.status}
                createdAt={row.created_at}
                memberName={row.member ? formatMemberName(row.member) : "unknown"}
              />
            </li>
          ))}
        </ul>
      )}
    </AppShell>
  );
}
