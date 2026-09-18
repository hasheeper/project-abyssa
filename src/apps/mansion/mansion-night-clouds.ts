import { MANSION_WORLD_WIDTH as W } from "./data";
import { mansionCloudBanks, type CloudRasterOptions, cloudNoise as noise, cloudSmooth as smooth, cloudTurbulence as turbulence } from "./mansion-cloud-texture";
import { WEATHER_CLOUDS, type MansionWeather } from "./mansion-weather";

const CLOUD_HEIGHT = 1100;
const PIXEL_STEP = 4;
const HEIGHT = Math.ceil(CLOUD_HEIGHT / PIXEL_STEP);

/** Pure CPU pixels may be reused; no canvas, GPU texture or animation is retained. */
const rasters=new Map<string,{width:number;height:number;data:Uint8ClampedArray}>();
export function mansionNightCloudRaster({seed=0,overscan=0,weather="clear"}:CloudRasterOptions={}) {
  const key=`${seed}:${overscan}:${weather}`,cached=rasters.get(key);
  if(cached)return cached;
  const WIDTH=Math.ceil((W+overscan*2)/PIXEL_STEP),BANKS=mansionCloudBanks(seed,weather),look=WEATHER_CLOUDS[weather];
  const data = new Uint8ClampedArray(WIDTH*HEIGHT*4);
  for (let row = 0; row < HEIGHT; row++) {
    const y = (row+.5)*CLOUD_HEIGHT/HEIGHT;
    for (let col = 0; col < WIDTH; col++) {
      const x = (col+.5)*(W+overscan*2)/WIDTH-overscan;
      const wx = x+(noise(x/480+6,y/350+31)-.5)*180;
      const wy = y+(noise(x/370+43,y/290+7)-.5)*140;
      let cover = 0;
      for (const [cx,cy,rx,ry,tilt] of BANKS) {
        const dx = (wx-cx)/rx, dy = (wy-cy-(wx-cx)*tilt)/ry;
        cover = Math.max(cover, Math.exp(-2*(dx*dx+dy*dy)));
      }
      if(look.veil)cover=Math.max(cover,look.veil+.22*noise(wx/930+17,wy/420+8));
      if (cover < .04) continue;
      const drift=seed ? (seed%997)*.13 : 0;
      const folds = turbulence(wx/250+drift,wy/170);
      const detail = turbulence(wx/90+12,wy/65+9+drift);
      const density = smooth(look.density+.02,.88,folds*.83+cover*.44);
      const alpha = Math.pow(density,1.35)*(.12+.1*detail)*(1+look.veil)*smooth(.04,.22,cover)*(1-smooth(900,CLOUD_HEIGHT,y));
      const index = (row*WIDTH+col)*4;
      data[index] = 102+detail*12; data[index+1] = 122+detail*12; data[index+2] = 146+detail*10;
      data[index+3] = Math.round(alpha*255);
    }
  }
  const raster={width:WIDTH,height:HEIGHT,data};
  if(rasters.size>=4)rasters.delete(rasters.keys().next().value!);
  rasters.set(key,raster);return raster;
}

/** A small detached raster avoids hard Bézier bands and live blur/blend layers. */
export function paintMansionNightClouds(ctx: CanvasRenderingContext2D,seed=0,weather:MansionWeather="clear") {
  const pixels = mansionNightCloudRaster({seed,weather}), canvas = document.createElement("canvas");
  canvas.width = pixels.width; canvas.height = pixels.height;
  try {
    const cloud = canvas.getContext("2d", {willReadFrequently:true});
    if (!cloud) throw Error("mansion cloud context unavailable");
    const image = cloud.createImageData(pixels.width,pixels.height);
    image.data.set(pixels.data);
    cloud.putImageData(image,0,0);
    ctx.drawImage(canvas,0,0,W,CLOUD_HEIGHT);
  } finally { canvas.width = canvas.height = 0; }
}
