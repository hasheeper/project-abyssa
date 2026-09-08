import { resourceUrl } from './resources';

type CachedImage = {promise: Promise<HTMLImageElement>; pixels: number; ready: boolean};
const images = new Map<string, CachedImage>();
const MAX_PIXELS = 32_000_000; // ~128 MiB of decoded RGBA, not hundreds of hidden scene nodes.
const MAX_IMAGES = 48;
function trim() {
  let pixels = [...images.values()].reduce((sum, entry) => sum + entry.pixels, 0);
  for (const [key, entry] of images) {
    if (images.size <= MAX_IMAGES && pixels <= MAX_PIXELS) break;
    if (!entry.ready || images.size === 1) continue;
    pixels -= entry.pixels; images.delete(key);
  }
}
/** A caller may supply its actual DOM image; preload and render then share one decode promise. */
export function loadImage(url: string, element?: HTMLImageElement, alreadyLoaded = false): Promise<HTMLImageElement> {
  const key = resourceUrl(url), cached = images.get(key);
  if (cached) { images.delete(key); images.set(key, cached); return cached.promise; }
  const image = element ?? new Image();
  image.decoding = 'async';
  const entry: CachedImage = {pixels: 0, ready: false, promise: Promise.resolve(image)};
  entry.promise = new Promise<HTMLImageElement>((resolve, reject) => {
    let settled = false;
    const timer = setTimeout(() => finish(new Error(`图片加载超时：${url}`)), 15_000);
    const finish = (error?: Error) => {
      if (settled) return; settled = true; clearTimeout(timer);
      image.removeEventListener('load', loaded); image.removeEventListener('error', failed);
      if (error) { if (images.get(key) === entry) images.delete(key); reject(error); }
      else { entry.ready = true; entry.pixels = image.naturalWidth * image.naturalHeight; trim(); resolve(image); }
    };
    const loaded = () => { void (image.decode?.() ?? Promise.resolve()).then(() => finish(), () => finish(new Error(`图片解码失败：${url}`))); };
    const failed = () => finish(new Error(`图片未能加载：${url}`));
    image.addEventListener('load', loaded, {once: true}); image.addEventListener('error', failed, {once: true});
    if (!element) image.src = key;
    if (alreadyLoaded || image.complete && image.naturalWidth > 0) loaded();
  });
  images.set(key, entry);
  return entry.promise;
}
export function releaseImage(url: string) { images.delete(resourceUrl(url)); }
export async function prepareImages(urls: readonly string[]) {
  let cursor = 0;
  const unique = [...new Set(urls)];
  await Promise.all(Array.from({length: 2}, async () => { while (cursor < unique.length) await loadImage(unique[cursor++]); }));
}
