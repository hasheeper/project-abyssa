import { MANSION_WORLD_WIDTH as W, MANSION_WORLD_HEIGHT as H, type MansionPhaseId } from "./data";
import { mansionDayCloudRaster } from "./mansion-day-clouds";
import { mansionNightCloudRaster } from "./mansion-night-clouds";
import { MANSION_ATMOSPHERE, paintMansionAtmosphereShade, paintMansionSkyBase, scenerySurface } from "./mansion-scenery";
import type { MansionWeather } from "./mansion-weather";
import { mansionRainPaths } from "./mansion-rain";

const SKY_HEIGHT=1100,OVERSCAN=320,NS="http://www.w3.org/2000/svg";
let identity=0;
export type MansionSkyMotion={element:SVGSVGElement;mount:()=>()=>void;dispose:()=>void};

/** Only open sky ABOVE the first illustrated edge of each column is movable.
 * Glass, lookout openings and interiors remain in the stable opaque base art.
 * This is a vector clip, not a GPU mask/blur over the world or its UI. */
export function mansionSkyClipPath(data:Uint8ClampedArray,width=W,height=SKY_HEIGHT) {
  const edge:Array<[number,number]>=[];
  for(let x=0;x<width;x+=2) {
    let top=height;
    for(let y=0;y<height;y++) {
      if(data[(y*width+x)*4+3]>4 || (x+1<width && data[(y*width+x+1)*4+3]>4)) {top=Math.max(0,y-1);break;}
    }
    if(edge.length>1 && edge.at(-1)![1]===top && edge.at(-2)![1]===top)edge[edge.length-1]=[x,top];
    else edge.push([x,top]);
  }
  edge.push([width,edge.at(-1)?.[1]??height]);
  return `M0 0H${width}`+edge.reverse().map(([x,y])=>`L${x} ${y}`).join("")+"Z";
}

function svg<K extends keyof SVGElementTagNameMap>(name:K,attrs:Record<string,string>) {
  const node=document.createElementNS(NS,name);
  for(const [key,value] of Object.entries(attrs))node.setAttribute(key,value);
  return node;
}
function tintChannels(tint:string) {
  const values=tint.match(/[\d.]+/g)?.map(Number);
  if(!values || values.length!==4)return [1,1,1];
  return values.slice(0,3).map(value=>1-values[3]+values[3]*value/255);
}
async function decodedUrl(canvas:HTMLCanvasElement,signal:AbortSignal) {
  let timer:ReturnType<typeof setTimeout>|undefined,url:string|undefined;
  let active=true;
  try {
    return await Promise.race([
      (async()=>{
        const blob=await new Promise<Blob>((resolve,reject)=>canvas.toBlob(value=>value?resolve(value):reject(Error("sky encoding failed")),"image/png"));
        if(!active)throw Error("sky encoding retired");
        signal.throwIfAborted();
        url=URL.createObjectURL(blob);
        const image=new Image();image.src=url;await image.decode();
        signal.throwIfAborted();if(!active)throw Error("sky decoding retired");return url;
      })(),
      new Promise<never>((_,reject)=>{timer=setTimeout(()=>{active=false;reject(Error("sky encoding timeout"));},8000);})
    ]);
  } catch(error) {if(url)URL.revokeObjectURL(url);throw error;}
  finally {active=false;clearTimeout(timer);}
}

/** Two fully decoded images in a sky-only SVG. The cloud image is small and
 * overdrawn past both edges; CSS translates it over minutes. No per-frame scene
 * draw, canvas upload, noise regeneration, network fetch or React state update. */
