import { act, cleanup, fireEvent, render } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { UiMotionProvider } from "../../../shared/ui/motion/UiMotionProvider";
import { useEnemyStageLayout } from "./useEnemyStageLayout";
import { intentLinkPath } from "./enemy-stage-model";
import type { BattleSurfaceEnemy } from "./battle-surface-model";

const enemies:BattleSurfaceEnemy[]=Array.from({length:8},(_,i)=>({id:`e-${i}`,name:`Enemy ${i}`,art:"test",artUrl:"/enemy.png",artStyle:{height:160+i*5},hp:8,maxHp:8,attack:1,blocked:0,intent:{type:"attack",title:"攻击",value:1,targetId:"kael"},defeated:false,frenzyWarning:null,frenzyActive:false,threat:"normal",targetable:true,intentBlockable:false}));
function Harness({shown,formation="one",reduced=false}:{shown:BattleSurfaceEnemy[];formation?:string;reduced?:boolean}) {
  return <UiMotionProvider preference={reduced?"reduced":"system"}><Board shown={shown} formation={formation}/></UiMotionProvider>;
}
function Board({shown,formation}:{shown:BattleSurfaceEnemy[];formation:string}) {
  const {stageRef,lines,reflowing}=useEnemyStageLayout(shown,formation,["kael"],true);
  return <div className="abyssa-expedition-regions__battlefield" data-reflowing={reflowing}>
    <section ref={stageRef} className="abyssa-expedition-enemies"><div className="abyssa-expedition-enemies__formation">
      {shown.map(enemy=><article key={enemy.id} className="abyssa-expedition-enemy" data-enemy-id={enemy.id}><header><strong>{enemy.name}</strong></header><button className="abyssa-expedition-intent"><b>1</b></button><img alt="" src={enemy.artUrl}/></article>)}
    </div><svg className="abyssa-expedition-enemies__intent-lines">{lines.links.map(link=><g key={link.id} data-enemy-id={link.id}><path d={intentLinkPath(link)}/><circle cx={link.fromX}/></g>)}</svg></section>
    <div className="abyssa-expedition-party-column"><div className="abyssa-expedition-party-card" data-character="kael"/></div>
  </div>;
}
let now=0,frameId=0,screenOffset=0;
let frames:Map<number,FrameRequestCallback>;
const rect=(left:number,top:number,width:number,height:number)=>({left,top,width,height,right:left+width,bottom:top+height,x:left,y:top,toJSON:()=>({})});
beforeEach(()=>{
  now=0;frameId=0;screenOffset=0;frames=new Map();
  vi.spyOn(performance,"now").mockImplementation(()=>now);
  vi.stubGlobal("requestAnimationFrame",(fn:FrameRequestCallback)=>{frames.set(++frameId,fn);return frameId;});
  vi.stubGlobal("cancelAnimationFrame",(id:number)=>frames.delete(id));
  for(const [property,size] of [["clientWidth",880],["offsetWidth",880],["clientHeight",361],["offsetHeight",361]] as const)
    vi.spyOn(HTMLElement.prototype,property,"get").mockImplementation(function(this:HTMLElement){return this.classList.contains("abyssa-expedition-enemies")?size:0;});
  vi.spyOn(HTMLElement.prototype,"getBoundingClientRect").mockImplementation(function(this:HTMLElement){
    if(this.classList.contains("abyssa-expedition-enemies"))return rect(100+screenOffset,50,704,288.8);
    if(this.classList.contains("abyssa-expedition-party-column"))return rect(260+screenOffset,370,128,228);
    return rect(0,0,0,0);
  });
});
afterEach(()=>{cleanup();vi.restoreAllMocks();vi.unstubAllGlobals();});
const step=(time:number)=>act(()=>{now=time;const pending=[...frames.values()];frames.clear();pending.forEach(fn=>fn(time));});
const nodes=(container:HTMLElement)=>[...container.querySelectorAll<HTMLElement>("article")];
const displayedLeft=(node:HTMLElement)=>parseFloat(node.style.left)+(parseFloat(node.style.translate)||0);
const positions=(container:HTMLElement)=>nodes(container).map(node=>({id:node.dataset.enemyId,left:displayedLeft(node),height:node.querySelector("img")!.style.height,top:node.querySelector("img")!.style.top}));

