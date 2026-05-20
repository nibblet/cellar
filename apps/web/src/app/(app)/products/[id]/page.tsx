import Link from "next/link";
import { notFound } from "next/navigation";
import { MemberTakes, RecommendBar, TagCloud } from "@/components/group-voice";
import { Button, Card, Divider, Voice } from "@/components/primitives";
import { loadGroupVoice } from "@/lib/aggregation/group-voice";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { ProductType } from "@/lib/wheel";
import { PhotoFrame } from "./photo-frame";

type Params = Promise<{ id: string }>;
type SearchParams = Promise<{ just_captured?: string; just_saved?: string }>;

export default async function ProductDetailPage({
  params,
  searchParams,
}: {
  params: Params;
  searchParams: SearchParams;
}) {
  const { id } = await params;
  const { just_captured, just_saved } = await searchParams;

  const supabase = await createSupabaseServerClient();

  const { data: product, error } = await supabase
    .from("products")
    .select("id, type, name, brand, specs, status, created_at")
    .eq("id", id)
    .maybeSingle();

  if (error || !product) notFound();

  const productType = product.type as ProductType;

  const { data: auth } = await supabase.auth.getUser();
  const userId = auth.user?.id ?? null;

  const groupVoice = await loadGroupVoice(supabase, id, productType);
  const myTake = userId ? groupVoice.takes.find((t) => t.user_id === userId) : undefined;
  const otherTakes = groupVoice.takes.filter((t) => t.user_id !== userId);

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
      {just_saved ? (
        <Voice className="text-center mb-4">"Noted. Thank you, sir."</Voice>
      ) : just_captured ? (
        <Voice className="text-center mb-4">"Here we are. A fine choice."</Voice>
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
      <p className="text-sm uppercase tracking-widest text-foreground-subtle mt-1">{productType}</p>

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
        <RecommendBar
          productType={productType}
          recommendCount={groupVoice.recommend_count}
          memberCount={groupVoice.member_count}
        />
      </Card>

      {otherTakes.length > 0 ? (
        <Card className="mt-4">
          <MemberTakes takes={otherTakes} />
        </Card>
      ) : null}

      {myTake ? (
        <Card className="mt-4">
          <p className="text-sm text-foreground-subtle uppercase tracking-widest mb-2">
            Your tasting
          </p>
          <p className="text-base mb-2">
            <span className={myTake.recommend ? "text-ember-500" : "text-foreground-subtle"}>
              ●
            </span>{" "}
            {myTake.recommend ? "You recommend this." : "You passed on this."}
          </p>
          {myTake.chips.length > 0 ? (
            <div className="flex flex-wrap gap-1.5 mb-2">
              {myTake.chips.map((c: string) => (
                <span
                  key={c}
                  className="px-2 py-0.5 rounded-full bg-accent-tint text-xs text-foreground border border-accent"
                >
                  {c}
                </span>
              ))}
            </div>
          ) : null}
          {myTake.note ? <p className="text-sm text-foreground italic">"{myTake.note}"</p> : null}
        </Card>
      ) : null}

      <div className="mt-6 flex flex-col gap-3">
        <Link href={`/products/${product.id}/recommend`}>
          <Button size="large" className="w-full">
            {myTake ? "Edit your tasting" : "Recommend to NCCC"}
          </Button>
        </Link>
        <Link href={`/products/${product.id}/edit`}>
          <Button variant="ghost" className="w-full">
            Not quite right? Edit
          </Button>
        </Link>
      </div>

      <Divider label="How it tastes" />

      <Card>
        <TagCloud entries={groupVoice.tag_cloud} />
      </Card>

      <Divider label="Pairs with" />

      <Card>
        <p className="text-sm text-foreground-subtle">Pairing suggestions arrive in Phase 6.</p>
      </Card>

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
