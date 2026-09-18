import { afterEach, beforeEach, expect, it, vi } from "vitest";
import type { MansionLayer } from "../../shared/domain/mansion/regions";
import { composeMansionArtwork, createMansionAssetLoader, MANSION_COMPOSITE_FILE, retireMansionArtwork } from "./mansion-assets";

const contexts: Array<{canvas: HTMLCanvasElement; drawImage: ReturnType<typeof vi.fn>}> = [];
const revoke = vi.fn();
beforeEach(() => {
  contexts.length = 0;
  vi.stubGlobal("URL", class extends URL {
    static createObjectURL = vi.fn(() => "blob:scenery");
    static revokeObjectURL = revoke;
  });
  revoke.mockClear();
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockImplementation(function(this: HTMLCanvasElement) {
    const gradient = () => ({addColorStop: vi.fn()});
    const ctx = {canvas:this, drawImage:vi.fn(), save:vi.fn(), restore:vi.fn(), fillRect:vi.fn(),
      beginPath:vi.fn(), rect:vi.fn(), moveTo:vi.fn(), lineTo:vi.fn(), closePath:vi.fn(), clip:vi.fn(), translate:vi.fn(), scale:vi.fn(),
      arc:vi.fn(), fill:vi.fn(), bezierCurveTo:vi.fn(),
      createImageData:(w:number,h:number)=>({data:new Uint8ClampedArray(w*h*4)}), putImageData:vi.fn(),
      getImageData:(_x:number,_y:number,w:number,h:number)=>({data:new Uint8ClampedArray(w*h*4)}),
      createLinearGradient:gradient, createRadialGradient:gradient};
    contexts.push(ctx);
    return ctx as unknown as CanvasRenderingContext2D;
  });
  vi.spyOn(HTMLCanvasElement.prototype,"toBlob").mockImplementation(callback => callback(new Blob(["complete pixels"])));
  Object.defineProperty(HTMLImageElement.prototype,"decode",{configurable:true,value:vi.fn().mockResolvedValue(undefined)});
});
afterEach(() => {vi.restoreAllMocks(); vi.unstubAllGlobals();});
const layers = [2,21].map(order => ({id:`layer-${order}`,src:`layers/layer-${order}.png`,order,opacity:1,
  x:0,y:0,width:100,height:100,visible:true,name:"test"})) satisfies MansionLayer[];
const source = () => document.createElement("img");

it("does not destroy a displayed image when React replays effects", async () => {
  const result = await composeMansionArtwork(null,[source()],"night",new AbortController().signal);
  // Effect cleanup sees it detached, then the new layout effect reattaches it.
  retireMansionArtwork(result);
  document.body.append(result.image);
  await Promise.resolve();
  expect(revoke).not.toHaveBeenCalled();
  expect(result.image.getAttribute("src")).toBe("blob:scenery");
  result.image.remove();
  retireMansionArtwork(result);
  await Promise.resolve();
  expect(revoke).toHaveBeenCalledOnce();
});

it("publishes only after encoding AND image decoding, then releases every work canvas", async () => {
  let encoded!: BlobCallback, decoded!: () => void;
  vi.mocked(HTMLCanvasElement.prototype.toBlob).mockImplementation(callback => { encoded = callback; });
  vi.mocked(HTMLImageElement.prototype.decode).mockImplementation(() => new Promise(resolve => { decoded = resolve; }));
  const published = vi.fn();
  const task = composeMansionArtwork(layers,[source(),source()],"night",new AbortController().signal).then(result => {published(); return result;});
  expect(published).not.toHaveBeenCalled();
  encoded(new Blob(["pixels"]));
  await vi.waitFor(() => expect(HTMLImageElement.prototype.decode).toHaveBeenCalledOnce());
  expect(published).not.toHaveBeenCalled();
  decoded();
  const result = await task;
  expect(result.image.tagName).toBe("IMG");
  expect(result.phase).toBe("night");
  expect(result.image.dataset.phase).toBe("night");
  expect(HTMLCanvasElement.prototype.getContext).toHaveBeenCalledWith("2d",{alpha:false,willReadFrequently:true});
  expect(contexts.every(c => c.canvas.width === 0 && c.canvas.height === 0)).toBe(true);
  expect(result.image.isConnected).toBe(false);
  expect(revoke).not.toHaveBeenCalled();
  result.dispose(); result.dispose();
  expect(revoke).toHaveBeenCalledExactlyOnceWith("blob:scenery");
});

it("cancellation during decode never publishes an image or leaks its blob URL", async () => {
  const controller = new AbortController();
  let decoded!: () => void;
  vi.mocked(HTMLImageElement.prototype.decode).mockImplementation(() => new Promise(resolve => {decoded=resolve;}));
  const pending = composeMansionArtwork(null,[source()],"day",controller.signal);
  const rejected = expect(pending).rejects.toBeDefined();
  await vi.waitFor(() => expect(HTMLImageElement.prototype.decode).toHaveBeenCalledOnce());
  controller.abort(); decoded();
  await rejected;
  expect(revoke).toHaveBeenCalledOnce();
  expect(contexts.every(c => c.canvas.width === 0)).toBe(true);
});