it("holds the dying slot until removal, then slides survivors and their sockets on the same clock",()=>{
  const {container,rerender}=render(<Harness shown={enemies}/>);
  const before=positions(container);
  rerender(<Harness shown={enemies.map(e=>e.id==="e-3"?{...e,defeated:true}:e)}/>);
  expect(positions(container)).toEqual(before);
  const alive=enemies.filter(e=>e.id!=="e-3");
  rerender(<Harness shown={alive}/>);
  const start=positions(container);
  expect(start).toEqual(before.filter(e=>e.id!=="e-3"));
  expect(container.firstChild).toHaveAttribute("data-reflowing","true");
  step(210);
  const middle=positions(container);
  expect(middle.some((e,i)=>Math.abs(e.left-start[i].left)>1)).toBe(true);
  for(const node of nodes(container)) {
    const center=displayedLeft(node)+parseFloat(node.style.width)/2;
    const group=container.querySelector(`g[data-enemy-id="${node.dataset.enemyId}"]`)!;
    expect(Number(group.querySelector("circle")!.getAttribute("cx"))).toBeCloseTo(center);
    expect(Number(group.querySelector("path")!.getAttribute("d")!.split(" ")[1])).toBeCloseTo(center);
  }
  step(420);
  const end=positions(container);
  end.forEach((e,i)=>{
    expect(middle[i].left).toBeCloseTo(start[i].left+(e.left-start[i].left)*.875);
    expect(e.height).toBe(start[i].height);expect(e.top).toBe(start[i].top);
  });
  expect(container.firstChild).toHaveAttribute("data-reflowing","false");
  expect(frames.size).toBe(0);
});

it("retargets a second kill or undo from the currently displayed position, without jumping back",()=>{
  const {container,rerender}=render(<Harness shown={enemies}/>);
  rerender(<Harness shown={enemies.filter(e=>e.id!=="e-3")}/>);
  step(120);
  const midway=positions(container);
  rerender(<Harness shown={enemies.filter(e=>!["e-3","e-4"].includes(e.id))}/>);
  expect(positions(container)).toEqual(midway.filter(e=>e.id!=="e-4"));
  step(240);
  const undoFrom=positions(container);
  rerender(<Harness shown={enemies}/>);
  expect(positions(container).filter(e=>undoFrom.some(p=>p.id===e.id))).toEqual(undoFrom);
  step(660);
  expect(frames.size).toBe(0);
});

it("does not invent a move after entrance, page scaling/offset, or a harmless render",()=>{
  const {container,rerender}=render(<Harness shown={enemies}/>);
  const before=positions(container);
  screenOffset=300;
  fireEvent(window,new Event("resize"));
  expect(frames.size).toBe(1);
  step(16);
  rerender(<Harness shown={enemies.map(e=>({...e,hp:7}))}/>);
  expect(positions(container)).toEqual(before);
  expect(frames.size).toBe(0);
});

it("settles immediately for reduced motion/new encounters and cancels on unmount",()=>{
  const {container,rerender,unmount}=render(<Harness shown={enemies}/>);
  rerender(<Harness shown={enemies.slice(1)}/>);
  expect(frames.size).toBe(1);
  rerender(<Harness shown={enemies.slice(1)} reduced/>);
  expect(frames.size).toBe(0);
  expect(container.firstChild).toHaveAttribute("data-reflowing","false");
  rerender(<Harness shown={enemies.slice(2)} formation="two"/>);
  expect(frames.size).toBe(0);
  rerender(<Harness shown={enemies.slice(3)} formation="two"/>);
  expect(frames.size).toBe(1);
  unmount();expect(frames.size).toBe(0);
});

