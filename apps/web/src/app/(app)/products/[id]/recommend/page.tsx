import Link from "next/link";
import { notFound } from "next/navigation";
import { Divider, Voice } from "@/components/primitives";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getWheel, type ProductType } from "@/lib/wheel";
import { RecommendForm } from "./recommend-form";

type Params = Promise<{ id: string }>;
type SearchParams = Promise<{ event?: string }>;

export default async function RecommendPage({
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
    .select("id, type, name, brand")
    .eq("id", id)
    .maybeSingle();
  if (!product) notFound();

  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) notFound();

  const { data: existing } = await supabase
    .from("tastings")
    .select("recommend, chips, note, event_id")
    .eq("user_id", auth.user.id)
    .eq("product_id", product.id)
    .maybeSingle();

  const wheel = getWheel(product.type as ProductType);
  const leafLabels = wheel.leaves.map((l) => l.label);

  return (
    <main className="mx-auto max-w-md px-5 py-8 flex-1">
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

      <Voice className="mb-6">
        {existing
          ? "“Care to revise, sir?”"
          : product.type === "cigar"
            ? "“What stood out, sir?”"
            : "“How is the pour treating you?”"}
      </Voice>

      <RecommendForm
        productId={product.id}
        productType={product.type as ProductType}
        leafLabels={leafLabels}
        initial={existing ?? null}
        eventId={existing?.event_id ?? event ?? null}
      />

      <Divider label="That's all" />

      <p className="text-sm text-foreground-subtle text-center">
        Chips and notes are optional. The Bartender does the rest.
      </p>
    </main>
  );
}
