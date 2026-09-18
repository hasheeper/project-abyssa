import { DEFAULT_MANSION_RECTANGLES, DEFAULT_MANSION_REGIONS } from "../../content/mansion/defaultRegions";
import { MANSION_CHARACTERS, MANSION_WORLD_HEIGHT as H, MANSION_WORLD_WIDTH as W, type MansionPhaseId } from "./data";
import { resolveRoomLight, type LightTone } from "./lighting";
import { mansionLightSources } from "./mansion-light-sources";
import { paintMansionNightSky } from "./mansion-night-sky";
import { paintMansionDayClouds } from "./mansion-day-clouds";
import { paintMansionWater } from "./mansion-water";
import { WEATHER_CLOUDS, weatherBuildingGrade, weatherSky, type MansionWeather } from "./mansion-weather";
import { regionBounds, UNDERGROUND_BOTTOM, UNDERGROUND_LEFT, UNDERGROUND_RIGHT, UNDERGROUND_TOP, type SceneRegion } from "./mansion-geometry";

export const MANSION_SCENE_REGIONS: SceneRegion[] = [
  ...DEFAULT_MANSION_RECTANGLES.map(region => ({...region, shape: "rectangle" as const})),
  ...DEFAULT_MANSION_REGIONS.map(region => ({...region, shape: "polygon" as const}))
];

type Atmosphere = {
  sun: [number, number, number];
  core: string; halo: string;
  sky: [string, string, string, string];
  grade: string; tint: string; shadow: string; underground: number;
};

const nightGrade = (brightness: number) => `sepia(0) hue-rotate(5deg) saturate(.82) contrast(1.02) brightness(${brightness})`;
/** These interiors are already dark in the source art. Lift their exposure,
 * not their black point or the whole basement, before the shared night tint. */
const NIGHT_ROOM_BRIGHTNESS: Readonly<Partial<Record<string, number>>> = {
  library: .94,
  array: .94,
  seal: 1
};

/** The former CSS phase palette, evaluated once into pixels rather than as
 * full-world browser filters/blend groups. Room previews use the same grade. */
export const MANSION_ATMOSPHERE: Record<MansionPhaseId, Atmosphere> = {
  dawn: {
    sun: [.84, .74, .62], core: "rgba(255,216,158,.52)", halo: "rgba(233,152,106,.26)",
    sky: ["#4a6480", "#8f8fa0", "#e2b18d", "#a28a70"],
    grade: "sepia(.14) hue-rotate(-8deg) saturate(1) contrast(.97) brightness(.97)",
    tint: "rgba(178,118,84,.13)", shadow: "rgba(48,30,46,.13)", underground: .82
  },
  day: {
    sun: [.52, .12, .38], core: "rgba(255,252,236,.46)", halo: "rgba(255,244,206,.2)",
    sky: ["#7f9fb4", "#b9cbcd", "#e6dcc3", "#a4a390"],
    grade: "sepia(0) hue-rotate(0deg) saturate(1.02) contrast(1.04) brightness(1)",
    tint: "transparent", shadow: "rgba(20,38,48,.04)", underground: .82
  },
  dusk: {
    sun: [.14, .70, .66], core: "rgba(255,198,137,.54)", halo: "rgba(206,105,82,.30)",
    sky: ["#4c4560", "#8a6f81", "#d99a72", "#9d7d61"],
    grade: "sepia(.2) hue-rotate(-14deg) saturate(1.04) contrast(.96) brightness(.9)",
    tint: "rgba(152,74,55,.19)", shadow: "rgba(54,26,44,.18)", underground: .82
  },
  night: {
    // The dedicated star/cloud sky has no moon, halo or solar light disc.
    sun: [0, 0, 0], core: "transparent", halo: "transparent",
    sky: ["#0b1729", "#1c314c", "#344a60", "#465367"],
    grade: nightGrade(.7),
    tint: "rgba(35,58,101,.19)", shadow: "rgba(4,10,28,.22)", underground: .22
  }
};

const LIGHT_COLORS: Record<LightTone, [string, string]> = {
  hearth: ["255,222,143", "239,126,48"],
  lamp: ["255,235,183", "219,173,100"],
  cold: ["215,236,252", "138,186,222"],
  blue: ["147,231,255", "45,141,255"],
  arcane: ["255,136,149", "192,48,77"],
  spectral: ["211,234,216", "119,152,140"],
  dim: ["240,211,176", "154,121,86"]
};
const occupiedAtNight = new Set(MANSION_CHARACTERS.map(character => character.schedule.night));
export const MANSION_NIGHT_LIGHTS = MANSION_SCENE_REGIONS.flatMap(region => {
  const light = resolveRoomLight(region.id, "night", occupiedAtNight.has(region.id));
  return light && mansionLightSources(region.id).length ? [{region, light}] : [];
});

