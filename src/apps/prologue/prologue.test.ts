import { describe, expect, it } from "vitest";
import { PROLOGUE_SHOTS, PROLOGUE_ACT_NAMES, INTERTITLE_FADE_MS, readingDuration, typingDuration, shotEndTime } from "./script";
import { cameraAt, cgAnimationDuration, cgBackingSize, cgFrameTimes, contactImpactAt } from "./renderer";
import { memoryDissolveAt } from "./PrologueTransition";
import { PROLOGUE_CATALOG_DATA } from "../../content/gameplay/demo-v4/content";

describe("prologue framing and reading",()=>{
  it("binds every saved shot to its authored presentation with 15 unique CGs",()=>{
    expect(PROLOGUE_SHOTS.map(s=>s.id)).toEqual(PROLOGUE_CATALOG_DATA.prologue!.shotIds);
    expect(new Set(PROLOGUE_SHOTS.flatMap(s=>s.image?[s.image]:[])).size).toBe(15);
    expect(PROLOGUE_SHOTS.filter(s=>s.image).every(s=>!!s.image)).toBe(true);
  });
  it("gives the time jump its own black intertitle without repeating it over the kitchen",()=>{
    const bridge=PROLOGUE_SHOTS.find(s=>s.id==="sound-bridge")!;
    const kitchen=PROLOGUE_SHOTS.find(s=>s.id==="A4-01")!;
    expect(bridge.effect).toBe("black");expect(bridge.image).toBeUndefined();
    expect(bridge.delay).toBeGreaterThanOrEqual(1500);
    expect(bridge.duration-bridge.delay-2*INTERTITLE_FADE_MS).toBeGreaterThanOrEqual(1500);
    expect(kitchen.beats.some(b=>b.text.includes(bridge.beats[0].text))).toBe(false);
    expect(PROLOGUE_SHOTS.flatMap(s=>s.beats).filter(b=>b.text===bridge.beats[0].text)).toHaveLength(1);
  });
  it("never exposes a source edge during the entire camera path",()=>{
    for(const shot of PROLOGUE_SHOTS)for(let time=0;time<=shot.duration;time+=shot.entrance==="contact"?16:100){
      const c=cameraAt(shot,time,1216,832);
      for(const [x,y] of [[-.5,-.5],[-.5,.5],[.5,-.5],[.5,.5]]){
        const rx=x*c.sx*1216/832,ry=y*c.sy;
        const ux=c.x+(Math.cos(c.angle)*rx+Math.sin(c.angle)*ry)/(1216/832),uy=c.y-Math.sin(c.angle)*rx+Math.cos(c.angle)*ry;
        expect(ux,`${shot.id} x at ${time}`).toBeGreaterThanOrEqual(-.0001);expect(ux).toBeLessThanOrEqual(1.0001);
        expect(uy,`${shot.id} y at ${time}`).toBeGreaterThanOrEqual(-.0001);expect(uy).toBeLessThanOrEqual(1.0001);
      }
    }
  });
  it("lets both contact entrances recoil once and settle before the text appears",()=>{
    expect(contactImpactAt(100).x).toBeGreaterThan(0);
    expect(contactImpactAt(220).x).toBeLessThan(0);
    expect(Math.abs(contactImpactAt(360).x)).toBeLessThan(Math.abs(contactImpactAt(220).x));
    for(const effect of ["embrace","tentacle"]){
      const shot=PROLOGUE_SHOTS.find(s=>s.effect===effect)!;
      expect(shot.entrance).toBe("contact");
      const withoutImpact={...shot,entrance:undefined};
      for(const time of [560,shot.delay,5000,30000])
        expect(cameraAt(shot,time,1216,832)).toEqual(cameraAt(withoutImpact,time,1216,832));
      for(const time of [0,100,220,360])
        expect(cameraAt(shot,time,1216,832,true)).toEqual(cameraAt(withoutImpact,time,1216,832,true));
      expect(cameraAt(shot,100,1216,832).angle).toBeGreaterThan(0);
      expect(cameraAt(shot,220,1216,832).angle).toBeLessThan(0);
      expect(shot.delay).toBeGreaterThan(560);
    }
  });
  it("holds authored stills at every reading time and keeps the title on the morning composition",()=>{
    for(const shot of PROLOGUE_SHOTS.filter(s=>s.camera.kind==="still")) {
      const initial=cameraAt(shot,0,2432,1664);
      for(const time of [500,2500,6500,9000,30000,120000])expect(cameraAt(shot,time,2432,1664)).toEqual(initial);
      expect(initial.angle).toBe(0);
    }
    const morning=PROLOGUE_SHOTS.find(s=>s.id==="A4-03")!, title=PROLOGUE_SHOTS.find(s=>s.id==="title-card")!;
    expect(cameraAt(morning,30000,2432,1664)).toEqual(cameraAt(title,0,2432,1664));
    expect(PROLOGUE_SHOTS.filter(s=>s.act===1).every(s=>s.camera.kind==="still")).toBe(true);
    for(const shot of PROLOGUE_SHOTS.filter(s=>s.camera.kind==="move")) {
      expect(cameraAt(shot,30000,2432,1664)).toEqual(cameraAt(shot,120000,2432,1664));
      expect(cameraAt(shot,0,2432,1664,true)).toEqual(cameraAt(shot,120000,2432,1664,true));
    }
    const fire=PROLOGUE_SHOTS.find(s=>s.effect==="fire")!, vortex=PROLOGUE_SHOTS.find(s=>s.effect==="vortex")!;
    expect(cameraAt(fire,7000,2432,1664).x).toBeGreaterThan(cameraAt(fire,0,2432,1664).x);
    expect(cameraAt(vortex,5500,2432,1664).angle).toBeCloseTo(4*Math.PI/180);
  });
  it("preserves display pixels independently of effects and stops rendering settled CGs",()=>{
    expect(cgBackingSize(1920,1)).toEqual({width:1920,height:1080});
    expect(cgBackingSize(1280,2)).toEqual({width:2560,height:1440});
    expect(cgBackingSize(1920,2)).toEqual({width:2560,height:1440});
    for(const effect of ["gold","hero","tyrant"])expect(PROLOGUE_SHOTS.find(s=>s.effect===effect)!.transition).toBeGreaterThanOrEqual(1200);
    for(const effect of ["glass"])
      expect(cgAnimationDuration(PROLOGUE_SHOTS.find(s=>s.effect===effect)!,false)).toBe(0);
    expect(cgAnimationDuration(PROLOGUE_SHOTS.find(s=>s.effect==="embrace")!,false)).toBe(6000);
    expect(cgAnimationDuration(PROLOGUE_SHOTS.find(s=>s.effect==="vortex")!,false)).toBe(5500);
    expect(cgAnimationDuration(PROLOGUE_SHOTS.find(s=>s.effect==="fire")!,false)).toBe(Infinity);
    expect(cgAnimationDuration(PROLOGUE_SHOTS.find(s=>s.effect==="fire")!,true)).toBe(0);
  });
  it("covers the incoming picture at the start, dissolves monotonically, and never cuts to black",()=>{
    expect(memoryDissolveAt(0)).toEqual({opacity:1,veil:0});
    expect(memoryDissolveAt(1).opacity).toBe(0);expect(memoryDissolveAt(1).veil).toBeCloseTo(0);
    let last=1;
    for(let t=0;t<=1;t+=.01){
      const sample=memoryDissolveAt(t);
      expect(sample.opacity).toBeLessThanOrEqual(last);expect(sample.opacity).toBeGreaterThanOrEqual(0);
      expect(sample.veil).toBeLessThanOrEqual(.20);last=sample.opacity;
    }
  });
  it("allows complete prose to be read and preserves a quiet embrace after its narration",()=>{
    expect(PROLOGUE_ACT_NAMES).toEqual(["神话","现实","决断","日常"]);
    for(const shot of PROLOGUE_SHOTS)for(const beat of shot.beats)expect(readingDuration(beat)-typingDuration(beat)).toBeGreaterThanOrEqual(1500);
    const longest=PROLOGUE_SHOTS.flatMap(s=>s.beats).reduce((a,b)=>a.text.length>b.text.length?a:b);
    expect(readingDuration(longest)-typingDuration(longest)).toBeGreaterThanOrEqual(longest.text.length*100);
    const embrace=PROLOGUE_SHOTS.find(s=>s.id==="A3-03")!;
    expect(embrace.beats[0].cue).toBe("embrace-warmth");
    expect(embrace.beats.filter(beat=>beat.text)).toHaveLength(2);
    expect(embrace.beats.filter(beat=>beat.cue)).toHaveLength(1);
    expect(embrace.beats[2]).toEqual({text:"",hold:3200});
    const sword=PROLOGUE_SHOTS.find(s=>s.id==="A3-02")!;
    expect(cameraAt(sword,0,1216,832)).toEqual(cameraAt(sword,5000,1216,832));
  });
  it("waits for the line cue even for a slow reader, and lets the effect finish before leaving",()=>{
    const sword=PROLOGUE_SHOTS.find(s=>s.id==="A3-02")!;
    expect(cgFrameTimes(sword,30000,false,null)).toEqual({cameraTime:0,effectTime:0});
    expect(shotEndTime(sword,null)).toBe(Infinity);
    expect(cgFrameTimes(sword,31000,false,30000).effectTime).toBe(1000);
    expect(shotEndTime(sword,30000)).toBe(34000);
    expect(cgFrameTimes(sword,60000,false,30000).effectTime).toBe(4000);
    const embrace=PROLOGUE_SHOTS.find(s=>s.id==="A3-03")!;
    expect(cgFrameTimes(embrace,8000,false,null)).toEqual({cameraTime:6000,effectTime:0});
    expect(cgFrameTimes(embrace,9000,false,8000)).toEqual({cameraTime:6000,effectTime:1000});
    expect(shotEndTime(embrace,8000)).toBe(13500);
    expect(cgFrameTimes(embrace,9000,true,8000)).toEqual({cameraTime:0,effectTime:1000});
  });
});
