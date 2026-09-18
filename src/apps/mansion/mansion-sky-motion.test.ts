import {expect,it} from "vitest";
import {mansionSkyClipPath} from "./mansion-sky-motion";

it("clips above opaque skyline pixels and does not expose interior openings",()=>{
  const width=10,height=8,data=new Uint8ClampedArray(width*height*4);
  data[(2*width+2)*4+3]=255; // tower; its lower openings cannot admit animated sky
  data[(5*width+6)*4+3]=30; // an antialiased roof edge still protects the drawing
  const path=mansionSkyClipPath(data,width,height);
  expect(path).toContain("L2 1");expect(path).toContain("L6 4");
  expect(path).toContain("L4 8");expect(path.startsWith("M0 0H10")).toBe(true);
  expect(path.endsWith("Z")).toBe(true);
});

it("merges long flat stretches rather than retaining every sky pixel",()=>{
  const path=mansionSkyClipPath(new Uint8ClampedArray(1000*20*4),1000,20);
  expect(path.length).toBeLessThan(80);
  expect(path).toContain("L1000 20");
});