it("does not draw any building until all layers have decoded", async () => {
  let finish!: (image:HTMLImageElement) => void;
  const fetchManifest = vi.fn().mockResolvedValue({ok:true,json:async()=>({width:5162,height:1910,layers})});
  const decode = vi.fn().mockResolvedValueOnce(source()).mockImplementationOnce(() => new Promise(resolve => {finish=resolve;}));
  const prepare = createMansionAssetLoader(fetchManifest,decode,"/mansion-map/");
  const task = prepare(new AbortController().signal,"dawn");
  await vi.waitFor(() => expect(decode).toHaveBeenCalledTimes(2));
  expect(contexts).toHaveLength(0);
  finish(source());
  const result = await task;
  expect(contexts[0].drawImage).toHaveBeenCalledTimes(2);
  expect(fetchManifest).toHaveBeenCalledWith("/mansion-map/manifest-materials-v1.json", expect.any(AbortSignal));
  expect(result.phase).toBe("dawn");
  expect(result.kind).toBe("layers");
  result.dispose();
});

it("prepares the same phase from the composite fallback when a layer fails", async () => {
  const fetchManifest = vi.fn().mockResolvedValue({ok:true,json:async()=>({width:5162,height:1910,layers})});
  const decode = vi.fn(async (url:string) => {
    if (url.endsWith(MANSION_COMPOSITE_FILE)) return source();
    throw Error("missing layer");
  });
  const result = await createMansionAssetLoader(fetchManifest,decode)(new AbortController().signal,"dusk","rain");
  expect(result.kind).toBe("fallback");
  expect(result.phase).toBe("dusk");
  expect(result.weather).toBe("rain");
  expect(result.image.dataset.weather).toBe("rain");
  expect(decode).toHaveBeenCalledWith(expect.stringContaining("composite-materials-v1.png"));
  result.dispose();
});

it("prepares decoded sky-only decoration and releases its images, listeners and work surfaces", async () => {
  vi.stubGlobal("matchMedia",vi.fn(()=>({matches:false})));
  let id=0;
  vi.mocked(URL.createObjectURL).mockImplementation(()=>`blob:prepared-${id++}`);
  const add=vi.spyOn(document,"addEventListener"),remove=vi.spyOn(document,"removeEventListener");
  const result=await composeMansionArtwork(null,[source()],"day",new AbortController().signal);
  expect(result.sky).toBeDefined();
  expect(HTMLImageElement.prototype.decode).toHaveBeenCalledTimes(3);
  expect(result.sky!.element.querySelectorAll("image")).toHaveLength(2);
  expect(result.sky!.element.querySelector(".mansion-sky-clouds")?.getAttribute("href")).toBe("blob:prepared-2");
  expect(contexts.every(c=>c.canvas.width===0 && c.canvas.height===0)).toBe(true);
  const cleanup=result.sky!.mount();
  const listener=add.mock.calls.find(([event])=>event==="visibilitychange")?.[1];
  expect(listener).toBeDefined();
  result.dispose();cleanup();result.dispose();
  expect(remove).toHaveBeenCalledWith("visibilitychange",listener);
  expect(revoke.mock.calls.flat().sort()).toEqual(["blob:prepared-0","blob:prepared-1","blob:prepared-2"]);
  expect(result.sky!.element.querySelectorAll("image[href]")).toHaveLength(0);
});

it("keeps the complete static scene if a decorative cloud decoder fails", async () => {
  vi.stubGlobal("matchMedia",vi.fn(()=>({matches:false})));
  let id=0;
  vi.mocked(URL.createObjectURL).mockImplementation(()=>`blob:prepared-${id++}`);
  vi.mocked(HTMLImageElement.prototype.decode)
    .mockResolvedValueOnce(undefined).mockResolvedValueOnce(undefined).mockRejectedValueOnce(Error("cloud decode failed"));
  const result=await composeMansionArtwork(null,[source()],"night",new AbortController().signal);
  expect(result.sky).toBeUndefined();
  expect(result.image.getAttribute("src")).toBe("blob:prepared-0");
  expect(revoke.mock.calls.flat().sort()).toEqual(["blob:prepared-1","blob:prepared-2"]);
  expect(contexts.every(c=>c.canvas.width===0 && c.canvas.height===0)).toBe(true);
  result.dispose();
  expect(revoke).toHaveBeenCalledTimes(3);
});

it("does not prepare optional motion when reduced motion is requested", async () => {
  vi.stubGlobal("matchMedia",vi.fn(()=>({matches:true})));
  const result=await composeMansionArtwork(null,[source()],"dusk",new AbortController().signal);
  expect(result.sky).toBeUndefined();
  expect(HTMLImageElement.prototype.decode).toHaveBeenCalledOnce();
  result.dispose();
});
