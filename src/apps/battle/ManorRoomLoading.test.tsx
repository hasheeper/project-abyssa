import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
vi.mock("../../shared/loading/images",()=>({prepareImages:vi.fn(async()=>{})}));
import { prepareImages } from "../../shared/loading/images";
import { manorClientFixture } from "../../game-client/testing/manor";
import { journeyOf, playToJourney } from "../../game-client/testing/journey-flow";
import { GameSessionScope } from "../../game-client/react";
import { SceneTransitionContext } from "../../shared/transition/TransitionProvider";
import { ManorBattleBinding } from "./ManorBattleBinding";
import { manorJourneyStory } from "./presentation/manor-journey-story";
import { JOURNEY_MOTION_MS } from "./presentation/journey-motion";

const fixtures:Awaited<ReturnType<typeof manorClientFixture>>[]=[];
afterEach(()=>{cleanup();fixtures.splice(0).forEach(f=>f.session.dispose());sessionStorage.clear();vi.useRealTimers();vi.restoreAllMocks();vi.unstubAllGlobals();vi.mocked(prepareImages).mockResolvedValue();});
const advance=(ms:number)=>act(()=>vi.advanceTimersByTimeAsync(ms));
function deferred() {
  let resolve!:()=>void,reject!:(error:Error)=>void;
  const promise=new Promise<void>((yes,no)=>{resolve=yes;reject=no;});
  return {promise,resolve,reject};
}
async function setup() {
  const f=await manorClientFixture(19,4);fixtures.push(f);
  await playToJourney(f,v=>v.expedition?.node==="room-complete"&&v.lastEvent?.method==="read");
  const story=manorJourneyStory(journeyOf(f))!;
  sessionStorage.setItem("abyssa:scene-reading:v1:manor-save:epoch",JSON.stringify({[story.id]:story.lines.length}));
  vi.useFakeTimers();
  const mounted=render(<GameSessionScope session={f.session}>
    <SceneTransitionContext.Provider value={{phase:"idle",isTransitioning:false,navigate:()=>true,holdReady:()=>()=>{}}}>
      <ManorBattleBinding uiSkin="old-manor" onSettle={()=>{}}/>
    </SceneTransitionContext.Provider>
  </GameSessionScope>);
  await advance(0);
  await advance(40);
  for(const node of mounted.container.querySelectorAll<HTMLElement>("[data-scene-settle]"))
    fireEvent(node,Object.assign(new Event("animationend",{bubbles:true}),{animationName:node.dataset.sceneSettle}));
  expect(mounted.container.querySelector(".scene-sequence")).toHaveAttribute("data-phase","idle");
  vi.mocked(prepareImages).mockClear();
  return {...mounted,f,board:screen.getByRole("main",{name:"克雷格旧庄园战斗界面"})};
}
const enterNext=()=>act(async()=>{fireEvent.click(screen.getByRole("button",{name:"继续前进"}));});
const reachHandoff=async()=>{
  await advance(JOURNEY_MOTION_MS.walking);
  await advance(JOURNEY_MOTION_MS.encounter);
  await advance(JOURNEY_MOTION_MS.flash);
};

it("keeps the current board during delayed next-room art instead of inserting the full-screen loading page",async()=>{
  const {container,board,f}=await setup();
  const next=deferred();vi.mocked(prepareImages).mockReturnValue(next.promise);
  const party=[...board.querySelectorAll(".abyssa-expedition-party-card")];
  await enterNext();
  const head=f.session.getSnapshot().record!.head;
  await reachHandoff();
  expect(container.querySelector(".battle-scene-preparation")).toBeNull();
  expect(board).toHaveAttribute("data-journey-motion","loading");
  expect(board.querySelectorAll(".abyssa-expedition-enemy")).toHaveLength(0);
  expect([...board.querySelectorAll(".abyssa-expedition-party-card")]).toEqual(party);
  expect(container.querySelector("[data-manor-assets]")).toHaveAttribute("data-manor-assets","ready");
  await act(async()=>next.resolve());
  await advance(180);
  expect(board).toHaveAttribute("data-journey-motion","loaded");
  expect(board.querySelectorAll(".abyssa-expedition-enemy")).toHaveLength(3);
  await advance(JOURNEY_MOTION_MS.revealing);
  expect(board).not.toHaveAttribute("data-journey-motion");
  expect(screen.getByRole("button",{name:"ROLL"})).toBeEnabled();
  expect(f.session.getSnapshot().record!.head).toEqual(head);
},60000);

