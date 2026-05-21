type CompressOptions = {
  maxDimension?: number;
  quality?: number;
  maxBytes?: number;
};

const DEFAULT_MAX_DIMENSION = 2048;
const DEFAULT_QUALITY = 0.85;
const DEFAULT_MAX_BYTES = 3 * 1024 * 1024;

/**
 * Downscale and re-encode camera photos before server upload. iPhone captures
 * are often several MB (HEIC/JPEG); Next.js server actions default to 1 MB and
 * Vercel caps request bodies at 4.5 MB.
 */
export async function compressPhotoForUpload(
  file: File,
  opts: CompressOptions = {},
): Promise<File> {
  const maxDimension = opts.maxDimension ?? DEFAULT_MAX_DIMENSION;
  const quality = opts.quality ?? DEFAULT_QUALITY;
  const maxBytes = opts.maxBytes ?? DEFAULT_MAX_BYTES;

  if (file.size <= maxBytes && file.type === "image/jpeg") {
    return file;
  }

  const bitmap = await createImageBitmap(file);
  const longestEdge = Math.max(bitmap.width, bitmap.height);
  const scale = longestEdge > maxDimension ? maxDimension / longestEdge : 1;
  const width = Math.round(bitmap.width * scale);
  const height = Math.round(bitmap.height * scale);

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;

  const ctx = canvas.getContext("2d");
  if (!ctx) {
    bitmap.close();
    throw new Error("Could not prepare photo for upload.");
  }

  ctx.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();

  const blob = await canvasToJpegBlob(canvas, quality);
  const baseName = file.name.replace(/\.[^.]+$/, "") || "photo";

  return new File([blob], `${baseName}.jpg`, { type: "image/jpeg", lastModified: Date.now() });
}

function canvasToJpegBlob(canvas: HTMLCanvasElement, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) resolve(blob);
        else reject(new Error("Could not compress photo."));
      },
      "image/jpeg",
      quality,
    );
  });
}
