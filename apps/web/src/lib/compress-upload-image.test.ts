import { Blob, File } from "node:buffer";
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vite-plus/test";
import { compressUploadImage } from "./compress-upload-image";

const { compress } = vi.hoisted(() => ({ compress: vi.fn() }));
vi.mock("compresso.js", () => ({ compress }));

function image(type = "image/png", colorType = 2, width = 1024, height = 768) {
  const bytes = new Uint8Array(128 * 1024);
  if (type === "image/png") {
    bytes.set([137, 80, 78, 71, 13, 10, 26, 10]);
    const view = new DataView(bytes.buffer);
    view.setUint32(8, 13);
    bytes.set([73, 72, 68, 82], 12);
    view.setUint32(16, width);
    view.setUint32(20, height);
    bytes[24] = 8;
    bytes[25] = colorType;
    bytes.set([73, 68, 65, 84], 37);
  } else {
    bytes.set([
      255,
      216,
      255,
      192,
      0,
      8,
      8,
      height >> 8,
      height & 255,
      width >> 8,
      width & 255,
      0,
    ]);
  }
  return new File([bytes], `test.${type === "image/png" ? "png" : "jpg"}`, {
    type,
    lastModified: 123,
  });
}

describe("upload image compression policy", () => {
  let webp: boolean;

  beforeEach(() => {
    webp = true;
    vi.stubGlobal("File", File);
    vi.stubGlobal("Blob", Blob);
    vi.stubGlobal(
      "OffscreenCanvas",
      class {
        constructor(
          public width: number,
          public height: number,
        ) {}
        convertToBlob() {
          return Promise.resolve(
            new Blob(["probe"], { type: webp ? "image/webp" : "image/png" }),
          );
        }
        getContext() {
          return { fillRect: vi.fn() };
        }
      },
    );
    vi.stubGlobal("createImageBitmap", undefined);
    vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:source");
    vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => {});
    compress.mockImplementation(async (_source, options) => ({
      blob: new Blob(["compressed image"], { type: `image/${options.format}` }),
      url: "blob:result",
    }));
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    vi.clearAllMocks();
  });

  it("uses lossy WebP for PNGs without shrinking or fitting their quality to a size target", async () => {
    const source = image();
    const result = await compressUploadImage(source as globalThis.File);
    expect(result.name).toBe("test.webp");
    expect(result.type).toBe("image/webp");
    expect(result.lastModified).toBe(123);
    expect(compress).toHaveBeenCalledWith(
      "blob:source",
      expect.objectContaining({
        quality: 0.8,
        maxWidth: Infinity,
        maxHeight: Infinity,
        maxSizeMB: Infinity,
      }),
    );
    expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:source");
    expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:result");
  });

  it.each([
    { lossy: 20, maximum: 100, expected: 20 },
    { lossy: 100, maximum: 20, expected: 20 },
  ])(
    "keeps the smaller PNG encoding: %j",
    async ({ lossy, maximum, expected }) => {
      compress
        .mockResolvedValueOnce({
          blob: new Blob([new Uint8Array(lossy)], { type: "image/webp" }),
          url: "blob:lossy",
        })
        .mockResolvedValueOnce({
          blob: new Blob([new Uint8Array(maximum)], { type: "image/webp" }),
          url: "blob:maximum",
        });
      const result = await compressUploadImage(image() as globalThis.File);
      expect(result.size).toBe(expected);
      expect(compress.mock.calls.map(([, options]) => options.quality)).toEqual(
        [0.8, 1],
      );
      expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:lossy");
      expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:maximum");
    },
  );

  it("retains a valid lossy result if the maximum-quality attempt fails", async () => {
    compress
      .mockResolvedValueOnce({
        blob: new Blob(["lossy image"], { type: "image/webp" }),
        url: "blob:lossy",
      })
      .mockRejectedValueOnce(new Error("Maximum-quality encoding failed"));
    const result = await compressUploadImage(image() as globalThis.File);
    expect(result.type).toBe("image/webp");
    expect(await result.text()).toBe("lossy image");
    expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:lossy");
  });

  it("ignores a smaller candidate with an incorrect actual format", async () => {
    compress
      .mockResolvedValueOnce({
        blob: new Blob(["lossy image"], { type: "image/webp" }),
        url: "blob:lossy",
      })
      .mockResolvedValueOnce({
        blob: new Blob(["png"], { type: "image/png" }),
        url: "blob:maximum",
      });
    const result = await compressUploadImage(image() as globalThis.File);
    expect(result.type).toBe("image/webp");
    expect(await result.text()).toBe("lossy image");
    expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:maximum");
  });

  it("uses high-quality JPEG for opaque Safari screenshots", async () => {
    webp = false;
    const result = await compressUploadImage(image() as globalThis.File);
    expect(result.type).toBe("image/jpeg");
    expect(result.name).toBe("test.jpg");
    expect(compress).toHaveBeenCalledWith(
      "blob:source",
      expect.objectContaining({
        quality: 0.92,
        maxWidth: Infinity,
        maxHeight: Infinity,
      }),
    );
  });

  it("keeps alpha-capable images as PNG when transparency cannot be inspected", async () => {
    webp = false;
    const result = await compressUploadImage(
      image("image/png", 6) as globalThis.File,
    );
    expect(result.type).toBe("image/png");
  });

  it.each([false, true])(
    "inspects every alpha band before choosing Safari's format (transparent: %s)",
    async (transparent) => {
      webp = false;
      const close = vi.fn();
      vi.stubGlobal(
        "createImageBitmap",
        vi.fn().mockResolvedValue({
          width: 2,
          height: 130,
          close,
        }),
      );
      vi.stubGlobal(
        "OffscreenCanvas",
        class {
          constructor(
            public width: number,
            public height: number,
          ) {}
          convertToBlob() {
            return Promise.resolve(new Blob(["probe"], { type: "image/png" }));
          }
          getContext() {
            return {
              fillRect: vi.fn(),
              clearRect: vi.fn(),
              drawImage: vi.fn(),
              getImageData: (
                _x: number,
                _y: number,
                width: number,
                rows: number,
              ) => {
                const data = new Uint8ClampedArray(width * rows * 4).fill(255);
                if (transparent && rows === 2) data[data.length - 1] = 254;
                return { data };
              },
            };
          }
        },
      );
      const result = await compressUploadImage(
        image("image/png", 6, 2, 130) as globalThis.File,
      );
      expect(result.type).toBe(transparent ? "image/png" : "image/jpeg");
      expect(close).toHaveBeenCalledOnce();
    },
  );

  it("bounds photo resolution separately from screenshots", async () => {
    await compressUploadImage(
      image("image/jpeg", 2, 6000, 4000) as globalThis.File,
    );
    expect(compress).toHaveBeenCalledWith(
      "blob:source",
      expect.objectContaining({
        quality: 0.85,
        maxWidth: 2560,
        maxHeight: 2560,
      }),
    );
  });

  it("retains the original if encoding returns a larger file or the wrong actual format", async () => {
    const source = image("image/jpeg") as globalThis.File;
    compress.mockResolvedValueOnce({
      blob: new Blob([new Uint8Array(source.size + 1)], { type: "image/webp" }),
      url: "blob:result",
    });
    expect(await compressUploadImage(source)).toBe(source);
    compress.mockResolvedValueOnce({
      blob: new Blob(["png"], { type: "image/png" }),
      url: "blob:result",
    });
    expect(await compressUploadImage(source)).toBe(source);
  });

  it("retains unsupported formats, small files, animated PNGs and oversized dimensions", async () => {
    const animated = image();
    const bytes = new Uint8Array(await animated.arrayBuffer());
    new DataView(bytes.buffer).setUint32(33, 8);
    bytes.set([97, 99, 84, 76], 37);
    bytes.set([73, 68, 65, 84], 57);
    const files = [
      new File(["small"], "small.png", { type: "image/png" }),
      new File([new Uint8Array(128 * 1024)], "animation.gif", {
        type: "image/gif",
      }),
      new File([bytes], "animation.png", { type: "image/png" }),
      image("image/png", 2, 100000, 100000),
    ];
    for (const file of files)
      expect(await compressUploadImage(file as globalThis.File)).toBe(file);
    expect(compress).not.toHaveBeenCalled();
  });

  it("falls back on compression errors but propagates cancellation", async () => {
    const source = image() as globalThis.File;
    compress.mockRejectedValueOnce(new Error("Decode failed"));
    expect(await compressUploadImage(source)).toBe(source);
    const controller = new AbortController();
    compress.mockImplementationOnce(() => {
      controller.abort();
      return Promise.reject(controller.signal.reason);
    });
    await expect(
      compressUploadImage(source, controller.signal),
    ).rejects.toMatchObject({ name: "AbortError" });
  });
});
