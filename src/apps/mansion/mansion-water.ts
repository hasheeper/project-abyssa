import type { MansionPhaseId } from "./data";
import { WEATHER_CLOUDS, type MansionWeather } from "./mansion-weather";

type RGB = readonly [number, number, number];
type WaterPalette = {deep: RGB; body: RGB; ripple: RGB; warm: RGB; reflection: number; depth: number};

/** Final water pigments, before the existing shared atmospheric tint. Day
 * deliberately has no pass: its painted turquoise water is the reference. */
export const MANSION_WATER_PALETTES: Record<Exclude<MansionPhaseId, "day">, WaterPalette> = {
  dawn: {deep:[26,50,70], body:[73,108,127], ripple:[151,177,185], warm:[189,167,143], reflection:.36, depth:.86},
  dusk: {deep:[25,33,56], body:[63,80,105], ripple:[127,134,151], warm:[198,137,99], reflection:.68, depth:.83},
  night: {deep:[8,20,34], body:[27,49,70], ripple:[89,115,141], warm:[89,115,141], reflection:0, depth:.75}
};

export const MANSION_WATER_RECT = {x:0, y:1580, width:1176, height:330} as const;

// A loose shore envelope, intersected with the original cyan-water pigment.
// The pigment key protects boat planks, pier legs, rope, cliff and foundation;
// illustrated boat/cliff reflections below the waterline remain in the water.
const SHORE: readonly (readonly [number, number])[] = [
  [0,1714],[65,1699],[140,1703],[450,1700],[485,1693],[536,1697],
  [557,1670],[581,1590],[794,1584],[813,1684],[855,1693],
  [917,1707],[1034,1705],[1082,1717],[1176,1720]
];
const clamp = (value:number) => Math.max(0,Math.min(1,value));
const smooth = (value:number, from:number, to:number) => {
  const t=clamp((value-from)/(to-from));
  return t*t*(3-2*t);
};
const shoreTop = Array.from({length:MANSION_WATER_RECT.width}, (_,x) => {
  const right = SHORE.findIndex(point=>point[0]>=x);
  if (right<=0) return SHORE[0][1];
  const [x0,y0]=SHORE[right-1], [x1,y1]=SHORE[right];
  return y0+(y1-y0)*(x-x0)/(x1-x0);
});

/** Remap the existing ripples rather than drawing a new flat glow or a moon
 * reflection. The source is the ungraded art; output is the prepared scene.
 * Both buffers cover MANSION_WATER_RECT, never the whole 5162px-wide world. */
export function gradeMansionWaterPixels(source: Uint8ClampedArray, output: Uint8ClampedArray, phase: MansionPhaseId,weather:MansionWeather="clear") {
  if (phase === "day" && weather==="clear") return 0;
  const {width,height,y:top}=MANSION_WATER_RECT;
  const palette:WaterPalette=phase==="day"
    ? {deep:[28,51,69],body:[72,109,130],ripple:[157,180,192],warm:[157,180,192],reflection:0,depth:.86}
    : MANSION_WATER_PALETTES[phase];
  const weatherDepth=phase==="night" ? 1 : weather==="rain" ? .85 : weather==="overcast" ? .93 : 1;
  if (source.length!==width*height*4 || output.length!==source.length) throw Error("mansion water buffer dimensions");
  let changed=0;
  for (let row=0;row<height;row++) {
    const y=top+row;
    const depth=1-(1-palette.depth)*smooth(y,1760,1910);
    const surface=1-smooth(y,1740,1815);
    for (let x=0;x<width;x++) {
      const index=(row*width+x)*4;
      if (!source[index+3] || y<shoreTop[x]) continue;
      const r=source[index],g=source[index+1],b=source[index+2];
      const water=smooth(Math.min(g,b)-r,7,27)*smooth(b-r,12,31)
        * smooth(y-shoreTop[x],0,9) * source[index+3]/255;
      if (water===0) continue;
      const luminance=.2126*r+.7152*g+.0722*b;
      const body=smooth(luminance,24,161), ripple=smooth(luminance,153,243);
      // Evening sunlight comes from the left-side sky. Its colour follows
      // existing broken wave crests, not a new painted stripe. Dawn is diffuse.
      const direction=phase==="dusk" ? Math.exp(-Math.pow((x-705)/390,2)) : .55+.45*x/width;
      const warmth=palette.reflection*direction*surface*WEATHER_CLOUDS[weather].sunlight;
      for (let channel=0;channel<3;channel++) {
        const base=palette.deep[channel]+(palette.body[channel]-palette.deep[channel])*body;
        const crest=palette.ripple[channel]+(palette.warm[channel]-palette.ripple[channel])*warmth;
        const target=(base+(crest-base)*ripple)*depth*weatherDepth;
        output[index+channel]=Math.round(output[index+channel]+(target-output[index+channel])*water);
      }
      // Alpha is untouched; the published scene remains one opaque image.
      changed++;
    }
  }
  return changed;
}

/** Runs once on the detached scene before PNG encoding; no persistent canvas,
 * animation loop, extra image request or browser compositing layer is added. */
export function paintMansionWater(ctx: CanvasRenderingContext2D, source: HTMLCanvasElement, phase: MansionPhaseId,weather:MansionWeather="clear") {
  if (phase==="day" && weather==="clear") return;
  const {x,y,width,height}=MANSION_WATER_RECT;
  if (source.width<x+width || source.height<y+height) return;
  const original=source.getContext("2d");
  if (!original) throw Error("mansion water source unavailable");
  const pixels=original.getImageData(x,y,width,height), scene=ctx.getImageData(x,y,width,height);
  if (gradeMansionWaterPixels(pixels.data,scene.data,phase,weather)) ctx.putImageData(scene,x,y);
}