type Stops = ReadonlyArray<readonly [number, string]>;
function stops(gradient: CanvasGradient, colors: Stops) {
  for (const [offset, color] of colors) gradient.addColorStop(offset, color);
  return gradient;
}
function linear(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, colors: Stops, horizontal = false) {
  ctx.fillStyle = stops(ctx.createLinearGradient(x, y, horizontal ? x + w : x, horizontal ? y : y + h), colors);
  ctx.fillRect(x, y, w, h);
}
function ellipse(ctx: CanvasRenderingContext2D, x: number, y: number, rx: number, ry: number, colors: Stops) {
  ctx.save();
  ctx.translate(x, y); ctx.scale(rx, ry);
  ctx.fillStyle = stops(ctx.createRadialGradient(0, 0, 0, 0, 0, 1), colors);
  ctx.fillRect(-1, -1, 2, 2);
  ctx.restore();
}
export function scenerySurface(width = W, height = H, opaque = false) {
  const canvas = document.createElement("canvas");
  canvas.width = width; canvas.height = height;
  // Prefer CPU-friendly preparation. Only the encoded, decoded image enters
  // the document; no live canvas surface is retained by the scene.
  const ctx = canvas.getContext("2d", {alpha: !opaque, willReadFrequently: true});
  if (!ctx) throw Error("mansion scenery context unavailable");
  return {canvas, ctx};
}

export function paintMansionSkyBase(ctx:CanvasRenderingContext2D,phase:MansionPhaseId,weather:MansionWeather="clear") {
  const palette=MANSION_ATMOSPHERE[phase];
  if(phase==="night"){paintMansionNightSky(ctx,{clouds:false,weather});return;}
  const colours=weatherSky(phase,weather)??palette.sky;
  linear(ctx, 0, 0, W, H, [[0, colours[0]], [.42, colours[1]], [.72, colours[2]], [1, colours[3]]]);
  const [x, y, radius] = palette.sun;
  // Scattered light behind the clouds, not a world-sized white veil.
  ctx.save();ctx.globalAlpha=.55*WEATHER_CLOUDS[weather].sunlight;
  ellipse(ctx, W*x, H*y, W*radius*.85, H*radius*.7, [[0,palette.core],[.4,palette.halo],[.7,"transparent"]]);
  ctx.restore();
}

function sky(ctx:CanvasRenderingContext2D,phase:MansionPhaseId,seed:number,weather:MansionWeather) {
  if(phase==="night"){paintMansionNightSky(ctx,{seed,weather});return;}
  paintMansionSkyBase(ctx,phase,weather);
  paintMansionDayClouds(ctx,phase,seed,weather);
}

function underground(ctx: CanvasRenderingContext2D, opacity: number) {
  const width = Math.ceil(UNDERGROUND_RIGHT-UNDERGROUND_LEFT), height = UNDERGROUND_BOTTOM-UNDERGROUND_TOP;
  const layer = scenerySurface(width, height);
  try {
    linear(layer.ctx,0,0,width,height,[[0,"transparent"],[.07,"rgba(6,10,14,.3)"],[.22,"rgba(5,9,12,.44)"],[1,"rgba(5,9,12,.46)"]]);
    layer.ctx.globalCompositeOperation = "destination-in";
    linear(layer.ctx,0,0,width,height,[[0,"transparent"],[.09,"black"],[1,"black"]]);
    linear(layer.ctx,0,0,width,height,[[0,"transparent"],[130/width,"black"],[1-130/width,"black"],[1,"transparent"]],true);
    ctx.save(); ctx.globalCompositeOperation = "multiply"; ctx.globalAlpha = opacity;
    ctx.drawImage(layer.canvas,UNDERGROUND_LEFT,UNDERGROUND_TOP); ctx.restore();
  } finally { layer.canvas.width = layer.canvas.height = 0; }
}

