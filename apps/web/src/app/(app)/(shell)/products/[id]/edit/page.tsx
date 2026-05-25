import { notFound } from "next/navigation";
import { AppShell } from "@/components/layout/app-shell";
import { Voice } from "@/components/primitives";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { ProductType } from "@/lib/wheel";
import { EditForm } from "./edit-form";

type Params = Promise<{ id: string }>;

export default async function ProductEditPage({ params }: { params: Params }) {
  const { id } = await params;
  const supabase = await createSupabaseServerClient();

  const { data: product } = await supabase
    .from("products")
    .select("id, type, name, brand, specs, status, created_by")
    .eq("id", id)
    .maybeSingle();

  if (!product) notFound();

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
      />
    </AppShell>
  );
}
