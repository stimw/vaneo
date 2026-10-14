import createImageUpload, {
  finalizeImageUpload,
} from "@/fetchers/task/create-image-upload";
import { prepareUploadImage } from "./prepare-upload-image";

const allowedImageMimeTypes = new Set([
  "image/apng",
  "image/avif",
  "image/gif",
  "image/heic",
  "image/heif",
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
]);

type UploadSurface = "description" | "comment";

export function isSupportedImageFile(file: File) {
  return allowedImageMimeTypes.has(file.type.toLowerCase());
}

export function isSupportedTaskAsset(file: File) {
  return file.size > 0;
}

export function getImageAltText(filename: string) {
  return filename
    .replace(/\.[^/.]+$/, "")
    .replace(/[-_]+/g, " ")
    .trim();
}

export async function uploadTaskImage({
  taskId,
  surface,
  file,
}: {
  taskId: string;
  surface: UploadSurface;
  file: File;
}) {
  if (!isSupportedImageFile(file)) {
    if (!isSupportedTaskAsset(file)) {
      throw new Error("Only non-empty file uploads are supported.");
    }
  }

  const preparedFile = await prepareUploadImage(file);
  const contentType = preparedFile.type || "application/octet-stream";

  const upload = await createImageUpload({
    taskId,
    filename: preparedFile.name || "image",
    contentType,
    size: preparedFile.size,
    surface,
  });

  const response = await fetch(upload.uploadUrl, {
    method: "PUT",
    headers: upload.headers,
    body: preparedFile,
  });

  if (!response.ok) {
    throw new Error("Failed to upload file to storage.");
  }

  const asset = await finalizeImageUpload({
    taskId,
    key: upload.key,
    filename: preparedFile.name || "image",
    contentType,
    size: preparedFile.size,
    surface,
  });

  return {
    url: asset.url,
    alt: getImageAltText(preparedFile.name || "image"),
    filename: preparedFile.name || "file",
    kind: isSupportedImageFile(preparedFile) ? "image" : "attachment",
    mimeType: contentType,
    size: preparedFile.size,
  };
}
