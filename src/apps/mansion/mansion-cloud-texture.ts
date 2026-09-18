import { WEATHER_CLOUDS, type MansionWeather } from "./mansion-weather";

/** Shared painted-weather grain for all four phases. Banks are compositional
 * guides, never rendered ellipses; warped multi-scale noise breaks every edge. */
export const MANSION_CLOUD_BANKS = [
  [660, 470, 610, 160, -.12],
  [2540, 310, 700, 200, .16],
  [3630, 610, 900, 250, -.18],
  [4810, 180, 590, 150, .15]
] as const;

export type CloudRasterOptions={seed?:number;overscan?:number;weather?:MansionWeather};
let sessionSeed:number|undefined;
/** One weather layout per page lifetime, retained through all phase changes. */
export function mansionWeatherSeed() {
  if(sessionSeed===undefined)sessionSeed=crypto.getRandomValues(new Uint32Array(1))[0];
  return sessionSeed;
}
export function mansionCloudBanks(seed=0,weather:MansionWeather="clear") {
  if(!seed && weather==="clear")return MANSION_CLOUD_BANKS;
  let state=seed>>>0;
  const random=()=>{state=(Math.imul(state,1664525)+1013904223)>>>0;return state/4294967296;};
  const spread=WEATHER_CLOUDS[weather].spread;
  return MANSION_CLOUD_BANKS.map(([x,y,rx,ry,tilt])=>[
    x+(random()-.5)*220,y+(random()-.5)*110,
    rx*(.9+random()*.2)*spread,ry*(.88+random()*.24)*spread,tilt+(random()-.5)*.12
  ] as const);
}

export const cloudSmooth = (from:number,to:number,value:number) => {
  const t=Math.max(0,Math.min(1,(value-from)/(to-from)));
  return t*t*(3-2*t);
};

function hash(x:number,y:number) {
  let n=Math.imul(x,374761393)^Math.imul(y,668265263)^0x7a31;
  n=Math.imul(n^(n>>>13),1274126177);
  return ((n^(n>>>16))>>>0)/4294967295;
}

export function cloudNoise(x:number,y:number) {
  const ix=Math.floor(x),iy=Math.floor(y);
  const u=cloudSmooth(0,1,x-ix),v=cloudSmooth(0,1,y-iy);
  const a=hash(ix,iy),b=hash(ix+1,iy),c=hash(ix,iy+1),d=hash(ix+1,iy+1);
  return (a+(b-a)*u)*(1-v)+(c+(d-c)*u)*v;
}

export function cloudTurbulence(x:number,y:number) {
  let sum=0,weight=.55;
  for(let octave=0;octave<4;octave++) {
    sum+=cloudNoise(x,y)*weight;
    x=x*2.07+17.3;y=y*2.03+9.2;weight*=.5;
  }
  return sum/1.03125;
}
