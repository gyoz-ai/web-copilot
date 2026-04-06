/**
 * Image compression and conversion utilities for chat image uploads.
 * Resizes images to fit within MAX_IMAGE_DIMENSION and compresses to JPEG.
 */

export const MAX_IMAGES_PER_MESSAGE = 4;
export const MAX_IMAGE_DIMENSION = 1024;
const JPEG_QUALITY = 0.8;

/**
 * Compress and resize an image file. Returns a Blob (JPEG or PNG if transparent)
 * sized within MAX_IMAGE_DIMENSION on its longest side.
 */
export async function compressImage(
  file: File | Blob,
): Promise<{ blob: Blob; mimeType: string }> {
  const bitmap = await createImageBitmap(file);
  const { width, height } = bitmap;

  let targetW = width;
  let targetH = height;

  if (width > MAX_IMAGE_DIMENSION || height > MAX_IMAGE_DIMENSION) {
    const ratio = Math.min(
      MAX_IMAGE_DIMENSION / width,
      MAX_IMAGE_DIMENSION / height,
    );
    targetW = Math.round(width * ratio);
    targetH = Math.round(height * ratio);
  }

  const canvas = new OffscreenCanvas(targetW, targetH);
  const ctx = canvas.getContext("2d")!;
  ctx.drawImage(bitmap, 0, 0, targetW, targetH);
  bitmap.close();

  // Use JPEG for photos; keep PNG only if the source is PNG (may have transparency)
  const isPng =
    (file instanceof File && file.type === "image/png") ||
    (file instanceof Blob && file.type === "image/png");
  const mimeType = isPng ? "image/png" : "image/jpeg";
  const blob = await canvas.convertToBlob({
    type: mimeType,
    quality: mimeType === "image/jpeg" ? JPEG_QUALITY : undefined,
  });

  return { blob, mimeType };
}

/** Extract an image blob from a clipboard DataTransferItem. */
export function imageFromClipboard(
  item: DataTransferItem,
): { blob: Blob; mimeType: string } | null {
  if (!item.type.startsWith("image/")) return null;
  const blob = item.getAsFile();
  if (!blob) return null;
  return { blob, mimeType: item.type };
}

/** Convert a Blob to a data URL string. */
export function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}
