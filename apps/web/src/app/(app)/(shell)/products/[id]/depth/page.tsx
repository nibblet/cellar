import { notFound, redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";

type Params = Promise<{ id: string }>;

/** Legacy deep link — depth content now lives inline on the product face. */
export default async function ProductDepthPage({ params }: { params: Params }) {
  const { id } = await params;
  const supabase = await createSupabaseServerClient();
  const { data: product } = await supabase.from("products").select("id").eq("id", id).maybeSingle();

  if (!product) notFound();
  redirect(`/products/${id}#depth`);
}
