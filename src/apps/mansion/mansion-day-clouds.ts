import { MANSION_WORLD_WIDTH as W, type MansionPhaseId } from "./data";
import { mansionCloudBanks, type CloudRasterOptions, cloudNoise as noise, cloudSmooth as smooth, cloudTurbulence as turbulence } from "./mansion-cloud-texture";
import { WEATHER_CLOUDS, weatherCloudPigment, type MansionWeather } from "./mansion-weather";

type DayPhase=Exclude<MansionPhaseId,"night">;
type RGB=readonly [number,number,number];
type CloudPalette={shadow:RGB;body:RGB;edge:RGB;opacity:number;lightSide:number;warmth:number};
const PALETTES:Record<DayPhase,CloudPalette>={
  dawn:{shadow:[105,118,144],body:[183,179,187],edge:[235,204,178],opacity:.67,lightSide:1,warmth:.7},
  day:{shadow:[119,145,166],body:[218,226,227],edge:[244,242,230],opacity:.88,lightSide:0,warmth:.2},
  dusk:{shadow:[99,97,127],body:[177,143,157],edge:[233,171,133],opacity:.77,lightSide:-1,warmth:.84}
};
const CLOUD_HEIGHT=1100,STEP=4,HEIGHT=Math.ceil(CLOUD_HEIGHT/STEP);
type Raster={width:number;height:number;data:Uint8ClampedArray};
const rasters=new Map<string,Raster>();

/** Same seeded cloud banks and grain as night, with daytime thickness and
 * directional pigment. Clear gaps, irregular wisps and shaded folds remain;
 * this is not a recoloured opaque band or a repeated tiled cloud image. */
export function mansionDayCloudRaster(phase:DayPhase,{seed=0,overscan=0,weather="clear"}:CloudRasterOptions={}):Raster {
  const key=`${phase}:${seed}:${overscan}:${weather}`,cached=rasters.get(key);
  if(cached)return cached;
  const WIDTH=Math.ceil((W+overscan*2)/STEP),banks=mansionCloudBanks(seed,weather);
  const palette=PALETTES[phase],look=WEATHER_CLOUDS[weather],data=new Uint8ClampedArray(WIDTH*HEIGHT*4);
  const shadow=weatherCloudPigment(palette.shadow,phase,weather),bodyColour=weatherCloudPigment(palette.body,phase,weather);
  const edge=weatherCloudPigment(palette.edge,phase,weather);
  for(let row=0;row<HEIGHT;row++) {
    const y=(row+.5)*CLOUD_HEIGHT/HEIGHT;
    for(let col=0;col<WIDTH;col++) {
      const x=(col+.5)*(W+overscan*2)/WIDTH-overscan;
      const wx=x+(noise(x/480+6,y/350+31)-.5)*180;
      const wy=y+(noise(x/370+43,y/290+7)-.5)*140;
      let cover=0,vertical=0,horizontal=0,weight=0;
      for(const [cx,cy,rx,ry,tilt] of banks) {
        const dx=(wx-cx)/rx,dy=(wy-cy-(wx-cx)*tilt)/ry;
        const patch=Math.exp(-2*(dx*dx+dy*dy));
        cover=Math.max(cover,patch);
        // Blend the lighting guides where banks meet; selecting only the
        // strongest bank makes colour jump at their otherwise soft overlap.
        const influence=patch*patch;
        vertical+=dy*influence;horizontal+=dx*influence;weight+=influence;
      }
      if(look.veil)cover=Math.max(cover,look.veil+.22*noise(wx/930+17,wy/420+8));
      if(cover<.04)continue;
      vertical/=weight||1;horizontal/=weight||1;
      const drift=seed ? (seed%997)*.13 : 0;
      const folds=turbulence(wx/250+drift,wy/170),detail=turbulence(wx/90+12,wy/65+9+drift);
      const density=smooth(look.density,.88,folds*.83+cover*.44);
      // Fade coverage to zero BEFORE the early-out boundary. Otherwise the
      // ellipse guide becomes a visible contour in brighter daytime clouds.
      const alpha=Math.pow(density,1.28)*(.4+.36*detail)*palette.opacity
        *smooth(.04,.22,cover)*(1-smooth(900,CLOUD_HEIGHT,y));
      const light=smooth(.05,.96,.62-vertical*.28*(1-look.veil)+(detail-.5)*.35);
      const facing=smooth(-.75,.8,horizontal*palette.lightSide+vertical*.35);
      const warm=facing*palette.warmth*look.warmth*(.2+.8*(1-density));
      const index=(row*WIDTH+col)*4;
      for(let channel=0;channel<3;channel++) {
        const body=shadow[channel]+(bodyColour[channel]-shadow[channel])*light;
        data[index+channel]=body+(edge[channel]-body)*warm;
      }
      data[index+3]=Math.round(alpha*255);
    }
  }
  const result={width:WIDTH,height:HEIGHT,data};
  if(rasters.size>=8)rasters.delete(rasters.keys().next().value!);
  rasters.set(key,result);return result;
}

/** Only bounded CPU pixels are cached. Release the detached painting surface
 * immediately; this pass is baked into the complete, static scene fallback. */
export function paintMansionDayClouds(ctx:CanvasRenderingContext2D,phase:DayPhase,seed=0,weather:MansionWeather="clear") {
  const pixels=mansionDayCloudRaster(phase,{seed,weather}),canvas=document.createElement("canvas");
  canvas.width=pixels.width;canvas.height=pixels.height;
  try {
    const cloud=canvas.getContext("2d",{willReadFrequently:true});
    if(!cloud)throw Error("mansion cloud context unavailable");
    const image=cloud.createImageData(pixels.width,pixels.height);
    image.data.set(pixels.data);cloud.putImageData(image,0,0);
    ctx.drawImage(canvas,0,0,W,CLOUD_HEIGHT);
  } finally {canvas.width=canvas.height=0;}
}
