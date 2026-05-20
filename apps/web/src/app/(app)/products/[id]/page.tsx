import Link from "next/link";
import { notFound } from "next/navigation";
import { Button, Card, Divider, Voice } from "@/components/primitives";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { PhotoFrame } from "./photo-frame";

type Params = Promise<{ id: string }>;
type SearchParams = Promise<{ just_captured?: string }>;

export default async function ProductDetailPage({
  params,
  searchParams,
}: {
  params: Params;
  searchParams: SearchParams;
}) {
  const { id } = await params;
  const { just_captured } = await searchParams;

  const supabase = await createSupabaseServerClient();

  const { data: product, error } = await supabase
    .from("products")
    .select("id, type, name, brand, specs, status, created_at")
    .eq("id", id)
    .maybeSingle();

  if (error || !product) notFound();

  const { data: images } = await supabase
    .from("product_images")
    .select("image_url, is_hero")
    .eq("product_id", id)
    .order("is_hero", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(1);

  const heroPath = images?.[0]?.image_url;
  const heroSignedUrl = heroPath ? await signImage(supabase, heroPath) : null;

  const isDraft = product.status === "draft";

  return (
    <main className="mx-auto max-w-md px-5 py-6 flex-1">
      {just_captured ? (
        <Voice className="text-center mb-4">“Here we are. A fine choice.”</Voice>
      ) : null}

      {heroSignedUrl ? (
        <PhotoFrame src={heroSignedUrl} alt={product.name} className="aspect-square mb-6" sepia />
      ) : (
        <div className="aspect-square mb-6 rounded-[16px] border border-border bg-surface flex items-center justify-center">
          <p className="text-foreground-subtle text-sm">No photo yet</p>
        </div>
      )}

      <h1 className="text-3xl mb-1">{product.name}</h1>
      {product.brand ? <p className="text-base text-foreground-muted">{product.brand}</p> : null}
      <p className="text-sm uppercase tracking-widest text-foreground-subtle mt-1">
        {product.type}
      </p>

      {isDraft ? (
        <Card className="mt-6 border border-ember-500">
          <p className="text-sm text-foreground-muted">
            <span className="text-ember-500 font-medium">Draft.</span> The Bartender wasn't certain
            — confirm or edit the details below.
          </p>
        </Card>
      ) : null}

      <Divider label="The club says" />

      <Card>
        <p className="text-sm text-foreground-subtle">
          Group voice is empty so far. Be the first to recommend it.
        </p>
      </Card>

      <div className="mt-6 flex flex-col gap-3">
        <Link href={`/products/${product.id}/recommend`}>
          <Button size="large" className="w-full">
            Recommend to NCCC
          </Button>
        </Link>
        <Link href={`/products/${product.id}/edit`}>
          <Button variant="ghost" className="w-full">
            Not quite right? Edit
          </Button>
        </Link>
      </div>

      <Divider label="The facts" />

      <Card>
        <dl className="grid grid-cols-1 gap-2 text-sm">
          {Object.entries(product.specs ?? {}).map(([key, value]) => {
            if (value === null || value === undefined || value === "") return null;
            return (
              <div key={key} className="flex justify-between gap-4">
                <dt className="text-foreground-subtle capitalize">{key.replace(/_/g, " ")}</dt>
                <dd className="text-foreground text-right">{String(value)}</dd>
              </div>
            );
          })}
          {Object.values(product.specs ?? {}).every((v) => !v) ? (
            <p className="text-foreground-subtle">No specs recorded yet.</p>
          ) : null}
        </dl>
      </Card>
    </main>
  );
}

async function signImage(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  path: string,
): Promise<string | null> {
  const { data } = await supabase.storage.from("product-photos").createSignedUrl(path, 3600);
  return data?.signedUrl ?? null;
}