function buildingArt(ctx: CanvasRenderingContext2D, building: HTMLCanvasElement, phase: MansionPhaseId,weather:MansionWeather) {
  ctx.save();
  ctx.filter = MANSION_ATMOSPHERE[phase].grade+weatherBuildingGrade(phase,weather);
  ctx.drawImage(building,0,0);
  if (phase === "night") {
    for (const region of MANSION_SCENE_REGIONS) {
      const brightness = NIGHT_ROOM_BRIGHTNESS[region.id];
      if (brightness === undefined || region.shape !== "rectangle") continue;
      const {left,top,right,bottom} = regionBounds(region);
      ctx.filter = nightGrade(brightness);
      // Redraw only the opaque illustrated interior, bounded by its ink frame.
      // This stays in the one baked image; no live room filters or new layers.
      ctx.drawImage(building,left,top,right-left,bottom-top,left,top,right-left,bottom-top);
    }
  }
  ctx.restore();
}

function roomLights(ctx: CanvasRenderingContext2D) {
  for (const {region,light} of MANSION_NIGHT_LIGHTS) {
    const {left,top,right,bottom} = regionBounds(region);
    ctx.save(); ctx.beginPath();
    if (region.shape === "rectangle") ctx.rect(left,top,right-left,bottom-top);
    else {
      region.points.forEach((point,index) => index === 0
        ? ctx.moveTo(point.x*W,point.y*H) : ctx.lineTo(point.x*W,point.y*H));
      ctx.closePath();
    }
    ctx.clip();
    for (const source of mansionLightSources(region.id)) {
      const [core,bounce] = LIGHT_COLORS[source.tone ?? light.tone];
      const strength = light.intensity * (source.strength ?? 1);
      ctx.globalAlpha = strength;
      // Reflected colour preserves the drawing's dark lines. It falls off near
      // the source instead of bleaching the room centre and ceiling.
      ctx.globalCompositeOperation = "soft-light";
      ellipse(ctx,source.x,source.y,...source.reach,
        [[0,`rgba(${bounce},.95)`],[.3,`rgba(${bounce},.6)`],[.72,`rgba(${bounce},.1)`],[1,"transparent"]]);
      const emission = source.emission ?? 1;
      if (emission === 0) continue;
      ctx.globalAlpha = strength * emission;
      ctx.globalCompositeOperation = "screen";
      // Readable at the world's ~0.47 scale: a stronger, compact near-field,
      // capped below the reach so it cannot turn back into a room-sized wash.
      ellipse(ctx,source.x,source.y,Math.min(source.core[0]*3.2,source.reach[0]*.8),Math.min(source.core[1]*3.2,source.reach[1]*.8),
        [[0,`rgba(${bounce},.5)`],[.22,`rgba(${bounce},.26)`],[.55,`rgba(${bounce},.1)`],[1,"transparent"]]);
      // A compact luminous core follows the actual flame/lantern/crystal.
      ellipse(ctx,source.x,source.y,...source.core,
        [[0,`rgba(${core},.94)`],[.28,`rgba(${core},.8)`],[.65,`rgba(${bounce},.36)`],[1,"transparent"]]);
    }
    ctx.restore();
  }
}

/** All blending happens in a detached surface, never between DOM siblings.
 * An opaque sky avoids exposing unpainted backdrop through transparent pixels. */
export function paintMansionAtmosphereShade(ctx:CanvasRenderingContext2D,phase:MansionPhaseId) {
  const palette=MANSION_ATMOSPHERE[phase];
  ctx.save(); ctx.globalCompositeOperation = "multiply";
  ctx.fillStyle = palette.tint; ctx.fillRect(0,0,W,H);
  // Feathered edge shade replaces the world-sized inset-shadow render pass.
  linear(ctx,0,0,420,H,[[0,palette.shadow],[1,"transparent"]],true);
  linear(ctx,W-420,0,420,H,[[0,"transparent"],[1,palette.shadow]],true);
  linear(ctx,0,0,W,420,[[0,palette.shadow],[1,"transparent"]]);
  linear(ctx,0,H-420,W,420,[[0,"transparent"],[1,palette.shadow]]);
  ctx.restore();
}

export function paintMansionScenery(ctx: CanvasRenderingContext2D, building: HTMLCanvasElement, phase: MansionPhaseId,seed=0,weather:MansionWeather="clear") {
  const palette=MANSION_ATMOSPHERE[phase];
  sky(ctx,phase,seed,weather);
  buildingArt(ctx,building,phase,weather);
  paintMansionWater(ctx,building,phase,weather);
  underground(ctx,palette.underground);
  paintMansionAtmosphereShade(ctx,phase);
  if (phase === "night") roomLights(ctx);
}
