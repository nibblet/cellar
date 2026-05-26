import Link from "next/link";
import { notFound } from "next/navigation";
import { AppShell } from "@/components/layout/app-shell";
import { Divider, Voice } from "@/components/primitives";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { collectKnownReleaseLabels } from "@/lib/tasting/known-release-labels";
import { getWheel, type ProductType } from "@/lib/wheel";
import { SessionForm } from "./session-form";

type Params = Promise<{ id: string }>;
type SearchParams = Promise<{ event?: string }>;

export default async function SessionPage({
  params,
  searchParams,
}: {
  params: Params;
  searchParams: SearchParams;
}) {
  const { id } = await params;
  const { event } = await searchParams;
  const supabase = await createSupabaseServerClient();

  const { data: product } = await supabase
    .from("products")
    .select("id, type, name, brand, release_pattern, specs")
    .eq("id", id)
    .maybeSingle();
  if (!product) notFound();

  const { data: memberReleaseRows } = await supabase
    .from("tastings")
    .select("release_label")
    .eq("product_id", product.id)
    .not("release_label", "is", null);

  const knownReleaseLabels = collectKnownReleaseLabels(
    (product.specs ?? {}) as Record<string, unknown>,
    (memberReleaseRows ?? []).map((row) => row.release_label),
  );

  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) notFound();

  const wheel = getWheel(product.type as ProductType);
  const leafLabels = wheel.leaves.map((l) => l.label);

  return (
    <AppShell spacious>
      <Link
        href={`/products/${product.id}`}
        className="text-sm text-foreground-muted hover:text-foreground"
      >
        ← back
      </Link>

      <header className="mt-3 mb-6">
        <p className="text-sm tracking-widest uppercase text-foreground-subtle">The Session</p>
        <h1 className="text-3xl mt-1">{product.name}</h1>
        {product.brand ? <p className="text-sm text-foreground-muted">{product.brand}</p> : null}
      </header>

      <Voice className="mb-6">
        {product.type === "cigar"
          ? '"Take it in thirds, sir — or skip ahead whenever you like."'
          : '"Nose, palate, finish — at your pace, sir."'}
      </Voice>

      <SessionForm
        productId={product.id}
        productType={product.type as ProductType}
        leafLabels={leafLabels}
        eventId={event ?? null}
        releasePattern={(product as { release_pattern?: string | null }).release_pattern ?? null}
        knownReleaseLabels={knownReleaseLabels}
      />

      <Divider label="That's all" />

      <p className="text-sm text-foreground-subtle text-center">
        Prefer the quick path?{" "}
        <Link
          href={`/products/${product.id}/recommend`}
          className="text-accent hover:text-accent-hover"
        >
          Recommend in one tap →
        </Link>
      </p>
    </AppShell>
  );
}
