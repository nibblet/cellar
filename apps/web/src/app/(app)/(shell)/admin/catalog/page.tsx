import Link from "next/link";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/layout/app-shell";
import { Card } from "@/components/primitives";
import { groupIncludedByBrand, type IncludedRow } from "@/lib/catalog/catalog-inclusion";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { CatalogInclusionClient } from "./catalog-inclusion-client";

async function loadIncludedBourbons(): Promise<IncludedRow[]> {
  const supabase = await createSupabaseServerClient();
  const all: IncludedRow[] = [];

  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabase
      .from("products")
      .select("id, name, brand, brand_family, expression")
      .eq("type", "bourbon")
      .eq("status", "confirmed")
      .eq("catalog_included", true)
      .order("brand_family")
      .range(from, from + 999);

    if (error) throw error;
    if (!data?.length) break;
    all.push(...(data as IncludedRow[]));
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

  const included = await loadIncludedBourbons();
  const inclusionGroups = groupIncludedByBrand(included);

  return (
    <AppShell>
      <header className="mb-6">
        <p className="text-sm tracking-widest uppercase text-foreground-subtle">Admin</p>
        <h1 className="text-3xl mt-1">Member catalog</h1>
        <p className="text-sm text-foreground-muted mt-1">Hide or de-dupe what members see</p>
      </header>

      <Card className="mb-6 py-3 px-4">
        <p className="text-sm text-foreground-muted">
          The member-facing catalog (<code className="text-xs">catalog_included = true</code>),
          grouped by brand. "Possible dupe" flags rows whose expression looks like another in the
          same brand — usually a Cobb row and a bourbonExplorer row for the same bottle. Tap{" "}
          <strong className="text-foreground font-medium">In catalog</strong> to hide one; it stays
          in the table and can be promoted back. For bulk merges of true duplicates, run{" "}
          <code className="text-xs">pnpm merge:catalog-duplicates</code>.
        </p>
        <Link
          href="/admin"
          className="inline-block mt-3 text-sm text-foreground-subtle hover:text-foreground"
        >
          ← Admin tools
        </Link>
      </Card>

      <CatalogInclusionClient groups={inclusionGroups} total={included.length} />
    </AppShell>
  );
}