export async function prepareMansionSkyMotion(building:HTMLCanvasElement,phase:MansionPhaseId,seed:number,signal:AbortSignal,weather:MansionWeather="clear"):Promise<MansionSkyMotion> {
  const source=building.getContext("2d");
  if(!source)throw Error("sky silhouette unavailable");
  const outline=mansionSkyClipPath(source.getImageData(0,0,W,SKY_HEIGHT).data);
  const rainOutline=weather==="rain" ? mansionSkyClipPath(source.getImageData(0,0,W,H).data,W,H) : null;
  const raster=phase==="night" ? mansionNightCloudRaster({seed,overscan:OVERSCAN,weather}) : mansionDayCloudRaster(phase,{seed,overscan:OVERSCAN,weather});
  let plate:ReturnType<typeof scenerySurface>|undefined,cloud:ReturnType<typeof scenerySurface>|undefined;
  const urls:string[]=[];
  try {
    plate=scenerySurface(W,SKY_HEIGHT,true);cloud=scenerySurface(raster.width,raster.height);
    paintMansionSkyBase(plate.ctx,phase,weather);paintMansionAtmosphereShade(plate.ctx,phase);
    const pixels=cloud.ctx.createImageData(raster.width,raster.height);
    pixels.data.set(raster.data);
    const tint=tintChannels(MANSION_ATMOSPHERE[phase].tint);
    for(let i=0;i<pixels.data.length;i+=4)for(let channel=0;channel<3;channel++)pixels.data[i+channel]*=tint[channel];
    cloud.ctx.putImageData(pixels,0,0);
    // Sequential ownership avoids a successful sibling URL leaking if one
    // decoder fails. Both work canvases are released before this is returned.
    urls.push(await decodedUrl(plate.canvas,signal));
    urls.push(await decodedUrl(cloud.canvas,signal));
    signal.throwIfAborted();
    const id=`mansion-sky-${phase}-${identity++}`;
    const element=svg("svg",{class:"mansion-sky-motion",viewBox:`0 0 ${W} ${rainOutline ? H : SKY_HEIGHT}`,"aria-hidden":"true",focusable:"false","data-phase":phase,"data-weather":weather});
    const defs=svg("defs",{}),clip=svg("clipPath",{id,clipPathUnits:"userSpaceOnUse"});
    clip.append(svg("path",{d:outline}));defs.append(clip);element.append(defs);
    const group=svg("g",{"clip-path":`url(#${id})`});
    group.append(svg("image",{href:urls[0],x:"0",y:"0",width:String(W),height:String(SKY_HEIGHT)}));
    const moving=svg("image",{class:"mansion-sky-clouds",href:urls[1],x:String(-OVERSCAN),y:"0",width:String(W+OVERSCAN*2),height:String(SKY_HEIGHT)});
    moving.style.setProperty("--mansion-cloud-duration",`${210+seed%91}s`);
    group.append(moving);element.append(group);
    if(rainOutline) {
      const rainId=`${id}-rain`,rainClip=svg("clipPath",{id:rainId,clipPathUnits:"userSpaceOnUse"});
      rainClip.append(svg("path",{d:rainOutline}));defs.append(rainClip);
      const rain=svg("g",{class:"mansion-rain","clip-path":`url(#${rainId})`,fill:"none",stroke:phase==="night" ? "#8ba9bf" : "#c4d9e4","stroke-linecap":"round"});
      for(const layer of mansionRainPaths(seed)) {
        const path=svg("path",{class:"mansion-rain__streaks",d:layer.d,"stroke-width":String(layer.width),opacity:String(layer.opacity)});
        path.style.setProperty("--rain-x",`${layer.wind}px`);path.style.setProperty("--rain-y",`${layer.fall}px`);
        path.style.setProperty("--rain-duration",`${layer.duration}s`);
        rain.append(path);
      }
      element.append(rain);
    }
    let disposed=false,unmountVisibility:(()=>void)|undefined;
    return {element,mount:()=>{
      unmountVisibility?.();
      if(disposed)return ()=>{};
      const update=()=>{element.dataset.paused=String(document.hidden);};
      update();document.addEventListener("visibilitychange",update);
      unmountVisibility=()=>document.removeEventListener("visibilitychange",update);
      return unmountVisibility;
    },dispose:()=>{
      if(disposed)return;disposed=true;
      unmountVisibility?.();unmountVisibility=undefined;
      element.getAnimations?.({subtree:true}).forEach(animation=>animation.cancel());
      element.remove();group.querySelectorAll("image").forEach(image=>image.removeAttribute("href"));
      urls.forEach(url=>URL.revokeObjectURL(url));
    }};
  } catch(error) {urls.forEach(url=>URL.revokeObjectURL(url));throw error;}
  finally {
    if(plate)plate.canvas.width=plate.canvas.height=0;
    if(cloud)cloud.canvas.width=cloud.canvas.height=0;
  }
}
