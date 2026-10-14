import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vite-plus/test";
import { uploadTaskImage } from "./upload-task-image";

const mocks = vi.hoisted(() => ({
  createImageUpload: vi.fn(),
  finalizeImageUpload: vi.fn(),
  prepareUploadImage: vi.fn(),
}));

vi.mock("./prepare-upload-image", () => ({
  prepareUploadImage: mocks.prepareUploadImage,
}));

vi.mock("@/fetchers/task/create-image-upload", () => ({
  default: mocks.createImageUpload,
  finalizeImageUpload: mocks.finalizeImageUpload,
}));

describe("uploadTaskImage", () => {
  beforeEach(() => {
    mocks.prepareUploadImage.mockImplementation(async (file: File) => file);
    mocks.createImageUpload.mockResolvedValue({
      key: "task/file.conf",
      uploadUrl: "https://storage.example/upload",
      headers: {},
    });
    mocks.finalizeImageUpload.mockResolvedValue({
      url: "https://storage.example/file.conf",
    });
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true }));
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  it("uses a generic content type when the browser cannot detect one", async () => {
    const file = new File(["server config"], "server.conf");

    const asset = await uploadTaskImage({
      taskId: "task-1",
      surface: "comment",
      file,
    });

    expect(file.type).toBe("");
    expect(mocks.createImageUpload).toHaveBeenCalledWith(
      expect.objectContaining({ contentType: "application/octet-stream" }),
    );
    expect(mocks.finalizeImageUpload).toHaveBeenCalledWith(
      expect.objectContaining({ contentType: "application/octet-stream" }),
    );
    expect(asset.mimeType).toBe("application/octet-stream");
    expect(asset.kind).toBe("attachment");
  });

  it("preserves a browser-provided content type", async () => {
    const file = new File(["image"], "image.png", { type: "image/png" });

    const asset = await uploadTaskImage({
      taskId: "task-1",
      surface: "description",
      file,
    });

    expect(mocks.createImageUpload).toHaveBeenCalledWith(
      expect.objectContaining({ contentType: "image/png" }),
    );
    expect(mocks.finalizeImageUpload).toHaveBeenCalledWith(
      expect.objectContaining({ contentType: "image/png" }),
    );
    expect(asset.mimeType).toBe("image/png");
    expect(asset.kind).toBe("image");
  });

  it("uses the optimized file for signing, upload, finalization and the editor asset", async () => {
    const source = new File(["original screenshot"], "bug.png", {
      type: "image/png",
    });
    const optimized = new File(["webp"], "bug.webp", { type: "image/webp" });
    mocks.prepareUploadImage.mockResolvedValueOnce(optimized);

    const asset = await uploadTaskImage({
      taskId: "task-1",
      surface: "description",
      file: source,
    });

    const metadata = {
      filename: "bug.webp",
      contentType: "image/webp",
      size: optimized.size,
    };
    expect(mocks.createImageUpload).toHaveBeenCalledWith(
      expect.objectContaining(metadata),
    );
    expect(fetch).toHaveBeenCalledWith(
      "https://storage.example/upload",
      expect.objectContaining({ body: optimized }),
    );
    expect(mocks.finalizeImageUpload).toHaveBeenCalledWith(
      expect.objectContaining(metadata),
    );
    expect(asset).toMatchObject({
      filename: "bug.webp",
      mimeType: "image/webp",
      size: optimized.size,
      alt: "bug",
    });
  });
});
