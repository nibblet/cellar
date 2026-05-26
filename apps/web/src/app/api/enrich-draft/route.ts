/**
 * Enrich a freshly-captured draft product asynchronously.
 *
 * Called by the product detail page after a /capture redirect, *not* by the
 * capture server action itself — splitting the work across two HTTP requests
 * gives the long-running Apify pass its own 60s budget on Vercel Hobby,
 * separate from the capture action's 60s budget.
 */

import { NextResponse } from "next/server";
import { enrichDraftProduct, productNeedsCatalogEnrichment } from "@/lib/enrich";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const maxDuration = 60;
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const productId = body?.productId;
  if (typeof productId !== "string" || !productId) {
    return NextResponse.json({ error: "Missing productId" }, { status: 400 });
  }

  const supabase = await createSupabaseServerClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

  const { data: product, error } = await supabase
    .from("products")
    .select("id, type, name, brand, line, source, image_url, specs, wheel_vector")
    .eq("id", productId)
    .maybeSingle();

  if (error || !product) {
    return NextResponse.json({ error: "Product not found" }, { status: 404 });
  }

  const { count: reviewCount } = await supabase
    .from("product_reviews")
    .select("id", { count: "exact", head: true })
    .eq("product_id", productId);

  const specs = (product.specs ?? {}) as Record<string, unknown>;
  const wheelVector = (product.wheel_vector ?? null) as Record<string, number> | null;
  const needsEnrichment = productNeedsCatalogEnrichment({
    productType: product.type as "bourbon" | "cigar",
    source: product.source,
    specs,
    reviewCount: reviewCount ?? 0,
    hasWheelVector: wheelVector != null && Object.keys(wheelVector).length > 0,
  });

  if (!needsEnrichment) {
    return NextResponse.json({ ok: true, skipped: "already enriched" });
  }

  if (!process.env.APIFY_TOKEN) {
    console.error("[api/enrich-draft] Missing APIFY_TOKEN");
    return NextResponse.json(
      { error: "Catalog enrichment is not configured (APIFY_TOKEN missing)" },
      { status: 503 },
    );
  }

  try {
    // Enrichment writes product_reviews, products.image_url/specs, and
    // product-catalog storage — all service-role only under RLS. Auth gate
    // above ensures only signed-in members can trigger it.
    const admin = createSupabaseAdminClient();
    const result = await enrichDraftProduct(
      {
        id: product.id,
        type: product.type as "bourbon" | "cigar",
        name: product.name,
        brand: product.brand,
        line: product.line ?? null,
        source: product.source,
        specs,
        wheel_vector: wheelVector,
      },
      admin,
    );

    if (result.apify.apifyError) {
      console.warn("[api/enrich-draft] apify:", result.apify.apifyError);
    }
    if (result.apify.mirrorError) {
      console.warn("[api/enrich-draft] mirror:", result.apify.mirrorError);
    }

    return NextResponse.json({
      ok: true,
      imageUrl: result.apify.imageUrl,
      reviewsWritten: result.apify.reviewsWritten,
      specsFilled: result.specs?.fieldsFilled.length ?? 0,
      wheelLeaves: result.wheel?.leavesFilled ?? 0,
      apifyError: result.apify.apifyError,
      mirrorError: result.apify.mirrorError,
      specsError: result.specs?.error,
    });
  } catch (err) {
    console.error("[api/enrich-draft]", (err as Error).message);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Enrichment failed" },
      { status: 500 },
    );
  }
}
