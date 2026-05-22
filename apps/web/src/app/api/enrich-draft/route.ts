/**
 * Enrich a freshly-captured draft product asynchronously.
 *
 * Called by the product detail page after a /capture redirect, *not* by the
 * capture server action itself — splitting the work across two HTTP requests
 * gives the long-running Apify pass its own 60s budget on Vercel Hobby,
 * separate from the capture action's 60s budget.
 *
 * Idempotent: returns early if the product already has an image_url, so a
 * stray re-fire from the client is harmless.
 */

import { NextResponse } from "next/server";
import { enrichDraftProduct } from "@/lib/enrich";
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
    .select("id, type, name, brand, line, status, image_url, specs")
    .eq("id", productId)
    .maybeSingle();

  if (error || !product) {
    return NextResponse.json({ error: "Product not found" }, { status: 404 });
  }

  // Already enriched. Idempotent no-op so the client can retry without harm.
  if (product.image_url) {
    return NextResponse.json({ ok: true, skipped: "already enriched" });
  }

  // Run the same enrichment pass the CLI scripts use. Hero image gets mirrored
  // into Supabase Storage, reviews get inserted, specs get patched.
  try {
    const result = await enrichDraftProduct(
      {
        id: product.id,
        type: product.type as "bourbon" | "cigar",
        name: product.name,
        brand: product.brand,
        line: product.line ?? null,
        specs: (product.specs ?? {}) as Record<string, unknown>,
      },
      supabase,
    );

    return NextResponse.json({
      ok: true,
      imageUrl: result.apify.imageUrl,
      reviewsWritten: result.apify.reviewsWritten,
      specsFilled: result.specs?.fieldsFilled.length ?? 0,
    });
  } catch (err) {
    console.error("[api/enrich-draft]", (err as Error).message);
    return NextResponse.json({ error: "Enrichment failed" }, { status: 500 });
  }
}
