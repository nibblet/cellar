import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/layout/app-shell";
import { Card, Divider, Voice } from "@/components/primitives";
import { formatMemberName, type MemberNameFields } from "@/lib/identity";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { InviteCard } from "./invite-card";

type InviteRow = {
  id: string;
  token: string;
  created_by: string;
  used_by: string | null;
  expires_at: string;
  created_at: string;
  creator: MemberNameFields | null;
  redeemer: MemberNameFields | null;
};

export default async function AdminInvitesPage() {
  const supabase = await createSupabaseServerClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) redirect("/login");

  const { data: profile } = await supabase
    .from("users")
    .select("role")
    .eq("id", auth.user.id)
    .maybeSingle();
  if (profile?.role !== "admin") redirect("/");

  const { data: invites } = await supabase
    .from("invites")
    .select(
      "id, token, created_by, used_by, expires_at, created_at, creator:users!invites_created_by_fkey(name_first, name_last_initial), redeemer:users!invites_used_by_fkey(name_first, name_last_initial)",
    )
    .order("created_at", { ascending: false })
    .limit(20);

  const rows = (invites as unknown as InviteRow[] | null) ?? [];
  const origin = (await headers()).get("origin") ?? process.env.NEXT_PUBLIC_APP_URL ?? "";

  return (
    <AppShell>
      <header className="mb-6">
        <p className="text-sm tracking-widest uppercase text-foreground-subtle">Admin</p>
        <h1 className="text-3xl mt-1">Invites</h1>
      </header>

      <Voice className="block mb-6">
        "One-shot links. Send only to those you'd buy a round for."
      </Voice>

      <InviteCard origin={origin} />

      <Divider label="Recent invites" />

      {rows.length === 0 ? (
        <p className="text-sm text-foreground-subtle">No invites generated yet.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {rows.map((inv) => {
            const expired = !inv.used_by && new Date(inv.expires_at) < new Date();
            const status = inv.used_by ? "redeemed" : expired ? "expired" : "open";
            return (
              <li key={inv.id}>
                <Card>
                  <div className="flex items-baseline justify-between gap-3">
                    <p className="text-sm font-mono text-foreground truncate">
                      …{inv.token.slice(-8)}
                    </p>
                    <span
                      className={
                        status === "redeemed"
                          ? "text-xs uppercase tracking-widest text-moss-600"
                          : status === "expired"
                            ? "text-xs uppercase tracking-widest text-foreground-subtle"
                            : "text-xs uppercase tracking-widest text-accent"
                      }
                    >
                      {status}
                    </span>
                  </div>
                  <p className="text-xs text-foreground-muted mt-1">
                    Created by {inv.creator ? formatMemberName(inv.creator) : "unknown"} ·{" "}
                    {new Date(inv.created_at).toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                    })}
                  </p>
                  {inv.redeemer ? (
                    <p className="text-xs text-foreground-muted">
                      Redeemed by {formatMemberName(inv.redeemer)}
                    </p>
                  ) : null}
                </Card>
              </li>
            );
          })}
        </ul>
      )}
    </AppShell>
  );
}
