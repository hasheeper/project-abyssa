import { expect,it } from "vitest";
import { mansionDayCloudRaster } from "./mansion-day-clouds";
import { mansionRainPaths } from "./mansion-rain";
import { WEATHER_CLOUDS, weatherBuildingGrade, weatherSky } from "./mansion-weather";

it("increases cloud cover from scattered clouds to cloudy and overcast without hard lower edges",()=>{
  const coverage=["clear","cloudy","overcast","rain"].map(weather=>{
    const {data,width,height}=mansionDayCloudRaster("day",{seed:31,weather:weather as keyof typeof WEATHER_CLOUDS});
    let count=0;
    for(let i=3;i<data.length;i+=4)if(data[i]>15)count++;
    for(let x=0;x<width;x++)expect(data[((height-1)*width+x)*4+3]).toBe(0);
    return count/(width*height);
  });
  expect(coverage[1]).toBeGreaterThan(coverage[0]*1.35);
  expect(coverage[2]).toBeGreaterThan(coverage[1]*1.2);
  expect(coverage[3]).toBeGreaterThan(.7);
});

it("removes solar light and stars under a closed sky while retaining every phase's palette",()=>{
  for(const weather of ["overcast","rain"] as const) {
    expect(WEATHER_CLOUDS[weather].sunlight).toBe(0);expect(WEATHER_CLOUDS[weather].stars).toBe(0);
    const palettes=(["dawn","day","dusk","night"] as const).map(phase=>weatherSky(phase,weather));
    expect(new Set(palettes.map(value=>value?.join())).size).toBe(4);
    expect(weatherBuildingGrade("night",weather)).toBe("");
  }
  expect(weatherSky("day","clear")).toBeUndefined();
  expect(weatherBuildingGrade("day","clear")).toBe("");
});

it("generates two stable rain batches periodic along the exact animation vector",()=>{
  const rain=mansionRainPaths(51);
  expect(rain).toEqual(mansionRainPaths(51));expect(rain).not.toEqual(mansionRainPaths(52));
  expect(rain).toHaveLength(2);
  for(const batch of rain) {
    const points=[...batch.d.matchAll(/M(-?[\d.]+) (-?[\d.]+)/g)];
    expect(points.length).toBeLessThan(650);
    expect(Number(points[1][1])-Number(points[0][1])).toBeCloseTo(batch.wind,1);
    expect(Number(points[1][2])-Number(points[0][2])).toBeCloseTo(batch.fall,1);
    expect(batch.d).not.toMatch(/NaN|Infinity/);
  }
});
