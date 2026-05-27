/**
 * Product photo management API.
 *
 * POST  — upload a replacement photo (catalog or member)
 * DELETE — remove a catalog stock photo or a member-contributed photo
 *
 * Admin-only. Uses the admin Supabase client for catalog-bucket writes
 * (no member-write RLS on product-catalog) and for cross-member deletes
 * on product_images.
 */

import { NextResponse } from "next/server";
import sharp from "sharp";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const maxDuration = 30;
export const dynamic = "force-dynamic";

const CATALOG_BUCKET = "product-catalog";
const PHOTOS_BUCKET = "product-photos";
const MAX_WIDTH_PX = 1200;
const JPEG_QUALITY = 78;

async function requireAdmin() {
  const supabase = await createSupabaseServerClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return { error: "Not signed in", status: 401 } as const;

  const { data: profile } = await supabase
    .from("users")
    .select("role")
    .eq("id", auth.user.id)
    .maybeSingle();

  if (profile?.role !== "admin") return { error: "Admin only", status: 403 } as const;
  return { userId: auth.user.id } as const;
}

async function processImage(file: File): Promise<Buffer> {
  const buf = Buffer.from(await file.arrayBuffer());
  return sharp(buf)
    .rotate()
    .resize({ width: MAX_WIDTH_PX, height: MAX_WIDTH_PX, fit: "inside", withoutEnlargement: true })
    .jpeg({ quality: JPEG_QUALITY, mozjpeg: true })
    .toBuffer();
}

export async function POST(req: Request) {
  const auth = await requireAdmin();
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const form = await req.formData();
  const productId = form.get("productId") as string | null;
  const target = form.get("target") as string | null;
  const file = form.get("file") as File | null;

  if (!productId || !file || (target !== "catalog" && target !== "member")) {
    return NextResponse.json(
      { error: "Required: productId, file, target (catalog|member)" },
      { status: 400 },
    );
  }

  const admin = createSupabaseAdminClient();

  const { data: product } = await admin
    .from("products")
    .select("id, type")
    .eq("id", productId)
    .maybeSingle();

  if (!product) {
    return NextResponse.json({ error: "Product not found" }, { status: 404 });
  }

  let processed: Buffer;
  try {
    processed = await processImage(file);
  } catch (err) {
    return NextResponse.json(
      { error: `Image processing failed: ${(err as Error).message}` },
      { status: 422 },
    );
  }

  const productType = product.type as "bourbon" | "cigar";

  if (target === "catalog") {
    const path = `${productType}/${productId}.jpg`;
    const { error: upErr } = await admin.storage.from(CATALOG_BUCKET).upload(path, processed, {
      contentType: "image/jpeg",
      upsert: true,
    });
    if (upErr) {
      return NextResponse.json({ error: `Upload failed: ${upErr.message}` }, { status: 500 });
    }

    const { data: urlData } = admin.storage.from(CATALOG_BUCKET).getPublicUrl(path);
    const publicUrl = `${urlData.publicUrl}?t=${Date.now()}`;

    await admin.from("products").update({ image_url: publicUrl }).eq("id", productId);

    return NextResponse.json({ ok: true, url: publicUrl });
  }

  // target === "member"
  const storagePath = `${auth.userId}/${crypto.randomUUID()}.jpg`;
  const { error: upErr } = await admin.storage.from(PHOTOS_BUCKET).upload(storagePath, processed, {
    contentType: "image/jpeg",
  });
  if (upErr) {
    return NextResponse.json({ error: `Upload failed: ${upErr.message}` }, { status: 500 });
  }

  const { error: insertErr } = await admin.from("product_images").insert({
    product_id: productId,
    image_url: storagePath,
    is_hero: false,
    contributed_by: auth.userId,
  });
  if (insertErr) {
    return NextResponse.json({ error: `DB insert failed: ${insertErr.message}` }, { status: 500 });
  }

  const { data: signedData } = await admin.storage
    .from(PHOTOS_BUCKET)
    .createSignedUrl(storagePath, 3600);

  return NextResponse.json({ ok: true, url: signedData?.signedUrl ?? null });
}

export async function DELETE(req: Request) {
  const auth = await requireAdmin();
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const body = await req.json().catch(() => null);
  const target = body?.target as string | undefined;
  const productId = body?.productId as string | undefined;

  if (!productId || (target !== "catalog" && target !== "member")) {
    return NextResponse.json(
      { error: "Required: productId, target (catalog|member)" },
      { status: 400 },
    );
  }

  const admin = createSupabaseAdminClient();

  if (target === "catalog") {
    const { data: product } = await admin
      .from("products")
      .select("type, image_url")
      .eq("id", productId)
      .maybeSingle();

    if (!product) {
      return NextResponse.json({ error: "Product not found" }, { status: 404 });
    }

    const productType = product.type as "bourbon" | "cigar";
    const storagePath = `${productType}/${productId}.jpg`;

    // Best-effort storage delete — the file might not exist if image_url
    // points to an external URL that was never mirrored.
    await admin.storage.from(CATALOG_BUCKET).remove([storagePath]);
    await admin.from("products").update({ image_url: null }).eq("id", productId);

    return NextResponse.json({ ok: true });
  }

  // target === "member"
  const imageId = body?.imageId as string | undefined;
  if (!imageId) {
    return NextResponse.json({ error: "Required: imageId for member photo" }, { status: 400 });
  }

  const { data: image } = await admin
    .from("product_images")
    .select("image_url")
    .eq("id", imageId)
    .eq("product_id", productId)
    .maybeSingle();

  if (!image) {
    return NextResponse.json({ error: "Image not found" }, { status: 404 });
  }

  await admin.storage.from(PHOTOS_BUCKET).remove([image.image_url]);
  await admin.from("product_images").delete().eq("id", imageId);

  return NextResponse.json({ ok: true });
}
