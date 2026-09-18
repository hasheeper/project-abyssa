import { afterEach, expect, it, vi } from "vitest";
import { MANSION_ATMOSPHERE, MANSION_NIGHT_LIGHTS, MANSION_SCENE_REGIONS, paintMansionScenery } from "./mansion-scenery";
import { mansionLightSources } from "./mansion-light-sources";
import { regionBounds } from "./mansion-geometry";

type Paint = {x:number; y:number; rx:number; ry:number; blend:string; filter:string; colors:string[]};
type ImageDraw = {image:CanvasImageSource; coordinates:number[]; filter:string};
function context() {
  const paints: Paint[] = [];
  const imageDraws: ImageDraw[] = [];
  let transform = {x:0,y:0,rx:1,ry:1};
  const stack: Array<{transform:typeof transform; blend:string; alpha:number; filter:string}> = [];
  const gradient = () => ({colors: [] as string[], addColorStop(_offset:number,color:string) {this.colors.push(color);}});
  const ctx = {
    globalCompositeOperation:"source-over", globalAlpha:1, filter:"none", fillStyle:undefined as unknown,
    save() {stack.push({transform:{...transform},blend:this.globalCompositeOperation,alpha:this.globalAlpha,filter:this.filter});},
    restore() {const previous=stack.pop()!;transform=previous.transform;this.globalCompositeOperation=previous.blend;this.globalAlpha=previous.alpha;this.filter=previous.filter;},
    translate(x:number,y:number) {transform.x+=x;transform.y+=y;},
    scale(rx:number,ry:number) {transform.rx*=rx;transform.ry*=ry;},
    fillRect() {if(this.fillStyle && typeof this.fillStyle==="object" && "colors" in this.fillStyle)paints.push({...transform,blend:this.globalCompositeOperation,filter:this.filter,colors:this.fillStyle.colors as string[]});},
    drawImage(image:CanvasImageSource,...coordinates:number[]) {imageDraws.push({image,coordinates,filter:this.filter});},
    createImageData:(w:number,h:number)=>({data:new Uint8ClampedArray(w*h*4)}), putImageData:vi.fn(),
    beginPath:vi.fn(), rect:vi.fn(), clip:vi.fn(), moveTo:vi.fn(), lineTo:vi.fn(), closePath:vi.fn(),
    arc:vi.fn(), fill:vi.fn(), bezierCurveTo:vi.fn(),
    createLinearGradient:gradient, createRadialGradient:gradient
  };
  return {ctx:ctx as unknown as CanvasRenderingContext2D,paints,imageDraws};
}
afterEach(()=>vi.restoreAllMocks());

it("uses screen only on source-sized emission, not a map or room-sized haze", () => {
  vi.spyOn(HTMLCanvasElement.prototype,"getContext").mockImplementation(()=>context().ctx);
  const {ctx,paints}=context();
  paintMansionScenery(ctx,document.createElement("canvas"),"night");
  const emission=paints.filter(p=>p.blend==="screen");
  const sources=MANSION_NIGHT_LIGHTS.flatMap(({region})=>mansionLightSources(region.id));
  expect(emission.length).toBeGreaterThan(0);
  expect(paints.some(p=>p.rx>200 && p.ry>200)).toBe(false);
  for(const paint of emission) {
    expect(sources.some(source=>source.x===paint.x && source.y===paint.y)).toBe(true);
    expect(paint.rx).toBeLessThan(150);
    expect(paint.ry).toBeLessThan(150);
  }
  expect(emission.some(p=>p.x===1839 && p.y===1746 && p.colors[0]==="rgba(147,231,255,.94)")).toBe(true);
  expect(emission.some(p=>p.x===1472 && p.y===1525 && p.colors[0]==="rgba(255,222,143,.94)")).toBe(true);
  for (const source of mansionLightSources("seal")) {
    expect(emission.some(p=>p.x===source.x && p.y===source.y && p.colors[0]==="rgba(255,136,149,.94)")).toBe(true);
  }
  expect(paints.some(p=>p.x===1601 && p.y===1271 && p.blend==="soft-light")).toBe(true);
  expect(paints.every(p=>p.filter==="none")).toBe(true);
});

it("raises only the three illustrated basement interiors before the shared night shading", () => {
  vi.spyOn(HTMLCanvasElement.prototype,"getContext").mockImplementation(()=>context().ctx);
  const {ctx,imageDraws}=context(), building=document.createElement("canvas");
  paintMansionScenery(ctx,building,"night");
  const art=imageDraws.filter(draw=>draw.image===building);
  expect(art).toHaveLength(4);
  expect(art[0]).toMatchObject({coordinates:[0,0],filter:MANSION_ATMOSPHERE.night.grade});
  const rooms=["library","array","seal"];
  for (const [index,id] of rooms.entries()) {
    const {left,top,right,bottom}=regionBounds(MANSION_SCENE_REGIONS.find(region=>region.id===id)!);
    expect(art[index+1].coordinates).toEqual([left,top,right-left,bottom-top,left,top,right-left,bottom-top]);
    expect(art[index+1].filter).toBe(MANSION_ATMOSPHERE.night.grade.replace("brightness(0.7)",`brightness(${id==="seal" ? 1 : .94})`));
  }
  expect(imageDraws.at(-1)?.filter).toBe("none");
  expect(ctx.filter).toBe("none");
});

it("does not apply the new practical light pass to dawn, day or dusk", () => {
  vi.spyOn(HTMLCanvasElement.prototype,"getContext").mockImplementation(()=>context().ctx);
  for(const phase of ["dawn","day","dusk"] as const) {
    const {ctx,paints,imageDraws}=context(), building=document.createElement("canvas");
    paintMansionScenery(ctx,building,phase);
    expect(paints.some(p=>p.blend==="screen" || p.blend==="soft-light")).toBe(false);
    expect(imageDraws.filter(draw=>draw.image===building)).toEqual([{image:building,coordinates:[0,0],filter:MANSION_ATMOSPHERE[phase].grade}]);
  }
});
