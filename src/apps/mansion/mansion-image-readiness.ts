/** Unlike the URL preload cache, this barrier checks the actual mounted images.
 * Keep the opaque scene cover until it resolves, including reduced motion. */
export function waitForMansionImages(root: HTMLElement, signal: AbortSignal, timeout = 8000) {
  const controller = new AbortController();
  const cancel = () => controller.abort(signal.reason);
  signal.addEventListener("abort", cancel, { once: true });
  if (signal.aborted) cancel();
  const timer = setTimeout(() => controller.abort(new Error("mansion image readiness timeout")), timeout);
  const images = Array.from(root.querySelectorAll("img"));
  return (async () => {
    try {
      if (!images.length) throw new Error("mansion has no mounted images");
      await Promise.all(images.map(image => decoded(image, controller.signal)));
    } finally {
      clearTimeout(timer);
      signal.removeEventListener("abort", cancel);
      controller.abort();
    }
  })();
}

/** Rendering opportunities are not resource timeouts. A background tab may
 * suspend rAF indefinitely; it must not turn a successful load into an error. */
export async function waitForMansionPaint(signal: AbortSignal) {
  await frame(signal);
  await frame(signal);
}

function decoded(image: HTMLImageElement, signal: AbortSignal) {
  return new Promise<void>((resolve, reject) => {
    let settled = false;
    const finish = (error?: unknown) => {
      if (settled) return;
      settled = true;
      image.removeEventListener("load", loaded);
      image.removeEventListener("error", failed);
      signal.removeEventListener("abort", aborted);
      if (error) reject(error); else resolve();
    };
    const failed = () => finish(new Error(`mansion image unavailable: ${image.currentSrc || image.src}`));
    const aborted = () => finish(signal.reason ?? new Error("mansion image readiness cancelled"));
    const loaded = () => {
      if (!image.naturalWidth || !image.naturalHeight) { failed(); return; }
      // Deliberately do not call loadImage(url, element): a URL cache hit can
      // return a different, detached element's already-resolved decode promise.
      void Promise.resolve().then(() => image.decode?.()).then(() => finish(), failed);
    };
    image.addEventListener("load", loaded, { once: true });
    image.addEventListener("error", failed, { once: true });
    signal.addEventListener("abort", aborted, { once: true });
    if (signal.aborted) aborted();
    else if (image.complete) loaded();
  });
}

function frame(signal: AbortSignal) {
  return new Promise<void>((resolve, reject) => {
    const aborted = () => {
      cancelAnimationFrame(id);
      reject(signal.reason ?? new Error("mansion paint cancelled"));
    };
    const id = requestAnimationFrame(() => {
      signal.removeEventListener("abort", aborted);
      resolve();
    });
    signal.addEventListener("abort", aborted, { once: true });
    if (signal.aborted) aborted();
  });
}
