import type { MansionPhaseId } from "./data";

/** Presentation-only preview. No weather state is written to the game save. */
export type MansionWeather = "clear" | "cloudy" | "overcast" | "rain";
export const MANSION_WEATHERS = [
  {id:"clear",label:"晴天"}, {id:"cloudy",label:"多云"},
  {id:"overcast",label:"阴天"}, {id:"rain",label:"雨天"}
] as const;
export const weatherLabel = (weather:MansionWeather) => MANSION_WEATHERS.find(item=>item.id===weather)!.label;

type Sky = readonly [string,string,string,string];
const SKIES:Record<Exclude<MansionWeather,"clear">,Record<MansionPhaseId,Sky>> = {
  cloudy: {
    dawn:["#65717e","#99a3a9","#c4b5aa","#9b9689"],
    day:["#718796","#a0b1ba","#ccd0cb","#959e9b"],
    dusk:["#4f5065","#807786","#b29b8d","#827d7c"],
    night:["#0b1523","#192b3f","#31414f","#404d55"]
  },
  overcast: {
    dawn:["#505965","#7d8390","#aaa6a5","#7f888a"],
    day:["#525f6b","#7d8e9b","#adb5b8","#8b989e"],
    dusk:["#3f414f","#676671","#959096","#797b82"],
    night:["#080f18","#131e2c","#2a3640","#34414a"]
  },
  rain: {
    dawn:["#424e5c","#687986","#9ca2a6","#7a858b"],
    day:["#3f4f5d","#637989","#9ba9b2","#7b8a94"],
    dusk:["#353846","#545d6a","#818b96","#616f7b"],
    night:["#070e16","#101b29","#253540","#2e3c48"]
  }
};
export const WEATHER_CLOUDS = {
  clear:    {spread:1,    density:.45, veil:0,   pigment:0,   warmth:1,   sunlight:1,   stars:1},
  cloudy:   {spread:1.38, density:.38, veil:0,   pigment:.2,  warmth:.55, sunlight:.35, stars:.4},
  overcast: {spread:1.65, density:.32, veil:.62, pigment:.64, warmth:.1,  sunlight:0,   stars:0},
  rain:     {spread:1.7,  density:.3,  veil:.7,  pigment:.72, warmth:.03, sunlight:0,   stars:0}
} as const;
export const weatherSky = (phase:MansionPhaseId,weather:MansionWeather):Sky|undefined => weather==="clear" ? undefined : SKIES[weather][phase];

/** This is evaluated on the detached building, not a filter on the live world.
 * Keep night interiors readable; their practical lights are painted afterwards. */
export function weatherBuildingGrade(phase:MansionPhaseId,weather:MansionWeather) {
  if(weather==="clear" || phase==="night")return "";
  return weather==="cloudy" ? " saturate(.97) brightness(.97)"
    : weather==="overcast" ? " saturate(.88) brightness(.93)" : " saturate(.82) brightness(.88)";
}
export function weatherCloudPigment(rgb:readonly number[],phase:MansionPhaseId,weather:MansionWeather) {
  const sky=weatherSky(phase,weather),amount=WEATHER_CLOUDS[weather].pigment;
  if(!sky)return rgb;
  const colour=sky[1].slice(1);
  return rgb.map((value,index)=>value+(parseInt(colour.slice(index*2,index*2+2),16)-value)*amount);
}
