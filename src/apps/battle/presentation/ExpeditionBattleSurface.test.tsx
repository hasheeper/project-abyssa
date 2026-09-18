import type { ComponentProps, CSSProperties } from "react";
import { cleanup, fireEvent, render } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { ExpeditionBattleSurface } from "./ExpeditionBattleSurface";
import type { BattleSurfaceEnemy } from "./battle-surface-model";
import attackCss from "../expedition-player-attack.css?raw";
import entryCss from "../battle-entry-content.css?raw";
import enemyStageCss from "../expedition-enemy-stage.css?raw";

afterEach(() => { cleanup(); vi.restoreAllMocks(); });
const enemy = (id: string): BattleSurfaceEnemy => ({
  id, name: "候席客", art: "guest", artUrl: "/guest.png", hp: 3, maxHp: 3, attack: 1,
  blocked: 0, intent: null, defeated: false, frenzyWarning: null, frenzyActive: false,
  threat: null, targetable: false, intentBlockable: false,
});
const sizedEnemy = (id: string, height: number): BattleSurfaceEnemy => ({
  ...enemy(id),
  artStyle: {height, width: "auto", maxWidth: "none"},
});
const noop = () => {};
const base: ComponentProps<typeof ExpeditionBattleSurface> = {
  label: "test battle", onSettle: noop, uiSkin: "timber", party: [], presentedEnemies: [],
  phase: "roll", layerClearPending: false, isRolling: false, interactive: false,
  heldActor: null, attackFx: null, supportFx: null, enemyTurnFx: null,
  isPresentationBusy: () => false, handleMemberCardClick: noop,
  handleEnemyClick: noop, handleIntentClick: noop, dicePanel: null, sidebar: null, overlays: null,
};
function Subject({phase, enemies, entrance = true}: {phase: string; enemies: BattleSurfaceEnemy[]; entrance?: boolean}) {
  return <><style>{attackCss + entryCss}</style>
    <div className="scene-sequence" data-battle-motion="board" data-phase={phase}>
      <ExpeditionBattleSurface {...base} entrance={entrance} presentedEnemies={enemies}/>
    </div>
  </>;
}

it("initial enemies reveal once and never re-enable the mount animation at idle", () => {
  const {container, rerender} = render(<Subject phase="prepare" enemies={[enemy("initial")]}/>);
  const seat = container.querySelector<HTMLElement>(".abyssa-expedition-enemy")!;
  expect(seat).toHaveAttribute("data-entry-seated");
  expect(getComputedStyle(seat).animation).not.toContain("expedition-enemy-enter");
  rerender(<Subject phase="in" enemies={[enemy("initial")]}/>);
  expect(getComputedStyle(seat).animation).toContain("manor-seat-in");
  rerender(<Subject phase="idle" enemies={[{...enemy("initial"), hp: 2}]}/>);
  expect(container.querySelector(".abyssa-expedition-enemy")).toBe(seat);
  expect(getComputedStyle(seat).animation).not.toMatch(/manor-seat-in|expedition-enemy-enter/);
});

it("later summons and room enemies retain their own reveal without replaying settled seats", () => {
  const {container, rerender} = render(<Subject phase="in" enemies={[enemy("initial")]}/>);
  rerender(<Subject phase="idle" enemies={[enemy("initial"), enemy("summoned")]}/>);
  const seats = container.querySelectorAll<HTMLElement>(".abyssa-expedition-enemy");
  expect(seats[0]).toHaveAttribute("data-entry-seated");
  expect(getComputedStyle(seats[0]).animation).not.toContain("expedition-enemy-enter");
  expect(seats[1]).not.toHaveAttribute("data-entry-seated");
  expect(getComputedStyle(seats[1]).animation).toContain("expedition-enemy-enter");
  rerender(<Subject phase="idle" enemies={[enemy("next-room")]}/>);
  expect(getComputedStyle(container.querySelector(".abyssa-expedition-enemy")!).animation).toContain("expedition-enemy-enter");
});

it("an initially empty room and non-manor battles do not claim future enemies", () => {
  const mounted = render(<Subject phase="in" enemies={[]}/>);
  mounted.rerender(<Subject phase="idle" enemies={[enemy("encounter")]}/>);
  expect(mounted.container.querySelector(".abyssa-expedition-enemy")).not.toHaveAttribute("data-entry-seated");
  mounted.unmount();
  const legacy = render(<Subject phase="idle" entrance={false} enemies={[enemy("legacy")]}/>);
  const seat = legacy.container.querySelector(".abyssa-expedition-enemy")!;
  expect(seat).not.toHaveAttribute("data-entry-seated");
  expect(getComputedStyle(seat).animation).toContain("expedition-enemy-enter");
});

