import Link from "next/link";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/layout/app-shell";
import { Card, Divider, Voice } from "@/components/primitives";
import { buildCollapseAnalysis, type CatalogProductRow } from "@/lib/catalog/collapse-groups";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { CatalogReviewClient } from "./catalog-review-client";

async function loadBourbons(): Promise<CatalogProductRow[]> {
  const supabase = await createSupabaseServerClient();
  const all: CatalogProductRow[] = [];

  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabase
      .from("products")
      .select("id, name, brand, specs, release_pattern")
      .eq("type", "bourbon")
      .eq("status", "confirmed")
      .order("name")
      .range(from, from + 999);

    if (error) throw error;
    if (!data?.length) break;
    all.push(...(data as CatalogProductRow[]));
  }

  return all;
}

export default async function AdminCatalogPage() {
  const supabase = await createSupabaseServerClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) redirect("/login");

  const { data: profile } = await supabase
    .from("users")
    .select("role")
    .eq("id", auth.user.id)
    .maybeSingle();
  if (profile?.role !== "admin") redirect("/you");

  const products = await loadBourbons();
  const analysis = buildCollapseAnalysis(products);

  return (
    <AppShell>
      <header className="mb-6">
        <p className="text-sm tracking-widest uppercase text-foreground-subtle">Admin</p>
        <h1 className="text-3xl mt-1">Catalog collapse</h1>
        <p className="text-sm text-foreground-muted mt-1">
          Live preview of what <code className="text-xs">collapse:catalog</code> would merge
        </p>
      </header>

      <Voice className="block mb-6">
        "One row per expression, sir. The vintages become chips — much easier on the eyes than that
        JSON file."
      </Voice>

      <Card className="mb-6 py-3 px-4">
        <p className="text-sm text-foreground-muted">
          This page reads the live catalog — same logic as{" "}
          <code className="text-xs">generate:collapse-map</code>. Tap any row to open the product
          page as members see it today. When a group looks right, run{" "}
          <code className="text-xs">pnpm generate:collapse-map --write</code> then{" "}
          <code className="text-xs">pnpm collapse:catalog --apply</code>.
        </p>
        <Link
          href="/admin"
          className="inline-block mt-3 text-sm text-foreground-subtle hover:text-foreground"
        >
          ← Admin tools
        </Link>
      </Card>

      <CatalogReviewClient
        groups={analysis.groups}
        skipped={analysis.skipped}
        soloFlags={analysis.soloFlags}
        stats={analysis.stats}
      />

      <Divider label="Workflow" />

      <Card className="py-4 px-4 text-sm text-foreground-muted space-y-2">
        <p>
          <strong className="text-foreground font-medium">1. Flag</strong> — tap{" "}
          <code className="text-xs">Collapse Y/N</code> on any row here, or use the rectify script
          for bulk restore.
        </p>
        <p>
          <strong className="text-foreground font-medium">2. Preview here</strong> — confirm
          survivor + release chips match how you'd ask for it at the bar.
        </p>
        <p>
          <strong className="text-foreground font-medium">3. Apply</strong> — generate map, dry-run
          collapse, then apply.
        </p>
        <p className="text-xs text-foreground-subtle pt-1">
          Expression-type exceptions export:{" "}
          <code className="text-xs">pnpm export:expression-type-exceptions</code>
        </p>
      </Card>
    </AppShell>
  );
}
