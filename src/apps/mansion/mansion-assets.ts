import { loadImage } from "../../shared/loading/images";
import type { MansionLayer, MansionPsdManifest } from "../../shared/domain/mansion/regions";
import { MANSION_WORLD_HEIGHT, MANSION_WORLD_WIDTH, type MansionPhaseId } from "./data";
import { paintMansionScenery, scenerySurface } from "./mansion-scenery";
import { mansionWeatherSeed } from "./mansion-cloud-texture";
import { prepareMansionSkyMotion, type MansionSkyMotion } from "./mansion-sky-motion";
import type { MansionWeather } from "./mansion-weather";

/** Same offline material pass as the manifest layers, including transparent
 * glazing. Keep fallback and room thumbnails from reintroducing daytime panes. */
export const MANSION_COMPOSITE_FILE = "composite-materials-v1.png";
export const MANSION_MANIFEST_FILE = "manifest-materials-v1.json";

export type MansionArtwork = {
  image: HTMLImageElement;
  phase: MansionPhaseId;
  weather?: MansionWeather;
  kind: "layers" | "fallback";
  sky?: MansionSkyMotion;
  dispose: () => void;
};

/** Effect replay (Fast Refresh / StrictMode) is not necessarily an unmount.
 * Give the leaf's layout effect a chance to reattach the prepared image before
 * retiring its URL. A genuinely removed or replaced image is still released. */
export function retireMansionArtwork(artwork: MansionArtwork | null) {
  if (!artwork) return;
  queueMicrotask(() => { if (!artwork.image.isConnected) artwork.dispose(); });
}
const within = async <T,>(task: Promise<T>, ms: number): Promise<T> => {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([task, new Promise<never>((_, reject) => { timer = setTimeout(() => reject(new Error("mansion readiness timeout")), ms); })]);
  } finally { clearTimeout(timer); }
};

/** Cache metadata, not a hidden mounted world. Decodes use the shared bounded LRU.
 * Each visit checks readiness again, including images evicted since the last visit. */
export function createMansionAssetLoader(
  fetchManifest = (url: string, signal: AbortSignal) => fetch(url, {signal}),
  decode = (url: string) => loadImage(url),
  base = `${import.meta.env.BASE_URL}mansion-map/`
) {
  let manifest: Promise<MansionPsdManifest> | undefined;
  const readManifest = () => manifest ??= (async () => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 8000);
    try {
      const response = await within(fetchManifest(`${base}${MANSION_MANIFEST_FILE}`, controller.signal), 8000);
      if (!response.ok) throw Error("mansion manifest");
      const data = await within(response.json(), 8000) as MansionPsdManifest;
      if (data.width !== MANSION_WORLD_WIDTH || data.height !== MANSION_WORLD_HEIGHT || !Array.isArray(data.layers) || !data.layers.some(l => l.visible)) throw Error("mansion dimensions");
      const ids = new Set<string>();
      for (const l of data.layers) {
        if (ids.has(l.id) || !/^layers\/[\w.-]+\.png$/.test(l.src) || ![l.x,l.y,l.width,l.height,l.order,l.opacity].every(Number.isFinite)) throw Error("mansion layer");
        ids.add(l.id);
      }
      return data;
    } finally { clearTimeout(timer); }
  })().catch(error => { manifest = undefined; throw error; });
  return async (signal: AbortSignal, phase: MansionPhaseId, weather:MansionWeather="clear"): Promise<MansionArtwork> => {
    let loading = true;
    try {
      const data = await readManifest();
      const layers = data.layers.filter(l => l.visible).sort((a, b) => a.order - b.order);
      const sources: HTMLImageElement[] = [];
      let cursor = 0;
      await within(Promise.all(Array.from({length: 4}, async () => {
        while (loading && !signal.aborted && cursor < layers.length) {
          const index = cursor++;
          sources[index] = await decode(`${base}${layers[index].src}`);
        }
      })), 8000);
      signal.throwIfAborted();
      return await composeMansionArtwork(layers, sources, phase, signal,weather);
    } catch {
      loading = false;
      signal.throwIfAborted();
      const source = await within(decode(`${base}${MANSION_COMPOSITE_FILE}`), 8000);
      signal.throwIfAborted();
      return composeMansionArtwork(null, [source], phase, signal,weather);
    } finally { loading = false; }
  };
}

export const prepareMansionAssets = createMansionAssetLoader();

/** Encoding is an actual pixel-completion boundary, unlike two animation
 * frames or a data-ready flag on a GPU-backed canvas. Both work surfaces are
 * released before the fully decoded, opaque scene image is published. */
export async function composeMansionArtwork(
  layers: readonly MansionLayer[] | null,
  sources: readonly HTMLImageElement[],
  phase: MansionPhaseId,
  signal: AbortSignal,
  weather:MansionWeather="clear"
): Promise<MansionArtwork> {
  signal.throwIfAborted();
  if (!sources.length || layers && sources.length !== layers.length) throw Error("mansion artwork unavailable");
  const building = scenerySurface();
  let scene: ReturnType<typeof scenerySurface> | undefined;
  let url: string | undefined;
  let sky:MansionSkyMotion|undefined;
  try {
    const {ctx, canvas} = building;
    if (layers) layers.forEach((layer, index) => {
      ctx.globalAlpha = layer.opacity;
      ctx.drawImage(sources[index], layer.x, layer.y, layer.width, layer.height);
    });
    else ctx.drawImage(sources[0], 0, 0, canvas.width, canvas.height);
    ctx.globalAlpha = 1;
    scene = scenerySurface(MANSION_WORLD_WIDTH, MANSION_WORLD_HEIGHT, true);
    const weatherSeed=mansionWeatherSeed();
    paintMansionScenery(scene.ctx,canvas,phase,weatherSeed,weather);
    const blob = await within(new Promise<Blob>((resolve,reject) => {
      scene!.canvas.toBlob(result => result ? resolve(result) : reject(Error("mansion scene encoding failed")), "image/png");
    }), 8000);
    signal.throwIfAborted();
    url = URL.createObjectURL(blob);
    const image = new Image();
    image.className = "mansion-world-art";
    image.alt = ""; image.draggable = false;
    image.dataset.phase = phase;image.dataset.weather=weather;
    image.setAttribute("aria-hidden", "true");
    image.src = url;
    await within(image.decode(), 8000);
    signal.throwIfAborted();
    if(window.matchMedia && !window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      try {sky=await prepareMansionSkyMotion(canvas,phase,weatherSeed,signal,weather);}
      catch {signal.throwIfAborted();} // A decorative failure keeps the complete static scene.
    }
    signal.throwIfAborted();
    const ownedUrl = url;
    let disposed = false;
    return {image, sky, phase, weather, kind: layers ? "layers" : "fallback", dispose: () => {
      if (disposed) return;
      disposed = true;
      sky?.dispose();
      image.remove(); image.removeAttribute("src"); URL.revokeObjectURL(ownedUrl);
    }};
  } catch (error) {
    sky?.dispose();
    if (url) URL.revokeObjectURL(url);
    throw error;
  } finally {
    building.canvas.width = building.canvas.height = 0;
    if (scene) scene.canvas.width = scene.canvas.height = 0;
  }
}