it("keeps authored enemy sizes and replaces the rendered scene when the formation changes", () => {
  const shore = {backgroundImage: 'url("/shore.jpg")'} as CSSProperties;
  const cargo = {backgroundImage: 'url("/cargo.jpg")'} as CSSProperties;
  const enemies = [sizedEnemy("chief", 266), sizedEnemy("hauler", 280), sizedEnemy("slime", 145)];
  const mounted = render(<ExpeditionBattleSurface {...base} sceneStyle={shore} presentedEnemies={enemies}/>);
  const art = () => [...mounted.container.querySelectorAll<HTMLElement>(".abyssa-expedition-enemy > img")];
  expect(art().map(node => [node.style.height, node.style.maxWidth])).toEqual([
    ["266px", "none"], ["280px", "none"], ["145px", "none"],
  ]);
  expect(mounted.container.querySelector<HTMLElement>(".abyssa-expedition-enemies")!.style.backgroundImage).toContain("shore.jpg");
  expect(mounted.container.querySelector<HTMLElement>(".abyssa-expedition-scene")!.style.backgroundImage).toContain("shore.jpg");

  mounted.rerender(<ExpeditionBattleSurface {...base} sceneStyle={cargo} presentedEnemies={enemies.slice(0, 2)}/>);
  expect(art().map(node => [node.style.height, node.style.maxWidth])).toEqual([
    ["266px", "none"], ["280px", "none"],
  ]);
  expect(mounted.container.querySelector<HTMLElement>(".abyssa-expedition-enemies")!.style.backgroundImage).toContain("cargo.jpg");
  expect(mounted.container.querySelector<HTMLElement>(".abyssa-expedition-scene")!.style.backgroundImage).toContain("cargo.jpg");
});

it("has one hover preview, dispatches the original click once, and never locks selection", () => {
  const handleEnemyClick=vi.fn(), handleIntentClick=vi.fn();
  const enemies=[{...enemy("a"),targetable:true,intentBlockable:true,intent:{type:"attack",title:"攻击",value:3,description:"攻击目标"}}, {...enemy("b"),boss:true}];
  const {container,getByLabelText}=render(<ExpeditionBattleSurface {...base} interactive presentedEnemies={enemies} handleEnemyClick={handleEnemyClick} handleIntentClick={handleIntentClick}/>);
  const [a,b]=container.querySelectorAll<HTMLElement>(".abyssa-expedition-enemy");
  fireEvent.pointerEnter(a,{pointerType:"mouse"});
  expect(a).toHaveAttribute("data-previewed");
  expect(b).not.toHaveAttribute("data-previewed");
  fireEvent.pointerDown(a,{pointerType:"mouse"});
  fireEvent.click(a);
  expect(handleEnemyClick).toHaveBeenCalledExactlyOnceWith("a");
  fireEvent.click(getByLabelText("攻击目标"));
  expect(handleIntentClick).toHaveBeenCalledExactlyOnceWith("a");
  expect(handleEnemyClick).toHaveBeenCalledTimes(1);
  fireEvent.pointerLeave(a);
  expect(container.querySelector("[data-previewed]")).toBeNull();
  fireEvent.pointerEnter(b,{pointerType:"mouse"});
  expect(b).toHaveAttribute("data-previewed");
  expect(getByLabelText("首领（Boss）")).toBeInTheDocument();
  expect(container.querySelectorAll("[data-boss]")).toHaveLength(1);
});

it("restores keyboard preview after pointer input and suppresses it when inert or busy", () => {
  const target={...enemy("a"),targetable:true};
  const handleEnemyClick=vi.fn();
  const props={...base,interactive:true,presentedEnemies:[target],handleEnemyClick};
  const {container,rerender}=render(<ExpeditionBattleSurface {...props}/>);
  const a=container.querySelector<HTMLElement>(".abyssa-expedition-enemy")!;
  const nativeMatches=a.matches.bind(a);
  vi.spyOn(a,"matches").mockImplementation(selector=>selector===":focus-visible"||nativeMatches(selector));
  fireEvent.pointerDown(a);
  fireEvent.keyDown(container.querySelector("main")!,{key:"Tab"});
  fireEvent.focus(a);
  expect(a).toHaveAttribute("data-previewed");
  fireEvent.keyDown(a,{key:"Enter"});
  expect(handleEnemyClick).toHaveBeenCalledExactlyOnceWith("a");
  rerender(<ExpeditionBattleSurface {...props} inert/>);
  expect(a).not.toHaveAttribute("data-previewed");
  rerender(<ExpeditionBattleSurface {...props} isRolling/>);
  expect(a).not.toHaveAttribute("data-previewed");
  rerender(<ExpeditionBattleSurface {...props}/>);
  fireEvent.blur(a);
  expect(a).not.toHaveAttribute("data-previewed");
});

it("keeps the boss badge in a fixed icon box instead of an inherited text baseline", () => {
  const {getByLabelText}=render(<><style>{enemyStageCss}</style>
    <ExpeditionBattleSurface {...base} presentedEnemies={[{...enemy("chief"),boss:true}]}/>
  </>);
  const style=getComputedStyle(getByLabelText("首领（Boss）"));
  expect(style.display).toBe("flex");
  expect(style.alignItems).toBe("center");
  expect(style.lineHeight).toBe("0");
  expect(style.width).toBe("16px");
  expect(style.height).toBe("12px");
  expect(style.top).toBe("-10px");
});

