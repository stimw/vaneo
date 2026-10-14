import {
  beforeEach,
  afterEach,
  describe,
  expect,
  it,
  vi,
} from "vite-plus/test";
import { uploadDraftAsset } from "./upload-draft-asset";

const mocks = vi.hoisted(() => ({
  prepare: vi.fn(),
  sign: vi.fn(),
  finalize: vi.fn(),
}));
vi.mock("./prepare-upload-image", () => ({
  prepareUploadImage: mocks.prepare,
}));
vi.mock("@kaneo/libs", () => ({
  client: {
    task: {
      "draft-upload": {
        ":projectId": {
          $post: mocks.sign,
          finalize: { $post: mocks.finalize },
        },
      },
    },
  },
}));

describe("draft asset compression", () => {
  beforeEach(() => {
    mocks.sign.mockResolvedValue({
      ok: true,
      json: async () => ({
        key: "draft/key",
        uploadUrl: "https://storage.example/draft",
        headers: { "Content-Type": "image/jpeg" },
      }),
    });
    mocks.finalize.mockResolvedValue({
      ok: true,
      json: async () => ({ id: "asset-1", url: "https://api.example/asset-1" }),
    });
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true }));
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  it("stages only the optimized bytes and matching metadata before a task exists", async () => {
    const original = new File(["original screenshot"], "bug.png", {
      type: "image/png",
    });
    const optimized = new File(["jpeg"], "bug.jpg", { type: "image/jpeg" });
    mocks.prepare.mockResolvedValue(optimized);

    const result = await uploadDraftAsset("project-1", original);

    const metadata = {
      filename: "bug.jpg",
      contentType: "image/jpeg",
      size: optimized.size,
      surface: "description",
    };
    expect(mocks.sign).toHaveBeenCalledWith({
      param: { projectId: "project-1" },
      json: metadata,
    });
    expect(fetch).toHaveBeenCalledWith(
      "https://storage.example/draft",
      expect.objectContaining({ body: optimized }),
    );
    expect(mocks.finalize).toHaveBeenCalledWith({
      param: { projectId: "project-1" },
      json: { ...metadata, key: "draft/key" },
    });
    expect(result).toMatchObject({
      id: "asset-1",
      filename: "bug.jpg",
      mimeType: "image/jpeg",
      size: optimized.size,
      kind: "image",
    });
  });
});
