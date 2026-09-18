import {afterEach,expect,it,vi} from "vitest";
import {mansionDayCloudRaster,paintMansionDayClouds} from "./mansion-day-clouds";

afterEach(()=>vi.restoreAllMocks());
for(const phase of ["dawn","day","dusk"] as const)it(`${phase} has feathered cloud folds and open sky, not cut-out bands`,()=>{
  const {width,height,data}=mansionDayCloudRaster(phase);
  let visible=0,maxAlpha=0,maxJump=0,longest=0;
  const levels=new Set<number>();
  for(let y=0;y<height;y++) {
    let run=0;
    for(let x=0;x<width;x++) {
      const a=data[(y*width+x)*4+3];levels.add(a);maxAlpha=Math.max(maxAlpha,a);
      if(a>10){visible++;longest=Math.max(longest,++run);}else run=0;
      if(x)maxJump=Math.max(maxJump,Math.abs(a-data[(y*width+x-1)*4+3]));
      if(y)maxJump=Math.max(maxJump,Math.abs(a-data[((y-1)*width+x)*4+3]));
      if(y===height-1)expect(a).toBe(0);
    }
  }
  expect(visible/(width*height)).toBeGreaterThan(.04);
  expect(visible/(width*height)).toBeLessThan(.35);
  expect(longest/width).toBeLessThan(.4);
  expect(maxAlpha).toBeGreaterThan(60);expect(maxAlpha).toBeLessThan(190);
  expect(maxJump).toBeLessThan(22);expect(levels.size).toBeGreaterThan(60);
});

it("varies weather by seed, reuses it across frames and provides overscan for drift",()=>{
  const a=mansionDayCloudRaster("day",{seed:1234,overscan:320});
  expect(mansionDayCloudRaster("day",{seed:1234,overscan:320})).toBe(a);
  const b=mansionDayCloudRaster("day",{seed:4567,overscan:320});
  expect(a.data.some((value,index)=>value!==b.data[index])).toBe(true);
  expect(a.width*4).toBeGreaterThanOrEqual(5162+640);
  expect(a.width*a.height).toBeLessThan(420_000);
});

it("releases its preparation canvas on a failed context",()=>{
  const canvas=document.createElement("canvas");
  vi.spyOn(document,"createElement").mockReturnValue(canvas);
  vi.spyOn(canvas,"getContext").mockReturnValue(null);
  expect(()=>paintMansionDayClouds({} as CanvasRenderingContext2D,"day")).toThrow("mansion cloud context unavailable");
  expect(canvas.width).toBe(0);expect(canvas.height).toBe(0);
});