it("previews touch only during contact, without leaving a click lock", () => {
  const handleEnemyClick=vi.fn();
  const {container}=render(<ExpeditionBattleSurface {...base} interactive presentedEnemies={[{...enemy("touch"),targetable:true}]} handleEnemyClick={handleEnemyClick}/>);
  const target=container.querySelector<HTMLElement>(".abyssa-expedition-enemy")!;
  const pointer=(type:string)=>{
    const event=new Event(type,{bubbles:true});
    Object.defineProperty(event,"pointerType",{value:"touch"});
    return event;
  };
  fireEvent(target,pointer("pointerdown"));
  expect(target).toHaveAttribute("data-previewed");
  fireEvent(target,pointer("pointerup"));
  fireEvent.click(target);
  expect(handleEnemyClick).toHaveBeenCalledExactlyOnceWith("touch");
  expect(target).not.toHaveAttribute("data-previewed");
  fireEvent(target,pointer("pointerdown"));
  fireEvent(target,pointer("pointercancel"));
  expect(target).not.toHaveAttribute("data-previewed");
});

it("renders eight HP pearls as 4+4 and starts the extra layer label above 32 HP", () => {
  const target={...enemy("health"),hp:12,maxHp:32};
  const {container,rerender,getByLabelText}=render(<ExpeditionBattleSurface {...base} presentedEnemies={[target]}/>);
  const pearls=()=>[...container.querySelectorAll(".abyssa-expedition-enemy__health i")];
  expect([...container.querySelectorAll(".abyssa-enemy-health-group")].map(group=>group.children.length)).toEqual([4,4]);
  expect(pearls().map(p=>p.getAttribute("data-layer"))).toEqual(["2","2","2","2","1","1","1","1"]);
  expect(container.querySelector(".abyssa-enemy-health-layer")).toBeNull();
  rerender(<ExpeditionBattleSurface {...base} presentedEnemies={[{...target,hp:33,maxHp:33}]}/>);
  expect(getByLabelText("第 5 层")).toHaveTextContent("Ⅴ");
  expect(pearls()).toHaveLength(8);
  expect(container.querySelectorAll(".abyssa-expedition-enemy__health i[data-buried]")).toHaveLength(7);
});

it("measures links below HP and above stable party columns on first render and after resize", () => {
  const rect=(left:number,top:number,width:number,height:number)=>({left,top,width,height,right:left+width,bottom:top+height,x:left,y:top,toJSON:()=>({})});
  let scale=.8;
  vi.spyOn(HTMLElement.prototype,"clientWidth","get").mockImplementation(function(this:HTMLElement){return this.classList.contains("abyssa-expedition-enemies")?880:0;});
  vi.spyOn(HTMLElement.prototype,"clientHeight","get").mockImplementation(function(this:HTMLElement){return this.classList.contains("abyssa-expedition-enemies")?361:0;});
  vi.spyOn(HTMLElement.prototype,"offsetWidth","get").mockImplementation(function(this:HTMLElement){return this.classList.contains("abyssa-expedition-enemies")?880:0;});
  vi.spyOn(HTMLElement.prototype,"offsetHeight","get").mockImplementation(function(this:HTMLElement){return this.classList.contains("abyssa-expedition-enemies")?361:0;});
  vi.spyOn(HTMLElement.prototype,"getBoundingClientRect").mockImplementation(function(this:HTMLElement){
    if(this.classList.contains("abyssa-expedition-enemies"))return rect(100,50,880*scale,361*scale);
    if(this.classList.contains("abyssa-expedition-party-column"))return rect(100+200*scale,50+400*scale,160*scale,285*scale);
    return rect(0,0,0,0);
  });
  const target={...enemy("a"),intent:{type:"attack",title:"攻击",targetId:"kael"}};
  const party=[{id:"kael",hp:5,maxHp:5,returnHp:5,downed:false,shield:0,ready:false,healable:false,incoming:{raw:1,final:1}}];
  const {container,rerender}=render(<ExpeditionBattleSurface {...base} party={party} presentedEnemies={[target]}/>);
  const path=container.querySelector(".abyssa-expedition-intent-line__body")!;
  expect(path.getAttribute("d")).toBe("M 440 356 C 440 374.5 280 374.5 280 393");
  const art=container.querySelector<HTMLImageElement>(".abyssa-expedition-enemy > img")!;
  expect(parseFloat(art.style.height)).toBeGreaterThan(0);
  scale=.6;
  fireEvent(window,new Event("resize"));
  expect(path.getAttribute("d")).toBe("M 440 356 C 440 374.5 280 374.5 280 393");
  rerender(<ExpeditionBattleSurface {...base} party={party} presentedEnemies={[{...target,defeated:true}]}/>);
  expect(container.querySelector(".abyssa-expedition-intent-line__body")).toBeNull();
});