it("prepares during the old room's walk and never shows a loader for already-ready assets",async()=>{
  const {container,board,f}=await setup();
  const dispatch=vi.spyOn(f.session,"dispatch");
  await enterNext();
  expect(board).toHaveAttribute("data-journey-motion","walking");
  expect(prepareImages).toHaveBeenCalled();
  expect(board.querySelectorAll(".abyssa-expedition-enemy")).toHaveLength(0);
  await reachHandoff();
  expect(board).toHaveAttribute("data-journey-motion","revealing");
  expect(container.querySelector(".battle-scene-preparation")).toBeNull();
  expect(screen.queryByLabelText("下一层场景载入")).toBeNull();
  await advance(JOURNEY_MOTION_MS.revealing);
  expect(screen.getByRole("button",{name:"ROLL"})).toBeEnabled();
  expect(dispatch).toHaveBeenCalledTimes(1);
},60000);

it("keeps a failed load local and retries images without re-submitting the room command",async()=>{
  const {container,board,f}=await setup();
  const dispatch=vi.spyOn(f.session,"dispatch");
  vi.mocked(prepareImages).mockRejectedValue(new Error("missing next-room art"));
  await enterNext();
  const head=f.session.getSnapshot().record!.head;
  await reachHandoff();
  const error=screen.getByRole("alert",{name:"下一层场景载入"});
  expect(error.closest(".abyssa-expedition-enemies")).not.toBeNull();
  expect(container.querySelector(".battle-scene-preparation")).toBeNull();
  expect(board.querySelectorAll(".abyssa-expedition-enemy")).toHaveLength(0);
  vi.mocked(prepareImages).mockResolvedValue();
  await act(async()=>fireEvent.click(screen.getByRole("button",{name:"重新加载画面"})));
  await advance(180+JOURNEY_MOTION_MS.revealing);
  expect(screen.queryByLabelText("下一层场景载入")).toBeNull();
  expect(screen.getByRole("button",{name:"ROLL"})).toBeEnabled();
  expect(f.session.getSnapshot().record!.head).toEqual(head);
  expect(dispatch).toHaveBeenCalledTimes(1);
},60000);

it("keeps a newly announced loading plaque readable before uncovering the next room",async()=>{
  const {board}=await setup();
  const next=deferred();vi.mocked(prepareImages).mockReturnValue(next.promise);
  await enterNext();await reachHandoff();
  await advance(310);
  expect(screen.getByLabelText("下一层场景载入")).toHaveTextContent("正在载入场景");
  await act(async()=>next.resolve());
  await advance(169);
  expect(board).toHaveAttribute("data-journey-motion","loading");
  await advance(1);
  expect(board).toHaveAttribute("data-journey-motion","loaded");
  await advance(JOURNEY_MOTION_MS.revealing);
  expect(screen.queryByLabelText("下一层场景载入")).toBeNull();
},60000);

it.each([false,true])("reduced motion skips the encounter but waits safely for assets (slow: %s)",async slow=>{
  const {container,board,f}=await setup();
  vi.stubGlobal("matchMedia",()=>({matches:true,addEventListener:()=>{},removeEventListener:()=>{}}));
  const next=deferred();
  if(slow)vi.mocked(prepareImages).mockReturnValue(next.promise);
  await enterNext();
  const head=f.session.getSnapshot().record!.head;
  expect(board).not.toHaveAttribute("data-journey-motion");
  expect(container.querySelector(".battle-scene-preparation")).toBeNull();
  if(slow) {
    expect(board.querySelectorAll(".abyssa-expedition-enemy")).toHaveLength(0);
    await advance(300);
    expect(board).toHaveAttribute("data-journey-motion","loading");
    await act(async()=>next.resolve());
    await advance(180);
  }
  expect(board).not.toHaveAttribute("data-journey-motion");
  expect(screen.queryByLabelText("下一层场景载入")).toBeNull();
  expect(board.querySelectorAll(".abyssa-expedition-enemy")).toHaveLength(3);
  expect(screen.getByRole("button",{name:"ROLL"})).toBeEnabled();
  expect(f.session.getSnapshot().record!.head).toEqual(head);
},60000);

it.each(["refresh","hidden","unmount"] as const)("cancels a pending resource handoff on %s without replaying it when the image arrives",async mode=>{
  const {container,board,f,unmount}=await setup();
  const next=deferred();vi.mocked(prepareImages).mockReturnValue(next.promise);
  await enterNext();await reachHandoff();
  expect(board).toHaveAttribute("data-journey-motion","loading");
  const head=f.session.getSnapshot().record!.head;
  if(mode==="refresh")await act(()=>f.session.refresh());
  if(mode==="hidden") {
    vi.spyOn(document,"hidden","get").mockReturnValue(true);
    fireEvent(document,new Event("visibilitychange"));
  }
  if(mode==="unmount")unmount();
  await act(async()=>next.resolve());
  await advance(1000);
  expect(container.querySelector(".battle-room-loading")).toBeNull();
  if(mode!=="unmount") {
    expect(board).not.toHaveAttribute("data-journey-motion");
    expect(board.querySelectorAll(".abyssa-expedition-enemy")).toHaveLength(3);
  }
  expect(f.session.getSnapshot().record!.head).toEqual(head);
},60000);
