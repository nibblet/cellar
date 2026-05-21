/**
 * Download a remote image URL and upload it to the public `product-catalog`
 * Supabase Storage bucket. Returns the public URL we should store on
 * products.image_url.
 *
 * Key layout: `{type}/{product_id}.{ext}`. One image per product — re-running
 * overwrites in place, so the URL on products.image_url stays stable.
 */

import type { SupabaseClient } from "@supabase/supabase-js";

const BUCKET = "product-catalog";

// Anything below this is a UI sprite, tracking pixel, or broken response —
// never a real product photo. Real catalog photos are ~30KB minimum.
const MIN_IMAGE_BYTES = 5 * 1024;

// Cap to keep the bucket lean. ~580MB total across the catalog at this cap.
// Oversized sources (e.g. kohnhed serves unoptimized full-res) are skipped
// rather than mirrored — leaves image_url null for a later downscaling pass.
const MAX_IMAGE_BYTES = 500 * 1024;

// Extension fallback when the Content-Type header is missing or weird.
const EXT_BY_CT: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/jpg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

function extFromUrl(url: string): string | null {
  const match = url.toLowerCase().match(/\.(jpe?g|png|webp)(?:\?|$|#)/);
  if (!match) return null;
  return match[1] === "jpeg" ? "jpg" : match[1];
}

export type MirrorResult = {
  publicUrl: string;
  bytes: number;
  contentType: string;
};

export class MirrorError extends Error {
  constructor(
    message: string,
    public readonly stage: "fetch" | "type" | "size" | "upload",
  ) {
    super(message);
  }
}

export async function mirrorImage(
  supa: SupabaseClient,
  args: {
    sourceUrl: string;
    productId: string;
    productType: "bourbon" | "cigar";
  },
): Promise<MirrorResult> {
  // Most reviewer sites 403 default fetchers; a real UA gets through.
  const res = await fetch(args.sourceUrl, {
    headers: {
      "user-agent":
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 NCCC-catalog/1.0",
      accept: "image/*,*/*;q=0.8",
    },
    redirect: "follow",
  });
  if (!res.ok) {
    throw new MirrorError(`fetch ${res.status} ${args.sourceUrl}`, "fetch");
  }

  const contentType = (res.headers.get("content-type") ?? "").split(";")[0].trim();
  const ext = EXT_BY_CT[contentType] ?? extFromUrl(args.sourceUrl);
  if (!ext) {
    throw new MirrorError(
      `unknown image type: ct="${contentType}" url=${args.sourceUrl}`,
      "type",
    );
  }
  const normalizedCt = contentType.startsWith("image/")
    ? contentType
    : `image/${ext === "jpg" ? "jpeg" : ext}`;

  const buf = await res.arrayBuffer();
  if (buf.byteLength < MIN_IMAGE_BYTES) {
    throw new MirrorError(
      `image too small: ${buf.byteLength}b (likely a UI sprite) ${args.sourceUrl}`,
      "size",
    );
  }
  if (buf.byteLength > MAX_IMAGE_BYTES) {
    throw new MirrorError(
      `image too large: ${Math.round(buf.byteLength / 1024)}kb > ${MAX_IMAGE_BYTES / 1024}kb cap ${args.sourceUrl}`,
      "size",
    );
  }
  const path = `${args.productType}/${args.productId}.${ext}`;

  const { error: upErr } = await supa.storage.from(BUCKET).upload(path, buf, {
    contentType: normalizedCt,
    upsert: true,
  });
  if (upErr) throw new MirrorError(`upload: ${upErr.message}`, "upload");

  const { data } = supa.storage.from(BUCKET).getPublicUrl(path);
  return { publicUrl: data.publicUrl, bytes: buf.byteLength, contentType: normalizedCt };
}
