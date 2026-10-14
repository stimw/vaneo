export const MIN_COMPRESS_IMAGE_BYTES = 64 * 1024;
export const MAX_COMPRESS_IMAGE_BYTES = 20 * 1024 * 1024;
export const MAX_COMPRESS_IMAGE_PIXELS = 24_000_000;

export function shouldCompressUploadImage(file: File) {
  return (
    ["image/jpeg", "image/jpg", "image/png"].includes(
      file.type.toLowerCase(),
    ) &&
    file.size >= MIN_COMPRESS_IMAGE_BYTES &&
    file.size <= MAX_COMPRESS_IMAGE_BYTES
  );
}
