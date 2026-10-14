import { readUploadImageInfo } from "./image-upload-info";

import {
  MAX_COMPRESS_IMAGE_PIXELS,
  shouldCompressUploadImage,
} from "./upload-image-policy";

function createCanvas(width: number, height: number) {
  if (typeof OffscreenCanvas !== "undefined") {
    return new OffscreenCanvas(width, height);
  }
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  return canvas;
}

async function supportsWebpEncoding() {
  const canvas = createCanvas(1, 1);
  const context = canvas.getContext("2d");
  if (!context || !("fillRect" in context)) return false;
  context.fillRect(0, 0, 1, 1);
  const blob =
    "convertToBlob" in canvas
      ? await canvas.convertToBlob({ type: "image/webp" })
      : await new Promise<Blob | null>((resolve) =>
          canvas.toBlob(resolve, "image/webp"),
        );
  return blob?.type === "image/webp";
}

async function hasTransparency(file: File) {
  // Older browsers without ImageBitmap keep alpha-capable PNGs as PNG.
  if (typeof createImageBitmap !== "function") return true;
  const bitmap = await createImageBitmap(file, {
    imageOrientation: "from-image",
  });
  const canvas = createCanvas(bitmap.width, Math.min(bitmap.height, 128));
  try {
    const context = canvas.getContext("2d", { willReadFrequently: true });
    if (!context || !("getImageData" in context)) return true;
    for (let y = 0; y < bitmap.height; y += canvas.height) {
      const rows = Math.min(canvas.height, bitmap.height - y);
      context.clearRect(0, 0, canvas.width, canvas.height);
      context.drawImage(
        bitmap,
        0,
        y,
        bitmap.width,
        rows,
        0,
        0,
        bitmap.width,
        rows,
      );
      const { data } = context.getImageData(0, 0, bitmap.width, rows);
      for (let index = 3; index < data.length; index += 4) {
        if (data[index] !== 255) return true;
      }
    }
    return false;
  } finally {
    bitmap.close();
    canvas.width = 0;
    canvas.height = 0;
  }
}

export async function compressUploadImage(file: File, signal?: AbortSignal) {
  signal?.throwIfAborted();
  if (!shouldCompressUploadImage(file)) return file;

  let sourceUrl: string | undefined;
  const resultUrls = new Set<string>();
  try {
    const type = file.type.toLowerCase();
    const info = readUploadImageInfo(await file.arrayBuffer(), type);
    if (
      !info ||
      info.animated ||
      info.width < 1 ||
      info.height < 1 ||
      info.width * info.height > MAX_COMPRESS_IMAGE_PIXELS
    ) {
      return file;
    }
    signal?.throwIfAborted();
    const webp = await supportsWebpEncoding();
    const transparent =
      !webp && info.hasAlphaChannel && (await hasTransparency(file));
    const format = webp ? "webp" : transparent ? "png" : "jpeg";
    const { compress } = await import("compresso.js");
    signal?.throwIfAborted();
    sourceUrl = URL.createObjectURL(file);
    // File input makes Compresso lower quality until it beats the source size.
    // A local URL preserves our quality floor; we compare sizes ourselves below.
    const options = {
      format,
      quality: type === "image/png" ? (webp ? 0.8 : 0.92) : 0.85,
      maxWidth: type === "image/png" ? Infinity : 2560,
      maxHeight: type === "image/png" ? Infinity : 2560,
      maxSizeMB: Infinity,
      maxInputPixels: MAX_COMPRESS_IMAGE_PIXELS,
      signal,
    } as const;
    let result = await compress(sourceUrl, options);
    resultUrls.add(result.url);
    if (webp && type === "image/png") {
      // PNGs include photos as well as screenshots. Flat screenshots often
      // encode smaller at native maximum quality; photos need lossy encoding.
      try {
        signal?.throwIfAborted();
        const maximumQuality = await compress(sourceUrl, {
          ...options,
          quality: 1,
        });
        resultUrls.add(maximumQuality.url);
        if (
          maximumQuality.blob.type === "image/webp" &&
          maximumQuality.blob.size > 0 &&
          (result.blob.type !== "image/webp" ||
            result.blob.size === 0 ||
            maximumQuality.blob.size <= result.blob.size)
        ) {
          result = maximumQuality;
        }
      } catch {
        // An optional higher-quality attempt must not discard a valid result.
        signal?.throwIfAborted();
      }
    }
    signal?.throwIfAborted();
    const expectedType = `image/${format}`;
    // Canvas can silently return PNG for an unsupported requested format.
    if (
      result.blob.type !== expectedType ||
      result.blob.size === 0 ||
      result.blob.size >= file.size
    ) {
      return file;
    }
    const extension = format === "jpeg" ? "jpg" : format;
    const stem = file.name.replace(/\.[^/.]+$/, "") || "image";
    return new File([result.blob], `${stem}.${extension}`, {
      type: expectedType,
      lastModified: file.lastModified,
    });
  } catch {
    signal?.throwIfAborted();
    return file;
  } finally {
    if (sourceUrl) URL.revokeObjectURL(sourceUrl);
    for (const url of resultUrls) URL.revokeObjectURL(url);
  }
}
