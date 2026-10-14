import { describe, expect, it } from "vite-plus/test";
import { readUploadImageInfo } from "./image-upload-info";

function png(chunks: { name: string; data: number[] }[]) {
  const bytes = [137, 80, 78, 71, 13, 10, 26, 10];
  for (const { name, data } of chunks) {
    bytes.push(
      0,
      0,
      0,
      data.length,
      ...Array.from(name, (c) => c.charCodeAt(0)),
      ...data,
      0,
      0,
      0,
      0,
    );
  }
  return Uint8Array.from(bytes).buffer;
}

const header = [0, 0, 4, 0, 0, 0, 3, 0, 8, 2, 0, 0, 0];

describe("upload image metadata", () => {
  it("reads dimensions without decoding pixels", () => {
    expect(
      readUploadImageInfo(
        png([
          { name: "IHDR", data: header },
          { name: "IDAT", data: [] },
        ]),
        "image/png",
      ),
    ).toEqual({
      width: 1024,
      height: 768,
      animated: false,
      hasAlphaChannel: false,
    });
  });

  it("detects APNG even when the browser labels it image/png", () => {
    expect(
      readUploadImageInfo(
        png([
          { name: "IHDR", data: header },
          { name: "acTL", data: [0, 0, 0, 2, 0, 0, 0, 0] },
          { name: "IDAT", data: [] },
        ]),
        "image/png",
      )?.animated,
    ).toBe(true);
  });

  it("detects palette or color-key transparency", () => {
    expect(
      readUploadImageInfo(
        png([
          { name: "IHDR", data: header },
          { name: "tRNS", data: [0, 0, 0, 0, 0, 0] },
          { name: "IDAT", data: [] },
        ]),
        "image/png",
      )?.hasAlphaChannel,
    ).toBe(true);
  });

  it("keeps high-depth PNGs intact", () => {
    const data = [...header];
    data[8] = 16;
    expect(
      readUploadImageInfo(
        png([
          { name: "IHDR", data },
          { name: "IDAT", data: [] },
        ]),
        "image/png",
      ),
    ).toBeNull();
  });

  it("rejects truncated or oversized chunks", () => {
    const image = png([{ name: "IHDR", data: header }]);
    new DataView(image).setUint32(8, 0xffffffff);
    expect(readUploadImageInfo(image, "image/png")).toBeNull();
  });

  it("reads JPEG dimensions after metadata, including marker padding", () => {
    const bytes = Uint8Array.from([
      255, 216, 255, 255, 224, 0, 4, 1, 2, 255, 192, 0, 8, 8, 3, 0, 4, 0, 0,
    ]);
    expect(readUploadImageInfo(bytes.buffer, "image/jpeg")).toEqual({
      width: 1024,
      height: 768,
      animated: false,
      hasAlphaChannel: false,
    });
  });
});
