import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vite-plus/test";

class TestWorker {
  static instances: TestWorker[] = [];
  onmessage: ((event: { data: File }) => void) | null = null;
  onerror: (() => void) | null = null;
  onmessageerror: (() => void) | null = null;
  postMessage = vi.fn();
  terminate = vi.fn();
  constructor() {
    TestWorker.instances.push(this);
  }
}

const source = () =>
  new File([new Uint8Array(128 * 1024)], "image.png", { type: "image/png" });

describe("upload compression workers", () => {
  beforeEach(() => {
    vi.resetModules();
    TestWorker.instances = [];
    vi.stubGlobal("Worker", TestWorker);
    vi.stubGlobal("OffscreenCanvas", class {});
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it("serializes simultaneous uploads and terminates workers after each image", async () => {
    const { prepareUploadImage } = await import("./prepare-upload-image");
    const first = prepareUploadImage(source());
    const second = prepareUploadImage(source());
    await vi.waitFor(() => expect(TestWorker.instances).toHaveLength(1));
    const optimized = new File(["webp"], "image.webp", { type: "image/webp" });
    TestWorker.instances[0]!.onmessage!({ data: optimized });
    expect(await first).toBe(optimized);
    expect(TestWorker.instances[0]!.terminate).toHaveBeenCalledOnce();
    await vi.waitFor(() => expect(TestWorker.instances).toHaveLength(2));
    TestWorker.instances[1]!.onmessage!({ data: optimized });
    await second;
    expect(TestWorker.instances[1]!.terminate).toHaveBeenCalledOnce();
  });

  it("keeps the original on worker failure", async () => {
    const { prepareUploadImage } = await import("./prepare-upload-image");
    const file = source();
    const result = prepareUploadImage(file);
    await vi.waitFor(() => expect(TestWorker.instances).toHaveLength(1));
    TestWorker.instances[0]!.onerror!();
    expect(await result).toBe(file);
    expect(TestWorker.instances[0]!.terminate).toHaveBeenCalledOnce();
  });

  it.each([undefined, false])(
    "terminates a cancelled job with reason %s",
    async (reason) => {
      const { prepareUploadImage } = await import("./prepare-upload-image");
      const controller = new AbortController();
      const result = prepareUploadImage(source(), controller.signal);
      const rejected = result.catch((error: unknown) => error);
      await vi.waitFor(() => expect(TestWorker.instances).toHaveLength(1));
      controller.abort(reason);
      expect(await rejected).toBe(controller.signal.reason);
      expect(TestWorker.instances[0]!.terminate).toHaveBeenCalledOnce();
    },
  );

  it("times out a stuck encoder and releases the queue", async () => {
    vi.useFakeTimers();
    const { prepareUploadImage } = await import("./prepare-upload-image");
    const file = source();
    const result = prepareUploadImage(file);
    await vi.advanceTimersByTimeAsync(20_000);
    expect(await result).toBe(file);
    expect(TestWorker.instances[0]!.terminate).toHaveBeenCalledOnce();
  });
});
