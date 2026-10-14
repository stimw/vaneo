import { compressUploadImage } from "./compress-upload-image";

self.addEventListener("message", async (event: MessageEvent<File>) => {
  try {
    self.postMessage(await compressUploadImage(event.data));
  } catch {
    self.postMessage(event.data);
  }
});
