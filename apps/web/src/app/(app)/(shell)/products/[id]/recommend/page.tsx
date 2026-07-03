import Link from "next/link";
import { notFound } from "next/navigation";
import { AppShell } from "@/components/layout/app-shell";
import { Card, Divider, Voice } from "@/components/primitives";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { collectKnownReleaseLabels } from "@/lib/tasting/known-release-labels";
import { getWheel, type ProductType } from "@/lib/wheel";
import { RecommendForm } from "./recommend-form";

type Params = Promise<{ id: string }>;
type SearchParams = Promise<{
  event?: string;
  release_label?: string;
  release_label_source?: string;
  vision_release_label?: string;
  confirmed?: string;
  enriching?: string;
}>;

export default async function RecommendPage({
  params,
  searchParams,
}: {
  params: Params;
  searchParams: SearchParams;
}) {
  const { id } = await params;
  const { event, release_label, release_label_source, vision_release_label, confirmed, enriching } =
    await searchParams;
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

  const { data: existing } = await supabase
    .from("tastings")
    .select("recommend, chips, note, event_id, release_label")
    .eq("user_id", auth.user.id)
    .eq("product_id", product.id)
    .eq("release_label_key", release_label?.trim() ?? "")
    .maybeSingle();

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
        <p className="text-sm tracking-widest uppercase text-foreground-subtle">
          {existing ? "Update your tasting" : "Your tasting"}
        </p>
        <h1 className="text-3xl mt-1">{product.name}</h1>
        {product.brand ? <p className="text-sm text-foreground-muted">{product.brand}</p> : null}
      </header>

      {confirmed || enriching ? (
        <Card className="mb-6 border border-accent/40 bg-surface">
          <Voice className="text-base">
            {enriching
              ? "Good. I'm still filling in the details — save your take below, and check back at the product page when you like."
              : "Good. The name's down — tell me what you thought."}
          </Voice>
        </Card>
      ) : null}

      <Voice className="mb-6">
        {existing
          ? "“Care to revise?”"
          : product.type === "cigar"
            ? "“What stood out?”"
            : "“How is the pour treating you?”"}
      </Voice>

      <RecommendForm
        productId={product.id}
        productType={product.type as ProductType}
        releasePattern={(product as { release_pattern?: string | null }).release_pattern ?? null}
        leafLabels={leafLabels}
        initial={existing ?? null}
        eventId={existing?.event_id ?? event ?? null}
        releaseLabel={existing?.release_label ?? release_label ?? null}
        releaseLabelSource={
          release_label_source === "vision" || release_label_source === "member"
            ? release_label_source
            : null
        }
        visionReleaseLabel={vision_release_label ?? null}
        knownReleaseLabels={knownReleaseLabels}
      />

      <Divider label="That's all" />

      <p className="text-sm text-foreground-subtle text-center">
        Chips and notes are optional. Winston does the rest.
      </p>
    </AppShell>
  );
}
