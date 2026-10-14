// HEIC uploads retain their original bytes. Compresso still declares dynamic
// decoder imports; resolve them here instead of shipping its optional WASM.
export function heicTo(): never {
  throw new Error("HEIC optimization is not enabled.");
}
