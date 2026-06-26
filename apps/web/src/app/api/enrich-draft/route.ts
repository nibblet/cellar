/**
 * Enrich a freshly-captured draft product asynchronously.
 *
 * Called by the product detail page after a /capture redirect, *not* by the
 * capture server action itself — splitting the work across two HTTP requests
 * gives the long-running web search pass its own 60s budget on Vercel Hobby,
 * separate from the capture action's 60s budget.
 */

import { NextResponse } from "next/server";
import OpenAI from "openai";
import {
  enrichDraftProduct,
  enrichProductFromWeb,
  productNeedsCatalogEnrichment,
} from "@/lib/enrich";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const maxDuration = 60;
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const productId = body?.productId;
  const force = body?.force === true;
  const imageOnly = body?.imageOnly === true;
  if (typeof productId !== "string" || !productId) {
    return NextResponse.json({ error: "Missing productId" }, { status: 400 });
  }

  const supabase = await createSupabaseServerClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

  if (force || imageOnly) {
    const { data: profile } = await supabase
      .from("users")
      .select("role")
      .eq("id", auth.user.id)
      .maybeSingle();
    if (profile?.role !== "admin") {
      return NextResponse.json({ error: "Admin only" }, { status: 403 });
    }
  }

  if (!process.env.OPENAI_API_KEY) {
    console.error("[api/enrich-draft] Missing OPENAI_API_KEY");
    return NextResponse.json(
      { error: "Catalog enrichment is not configured (OPENAI_API_KEY missing)" },
      { status: 503 },
    );
  }

  const { data: product, error } = await supabase
    .from("products")
    .select("id, type, name, brand, line, source, image_url, specs, wheel_vector")
    .eq("id", productId)
    .maybeSingle();

  if (error || !product) {
    return NextResponse.json({ error: "Product not found" }, { status: 404 });
  }

  const specs = (product.specs ?? {}) as Record<string, unknown>;
  const wheelVector = (product.wheel_vector ?? null) as Record<string, number> | null;

  if (!force && !imageOnly) {
    const { count: reviewCount } = await supabase
      .from("product_reviews")
      .select("id", { count: "exact", head: true })
      .eq("product_id", productId);

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
  }

  if (imageOnly) {
    try {
      const admin = createSupabaseAdminClient();
      const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

      await admin.from("products").update({ image_url: null }).eq("id", productId);

      const result = await enrichProductFromWeb(
        {
          id: product.id,
          type: product.type as "bourbon" | "cigar",
          name: product.name,
          brand: product.brand,
          line: product.line ?? null,
        },
        { openai, supabase: admin, userId: auth.user.id },
        { imageOnly: true },
      );

      return NextResponse.json({
        ok: true,
        imageUrl: result.imageUrl,
        searchError: result.searchError,
        mirrorError: result.mirrorError,
      });
    } catch (err) {
      console.error("[api/enrich-draft] imageOnly:", (err as Error).message);
      return NextResponse.json(
        { error: err instanceof Error ? err.message : "Image re-fetch failed" },
        { status: 500 },
      );
    }
  }

  try {
    const admin = createSupabaseAdminClient();

    let workingSpecs = specs;
    let workingWheel = wheelVector;

    if (force) {
      workingSpecs = { ...specs };
      delete workingSpecs.web_enriched_at;
      delete workingSpecs.enrichment_source;
      delete workingSpecs.enrichment_source_urls;
      workingWheel = null;
      await admin
        .from("products")
        .update({
          specs: workingSpecs,
          wheel_vector: null,
          trait_vector: null,
          winston_prose: null,
        })
        .eq("id", productId);
    }

    const result = await enrichDraftProduct(
      {
        id: product.id,
        type: product.type as "bourbon" | "cigar",
        name: product.name,
        brand: product.brand,
        line: product.line ?? null,
        source: product.source,
        specs: workingSpecs,
        wheel_vector: workingWheel,
      },
      admin,
      auth.user.id,
      { force },
    );

    if (result.web.searchError) {
      console.warn("[api/enrich-draft] web search:", result.web.searchError);
    }
    if (result.web.mirrorError) {
      console.warn("[api/enrich-draft] mirror:", result.web.mirrorError);
    }

    return NextResponse.json({
      ok: true,
      imageUrl: result.web.imageUrl,
      specsFilled: result.web.specsFieldsFilled.length,
      wheelLeaves: result.web.wheelLeavesFilled,
      searchError: result.web.searchError,
      mirrorError: result.web.mirrorError,
    });
  } catch (err) {
    console.error("[api/enrich-draft]", (err as Error).message);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Enrichment failed" },
      { status: 500 },
    );
  }
}
