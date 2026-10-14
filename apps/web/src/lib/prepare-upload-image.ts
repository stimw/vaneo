import { shouldCompressUploadImage } from "./upload-image-policy";

const COMPRESSION_TIMEOUT_MS = 20_000;
let pendingCompression: Promise<unknown> = Promise.resolve();

async function prepareImage(file: File, signal?: AbortSignal): Promise<File> {
  signal?.throwIfAborted();
  if (typeof Worker === "undefined" || typeof OffscreenCanvas === "undefined") {
    const { compressUploadImage } = await import("./compress-upload-image");
    return compressUploadImage(file, signal);
  }

  try {
    return await new Promise<File>((resolve, reject) => {
      const worker = new Worker(
        new URL("./upload-image.worker.ts", import.meta.url),
        {
          type: "module",
        },
      );
      const finish = (result: File, error?: unknown) => {
        clearTimeout(timeout);
        signal?.removeEventListener("abort", abort);
        worker.terminate();
        if (error !== undefined) reject(error);
        else resolve(result);
      };
      const abort = () => finish(file, signal?.reason);
      const timeout = setTimeout(() => finish(file), COMPRESSION_TIMEOUT_MS);
      worker.onmessage = (event: MessageEvent<File>) => {
        finish(event.data instanceof File ? event.data : file);
      };
      worker.onerror = () => finish(file);
      worker.onmessageerror = () => finish(file);
      signal?.addEventListener("abort", abort, { once: true });
      worker.postMessage(file);
    });
  } catch {
    signal?.throwIfAborted();
    return file;
  }
}

export async function prepareUploadImage(file: File, signal?: AbortSignal) {
  signal?.throwIfAborted();
  if (!shouldCompressUploadImage(file)) return file;

  // One decoded image at a time bounds memory, including simultaneous uploads
  // from different editors. Each worker is terminated to release its bitmaps.
  const job = pendingCompression.then(() => prepareImage(file, signal));
  pendingCompression = job.catch(() => undefined);
  return job;
}
