import Link from "next/link";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/layout/app-shell";
import { Card, Divider } from "@/components/primitives";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export default async function AdminHubPage() {
  const supabase = await createSupabaseServerClient();
  const { data: auth } = await supabase.auth.getUser();
  const { data: profile } = await supabase
    .from("users")
    .select("role")
    .eq("id", auth.user?.id ?? "")
    .maybeSingle();

  if (profile?.role !== "admin") redirect("/you");

  return (
    <AppShell>
      <header className="mb-6 text-center">
        <h1 className="text-3xl">Admin</h1>
        <p className="text-sm tracking-widest uppercase text-foreground-subtle mt-1">Club tools</p>
      </header>

      <Divider label="Tools" />

      <div className="flex flex-col gap-3">
        <Card>
          <Link
            href="/admin/catalog"
            className="block text-base text-foreground hover:text-foreground-muted"
          >
            Catalog collapse review →
          </Link>
        </Card>
        <Card>
          <Link
            href="/admin/invites"
            className="block text-base text-foreground hover:text-foreground-muted"
          >
            Generate invite link →
          </Link>
        </Card>
        <Card>
          <Link
            href="/admin/suggestions"
            className="block text-base text-foreground hover:text-foreground-muted"
          >
            Member suggestions →
          </Link>
        </Card>
        <Card>
          <Link
            href="/admin/usage"
            className="block text-base text-foreground hover:text-foreground-muted"
          >
            View usage / costs →
          </Link>
        </Card>
      </div>
    </AppShell>
  );
}
