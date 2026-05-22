/**
 * Download a remote image URL, downscale it to a reasonable web size, and
 * upload to the public `product-catalog` Supabase Storage bucket.
 *
 * Key layout: `{type}/{product_id}.jpg`. Every image is re-encoded to JPEG so
 * we get consistent extensions and a predictable URL on products.image_url.
 * Re-runs overwrite in place.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import sharp from "sharp";

const BUCKET = "product-catalog";

// Anything below this is a UI sprite, tracking pixel, or broken response —
// never a real product photo. Real catalog photos are ~30KB minimum.
const MIN_IMAGE_BYTES = 5 * 1024;

// Target max dimension and quality for stored catalog photos. Halfwheel et al.
// serve 1600px+ unoptimized JPEGs; we resize to <=1200px on the longest edge
// and re-encode at ~78 quality. Lands every image around 150–250KB regardless
// of source, keeps the bucket lean and the iPhone PWA fast.
const MAX_WIDTH_PX = 1200;
const JPEG_QUALITY = 78;

export type MirrorResult = {
  publicUrl: string;
  bytes: number;
  contentType: string;
};

export class MirrorError extends Error {
  constructor(
    message: string,
    public readonly stage: "fetch" | "type" | "size" | "decode" | "upload",
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

  const buf = Buffer.from(await res.arrayBuffer());
  if (buf.byteLength < MIN_IMAGE_BYTES) {
    throw new MirrorError(
      `image too small: ${buf.byteLength}b (likely a UI sprite) ${args.sourceUrl}`,
      "size",
    );
  }

  // Decode + downscale + re-encode as JPEG. Sharp throws on invalid input
  // (e.g. HTML returned with image/* content-type), which is a useful signal.
  let processed: Buffer;
  try {
    processed = await sharp(buf)
      .rotate() // honor EXIF orientation
      .resize({
        width: MAX_WIDTH_PX,
        height: MAX_WIDTH_PX,
        fit: "inside",
        withoutEnlargement: true,
      })
      .jpeg({ quality: JPEG_QUALITY, mozjpeg: true })
      .toBuffer();
  } catch (err) {
    throw new MirrorError(
      `sharp decode failed: ${(err as Error).message} ${args.sourceUrl}`,
      "decode",
    );
  }

  const path = `${args.productType}/${args.productId}.jpg`;
  const { error: upErr } = await supa.storage.from(BUCKET).upload(path, processed, {
    contentType: "image/jpeg",
    upsert: true,
  });
  if (upErr) throw new MirrorError(`upload: ${upErr.message}`, "upload");

  const { data } = supa.storage.from(BUCKET).getPublicUrl(path);
  return {
    publicUrl: data.publicUrl,
    bytes: processed.byteLength,
    contentType: "image/jpeg",
  };
}
