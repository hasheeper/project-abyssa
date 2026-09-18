import { expect, it, vi } from "vitest";
import { gradeMansionWaterPixels, MANSION_WATER_RECT as rect, paintMansionWater } from "./mansion-water";

const buffer=()=>new Uint8ClampedArray(rect.width*rect.height*4);
const offset=(x:number,y:number)=>((y-rect.y)*rect.width+x)*4;
const get=(pixels:Uint8ClampedArray,x:number,y:number)=>[...pixels.slice(offset(x,y),offset(x,y)+4)];
const put=(pixels:Uint8ClampedArray,x:number,y:number,colour:number[])=>pixels.set(colour,offset(x,y));

it("leaves daytime pixels and the original art unchanged",()=>{
  const source=buffer(), output=buffer();
  put(source,650,1680,[200,235,242,255]);put(output,650,1680,[184,219,233,255]);
  const original=source.slice(), before=output.slice();
  expect(gradeMansionWaterPixels(source,output,"day")).toBe(0);
  expect(output.every((value,index)=>value===before[index])).toBe(true);
  gradeMansionWaterPixels(source,output,"night");
  expect(source.every((value,index)=>value===original[index])).toBe(true);
});

it("cools rainy daytime water and suppresses sunset reflections beneath overcast skies",()=>{
  const source=buffer();put(source,690,1680,[208,236,243,255]);
  const rain=source.slice(),clearDusk=source.slice(),overcastDusk=source.slice();
  expect(gradeMansionWaterPixels(source,rain,"day","rain")).toBe(1);
  gradeMansionWaterPixels(source,clearDusk,"dusk");
  gradeMansionWaterPixels(source,overcastDusk,"dusk","overcast");
  expect(get(rain,690,1680)[2]).toBeLessThan(170);
  expect(get(rain,690,1680)[3]).toBe(255);
  expect(get(overcastDusk,690,1680)[0]).toBeLessThan(get(clearDusk,690,1680)[0]);
  expect(get(source,690,1680)).toEqual([208,236,243,255]);
});

it("protects cliff, boat, rope and pier pigments as well as the shore envelope",()=>{
  const source=buffer(), output=buffer();
  for (const [x,y,colour] of [
    [340,1710,[113,86,60,255]], // boat
    [80,1708,[68,52,35,255]], // pier
    [657,1626,[55,46,31,255]], // rope crossing water
    [970,1640,[112,132,145,255]], // cool cliff, above the shore
    [700,1584,[202,230,239,255]], // above the sea's horizon
  ] as const) {put(source,x,y,[...colour]);put(output,x,y,[74,69,65,255]);}
  const before=output.slice();
  expect(gradeMansionWaterPixels(source,output,"night")).toBe(0);
  expect(output.every((value,index)=>value===before[index])).toBe(true);
});

it("uses distinct phase colours, with restrained night crests and readable reflections",()=>{
  const source=buffer();
  put(source,690,1680,[208,236,243,255]); // a bright broken wave crest
  put(source,690,1825,[76,126,143,255]); // submerged reflection
  const colours=new Set<string>();
  for (const phase of ["dawn","dusk","night"] as const) {
    const output=source.slice();
    expect(gradeMansionWaterPixels(source,output,phase)).toBe(2);
    const crest=get(output,690,1680), reflection=get(output,690,1825);
    colours.add(crest.join(","));
    expect(crest[3]).toBe(255);expect(reflection[3]).toBe(255);
    expect(crest[2]).toBeGreaterThan(reflection[2]);
    expect(reflection[2]).toBeGreaterThan(20);
    if (phase==="night") {
      expect(Math.max(...crest.slice(0,3))).toBeLessThan(145);
      expect(crest[2]).toBeGreaterThan(crest[0]);
      expect(reflection[0]).toBeLessThan(30);
    }
    if (phase==="dusk") expect(crest[0]).toBeGreaterThan(crest[2]);
  }
  expect(colours.size).toBe(3);
});

it("reads and writes only the water crop once, without a new canvas",()=>{
  const data=buffer();put(data,650,1680,[200,235,242,255]);
  const original={getImageData:vi.fn(()=>({data}))};
  const ctx={getImageData:vi.fn(()=>({data:data.slice()})),putImageData:vi.fn()};
  const source={width:5162,height:1910,getContext:vi.fn(()=>original)};
  paintMansionWater(ctx as unknown as CanvasRenderingContext2D,source as unknown as HTMLCanvasElement,"day");
  expect(source.getContext).not.toHaveBeenCalled();
  paintMansionWater(ctx as unknown as CanvasRenderingContext2D,source as unknown as HTMLCanvasElement,"night");
  expect(original.getImageData).toHaveBeenCalledExactlyOnceWith(rect.x,rect.y,rect.width,rect.height);
  expect(ctx.getImageData).toHaveBeenCalledExactlyOnceWith(rect.x,rect.y,rect.width,rect.height);
  expect(ctx.putImageData).toHaveBeenCalledExactlyOnceWith(expect.any(Object),rect.x,rect.y);
});