it("coalesces external geometry events and ignores attack/dice animation endings",()=>{
  const {container}=render(<Harness shown={enemies}/>);
  const stage=container.querySelector<HTMLElement>(".abyssa-expedition-enemies")!;
  const measure=vi.spyOn(stage,"getBoundingClientRect");
  const end=(target:Element,name:string)=>{
    const event=new Event("animationend",{bubbles:true});
    Object.defineProperty(event,"animationName",{value:name});
    fireEvent(target,event);
  };
  end(nodes(container)[0],"expedition-attack-flash");
  end(nodes(container)[0].querySelector("img")!,"expedition-enemy-enter");
  end(container.firstElementChild!,"expedition-die-roll");
  expect(frames.size).toBe(0);
  end(nodes(container)[0],"expedition-enemy-enter");
  fireEvent(window,new Event("resize"));
  fireEvent.load(nodes(container)[0].querySelector("img")!);
  end(container.querySelector(".abyssa-expedition-party-column")!,"manor-party-in");
  expect(measure).not.toHaveBeenCalled();
  expect(frames.size).toBe(1);
  step(16);
  expect(measure).toHaveBeenCalledTimes(1);
  expect(frames.size).toBe(0);
});

it("per-frame reflow leaves layout coordinates fixed, never measures or queries nodes",()=>{
  const {container,rerender}=render(<Harness shown={enemies}/>);
  rerender(<Harness shown={enemies.slice(1)}/>);
  const units=nodes(container),lefts=units.map(node=>node.style.left);
  const read=vi.spyOn(HTMLElement.prototype,"getBoundingClientRect");
  const query=vi.spyOn(Element.prototype,"querySelectorAll");
  const styles=units.map(node=>vi.spyOn(node.style,"setProperty"));
  read.mockClear();query.mockClear();
  step(100);step(210);
  expect(units.map(node=>node.style.left)).toEqual(lefts);
  expect(units.some(node=>parseFloat(node.style.translate)!==0)).toBe(true);
  expect(read).not.toHaveBeenCalled();
  expect(query).not.toHaveBeenCalled();
  expect(styles.flatMap(spy=>spy.mock.calls).every(([key])=>["translate","will-change"].includes(key))).toBe(true);
  step(420);
  expect(units.every(node=>!node.style.translate&&!node.style.willChange)).toBe(true);
});

it("batches constrained intent reads before writing any notch caps",()=>{
  const writes=vi.spyOn(CSSStyleDeclaration.prototype,"setProperty");
  const writeCountsAtRead:number[]=[];
  vi.spyOn(HTMLElement.prototype,"offsetWidth","get").mockImplementation(function(this:HTMLElement){
    if(this.classList.contains("abyssa-expedition-intent")) {
      writeCountsAtRead.push(writes.mock.calls.length);
      return 32;
    }
    return this.classList.contains("abyssa-expedition-enemies")?880:0;
  });
  const {container}=render(<Harness shown={enemies}/>);
  expect(writeCountsAtRead).toHaveLength(8);
  expect(new Set(writeCountsAtRead).size).toBe(1);
  const firstCap=writes.mock.calls.findIndex(([key])=>key==="--enemy-cap-left");
  expect(firstCap).toBe(writeCountsAtRead[0]);
  expect(nodes(container).every(node=>node.style.getPropertyValue("--enemy-cap-width")==="46px")).toBe(true);
});

it("settles and cancels both clocks while hidden, then measures once on return",()=>{
  const {container,rerender,unmount}=render(<Harness shown={enemies}/>);
  rerender(<Harness shown={enemies.slice(1)}/>);
  step(100);
  fireEvent(window,new Event("resize"));
  const hidden=vi.spyOn(document,"hidden","get").mockReturnValue(true);
  fireEvent(document,new Event("visibilitychange"));
  expect(frames.size).toBe(0);
  expect(container.firstChild).toHaveAttribute("data-reflowing","false");
  expect(nodes(container).every(node=>!node.style.translate)).toBe(true);
  hidden.mockReturnValue(false);
  fireEvent(document,new Event("visibilitychange"));
  expect(frames.size).toBe(1);
  step(800);
  expect(frames.size).toBe(0);
  fireEvent(window,new Event("resize"));
  unmount();expect(frames.size).toBe(0);
});
