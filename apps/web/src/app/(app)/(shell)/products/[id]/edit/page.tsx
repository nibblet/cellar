import { notFound } from "next/navigation";
import { AppShell } from "@/components/layout/app-shell";
import { Voice } from "@/components/primitives";
import { PhotoManager, type MemberPhoto } from "@/components/product";
import { signImagePaths } from "@/lib/feed/queries";
import { formatMemberName } from "@/lib/identity";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { ProductType } from "@/lib/wheel";
import { EditForm } from "./edit-form";

type Params = Promise<{ id: string }>;

export default async function ProductEditPage({ params }: { params: Params }) {
  const { id } = await params;
  const supabase = await createSupabaseServerClient();

  const { data: product } = await supabase
    .from("products")
    .select("id, type, name, brand, image_url, specs, status, created_by")
    .eq("id", id)
    .maybeSingle();

  if (!product) notFound();

  const { data: auth } = await supabase.auth.getUser();
  const { data: profile } = auth.user
    ? await supabase.from("users").select("role").eq("id", auth.user.id).maybeSingle()
    : { data: null };
  const isAdmin = profile?.role === "admin";

  let memberPhotos: MemberPhoto[] = [];
  if (isAdmin) {
    type ImageRow = {
      id: string;
      image_url: string;
      contributor: { name_first: string; name_last_initial: string } | null;
    };
    const { data: images } = await supabase
      .from("product_images")
      .select(
        "id, image_url, contributor:users!product_images_contributed_by_fkey(name_first, name_last_initial)",
      )
      .eq("product_id", id)
      .order("created_at", { ascending: false });

    const rows = (images as unknown as ImageRow[] | null) ?? [];
    const signedMap = await signImagePaths(
      supabase,
      rows.map((r) => r.image_url),
    );
    memberPhotos = rows
      .map((r) => {
        const url = signedMap.get(r.image_url);
        if (!url) return null;
        return {
          id: r.id,
          url,
          contributor: r.contributor ? formatMemberName(r.contributor) : null,
        };
      })
      .filter((x): x is MemberPhoto => x !== null);
  }

  return (
    <AppShell>
      <header className="mb-6">
        <p className="text-sm tracking-widest uppercase text-foreground-subtle">
          {product.status === "draft" ? "Draft" : "Edit"}
        </p>
        <h1 className="text-3xl mt-1">{product.name}</h1>
      </header>

      <Voice className="block mb-6">
        "Tidy up what I got wrong, sir. I'll remember for next time."
      </Voice>

      <EditForm
        product={{
          id: product.id,
          type: product.type as ProductType,
          name: product.name,
          brand: product.brand,
          specs: (product.specs ?? {}) as {
            wrapper_color?: string;
            country?: string;
            vitola?: string;
            strength?: string;
            distillery?: string;
            mash_bill?: string;
          },
        }}
        canReEnrich={isAdmin}
      />

      {isAdmin ? (
        <PhotoManager
          productId={product.id}
          catalogUrl={product.image_url}
          memberPhotos={memberPhotos}
        />
      ) : null}
    </AppShell>
  );
}
