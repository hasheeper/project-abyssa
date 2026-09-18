import { MANSION_WORLD_HEIGHT as H, MANSION_WORLD_WIDTH as W } from "./data";
import { paintMansionNightClouds } from "./mansion-night-clouds";
import { WEATHER_CLOUDS, weatherSky, type MansionWeather } from "./mansion-weather";

/** Fixed irregular distribution: no tiled star grid and no random changes on revisit. */
function nightStars() {
  let seed = 0x5a17;
  const random = () => {seed = (Math.imul(seed,1664525)+1013904223)>>>0; return seed/4294967296;};
  return Array.from({length:156},(_,index)=>{
    const x=40+random()*(W-80), y=45+random()*H*.49;
    return {x,y,radius:index%19===0?2.4:.8+random()*1.1,
      opacity:(.32+random()*.42)*(1-y/(H*.82)),warm:random()>.8};
  });
}
export const MANSION_NIGHT_STARS = nightStars();

function circle(ctx: CanvasRenderingContext2D,x:number,y:number,radius:number,fill:string) {
  ctx.beginPath();ctx.arc(x,y,radius,0,Math.PI*2);ctx.fillStyle=fill;ctx.fill();
}

/** Quiet, static sky painted behind the building into the same opaque image. */
export function paintMansionNightSky(ctx: CanvasRenderingContext2D,{clouds=true,seed=0,weather="clear"}: {clouds?:boolean;seed?:number;weather?:MansionWeather}={}) {
  ctx.save();
  const sky=ctx.createLinearGradient(0,0,0,H);
  const colours=weatherSky("night",weather)??["#0b1729","#1c314c","#344a60","#465367"];
  sky.addColorStop(0,colours[0]);sky.addColorStop(.38,colours[1]);
  sky.addColorStop(.72,colours[2]);sky.addColorStop(1,colours[3]);
  ctx.fillStyle=sky;ctx.fillRect(0,0,W,H);

  for(const star of WEATHER_CLOUDS[weather].stars ? MANSION_NIGHT_STARS : []) {
    circle(ctx,star.x,star.y,star.radius,`rgba(${star.warm?"222,218,197":"194,214,237"},${star.opacity*WEATHER_CLOUDS[weather].stars})`);
  }
  if(clouds)paintMansionNightClouds(ctx,seed,weather);
  ctx.restore();
}
