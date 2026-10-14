export type UploadImageInfo = {
  width: number;
  height: number;
  animated: boolean;
  hasAlphaChannel: boolean;
};

const pngSignature = [137, 80, 78, 71, 13, 10, 26, 10];

export function readUploadImageInfo(
  buffer: ArrayBuffer,
  type: string,
): UploadImageInfo | null {
  const bytes = new Uint8Array(buffer);
  const view = new DataView(buffer);

  if (type === "image/png") {
    if (
      bytes.length < 33 ||
      pngSignature.some((byte, index) => bytes[index] !== byte)
    ) {
      return null;
    }
    let info: UploadImageInfo | null = null;
    for (let offset = 8; offset + 12 <= bytes.length;) {
      const length = view.getUint32(offset);
      const end = offset + 12 + length;
      if (end > bytes.length) return null;
      const chunk = String.fromCharCode(
        ...bytes.subarray(offset + 4, offset + 8),
      );
      if (chunk === "IHDR") {
        // Keep high-depth PNGs intact instead of reducing them to Canvas's 8 bits.
        if (offset !== 8 || length !== 13 || bytes[offset + 16]! > 8)
          return null;
        const colorType = bytes[offset + 17];
        if (![0, 2, 3, 4, 6].includes(colorType!)) return null;
        info = {
          width: view.getUint32(offset + 8),
          height: view.getUint32(offset + 12),
          animated: false,
          hasAlphaChannel: colorType === 4 || colorType === 6,
        };
      } else if (info && chunk === "acTL") {
        info.animated = true;
      } else if (info && chunk === "tRNS") {
        info.hasAlphaChannel = true;
      } else if (chunk === "IDAT") {
        // APNG's animation control and PNG transparency precede image data.
        return info;
      }
      offset = end;
    }
    return null;
  }

  if (type !== "image/jpeg" && type !== "image/jpg") return null;
  if (bytes.length < 4 || bytes[0] !== 255 || bytes[1] !== 216) return null;
  for (let offset = 2; offset + 4 <= bytes.length;) {
    if (bytes[offset] !== 255) return null;
    const marker = bytes[offset + 1]!;
    if (marker === 255) {
      offset += 1;
      continue;
    }
    if (marker === 218 || marker === 217) return null;
    if (marker === 1 || marker === 216 || (marker >= 208 && marker <= 215)) {
      offset += 2;
      continue;
    }
    const length = view.getUint16(offset + 2);
    if (length < 2 || offset + 2 + length > bytes.length) return null;
    if (marker >= 192 && marker <= 207 && ![196, 200, 204].includes(marker)) {
      if (length < 8) return null;
      return {
        width: view.getUint16(offset + 7),
        height: view.getUint16(offset + 5),
        animated: false,
        hasAlphaChannel: false,
      };
    }
    offset += 2 + length;
  }
  return null;
}
