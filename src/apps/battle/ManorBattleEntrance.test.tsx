import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
vi.mock("../../shared/loading/images", () => ({prepareImages: vi.fn(async () => {})}));
import { prepareImages } from "../../shared/loading/images";
import { GameSessionScope } from "../../game-client/react";
import { manorClientFixture } from "../../game-client/testing/manor";
import { SceneTransitionContext } from "../../shared/transition/TransitionProvider";
import type { SceneTransitionPhase } from "../../shared/transition/types";
import { SCENE_SEQUENCE_MS } from "../../shared/presentation/adv/SceneSequence";
import { ManorBattleBinding } from "./ManorBattleBinding";
import { manorScene } from "./presentation/manor-scene";
import { manorEnemyArt, manorScenes } from "../../content/presentation/old-manor";

type Fixture = Awaited<ReturnType<typeof manorClientFixture>>;
const fixtures: Fixture[] = [];
const holdReady = () => () => {};
afterEach(() => {cleanup();fixtures.splice(0).forEach(f=>f.session.dispose());vi.useRealTimers();vi.restoreAllMocks();vi.mocked(prepareImages).mockResolvedValue();});
const advance = (ms = 0) => act(() => vi.advanceTimersByTimeAsync(ms));
const settleBoard = () => {
  for (const node of document.querySelectorAll<HTMLElement>("[data-scene-settle]"))
    fireEvent(node, Object.assign(new Event("animationend", {bubbles:true}), {animationName:node.dataset.sceneSettle}));
};
function Mount({f,phase}: {f:Fixture;phase:SceneTransitionPhase}) {
  return <GameSessionScope session={f.session}><SceneTransitionContext.Provider value={{phase,isTransitioning:phase!=="idle",navigate:()=>true,holdReady}}>
    <ManorBattleBinding uiSkin="old-manor" onSettle={()=>{}}/>
  </SceneTransitionContext.Provider></GameSessionScope>;
}
it("prepares the real initial encounter behind the curtain, then reveals once without rolling", async () => {
  const f = await manorClientFixture(19,4); fixtures.push(f); vi.useFakeTimers();
  const head = f.session.getSnapshot().record!.head;
  const mounted = render(<Mount f={f} phase="closed"/>);
  await advance(2000);
  const seq = mounted.container.querySelector(".scene-sequence");
  expect(seq).toHaveAttribute("data-phase", "prepare");
  expect(screen.getAllByText("候席客")).toHaveLength(3);
  const seats = [...mounted.container.querySelectorAll(".abyssa-expedition-enemy")];
  expect(seats.every(seat => seat.hasAttribute("data-entry-seated"))).toBe(true);
  const diceRegion = within(screen.getByRole("region",{name:"骰子区域"}));
  expect(diceRegion.getByRole("button",{name:"ROLL"})).toBeDisabled();
  const dice = [...mounted.container.querySelectorAll<HTMLElement>(".expedition-die-entry")];
  expect(dice).toHaveLength(f.runtime.queries.journey(f.session.getSnapshot().record!)!.party.length);
  expect(dice.every(die => die.dataset.sceneSettle === "manor-die-land")).toBe(true);
  const rotations = [...mounted.container.querySelectorAll<HTMLElement>(".expedition-die__cube")].map(cube => cube.style.transform);
  expect(mounted.container.querySelector("[data-manor-scene]")).toHaveAttribute("data-manor-scene", "old-manor.welcoming-hall");
  expect(mounted.container.querySelector(".abyssa-expedition-frame__header > span")).toHaveTextContent("迎客门厅");
  const outer = mounted.container.querySelector<HTMLElement>("[data-manor-scene]")!;
  const inner = mounted.container.querySelector<HTMLElement>(".abyssa-expedition-scene")!;
  expect(outer.style.getPropertyValue("--manor-scene-image")).toContain(manorScenes["old-manor.welcoming-hall"]);
  expect(inner.style.backgroundImage).toContain(manorScenes["old-manor.welcoming-hall"]);
  mounted.rerender(<Mount f={f} phase="opening"/>); await advance(620);
  expect(seq).toHaveAttribute("data-phase", "prepare");
  mounted.rerender(<Mount f={f} phase="idle"/>); await advance(40);
  expect(seq).toHaveAttribute("data-phase", "in");
  await advance(SCENE_SEQUENCE_MS.boardIn);
  fireEvent(mounted.container.querySelector(".abyssa-expedition-frame")!, Object.assign(new Event("animationend", {bubbles:true}), {animationName:"manor-board-settle"}));
  expect(diceRegion.getByRole("button",{name:"ROLL"})).toBeDisabled();
  expect(seq).toHaveAttribute("data-phase", "in");
  settleBoard();
  expect(diceRegion.getByRole("button",{name:"ROLL"})).toBeEnabled();
  expect(f.session.getSnapshot().record!.head).toEqual(head);
  expect(f.runtime.queries.journey(f.session.getSnapshot().record!)!.party.every(m=>m.die?.faceIndex===null)).toBe(true);
  expect([...mounted.container.querySelectorAll<HTMLElement>(".expedition-die__cube")].map(cube => cube.style.transform)).toEqual(rotations);
  await act(() => f.session.refresh());
  expect(seq).toHaveAttribute("data-phase", "idle");
  expect([...mounted.container.querySelectorAll(".abyssa-expedition-enemy")]).toEqual(seats);
  expect(seats.every(seat => seat.hasAttribute("data-entry-seated"))).toBe(true);
});
it("restores saved die faces without dispatch or an automatic roll", async () => {
  const f = await manorClientFixture(19,4); fixtures.push(f);
  await f.session.dispatch({type:"battle-command",runRef:{kind:"expedition",id:"manor-run"},command:{type:"roll"}});
  const before = f.session.getSnapshot().record!;
  const faces = f.runtime.queries.journey(before)!.party.map(m=>m.die?.faceIndex);
  const dispatch = vi.spyOn(f.session,"dispatch"); vi.useFakeTimers();
  const mounted = render(<Mount f={f} phase="idle"/>);
  await advance(40); await advance(SCENE_SEQUENCE_MS.boardIn); settleBoard();
  expect(mounted.container.querySelectorAll(".expedition-die[data-rolling]")).toHaveLength(0);
  expect(f.runtime.queries.journey(f.session.getSnapshot().record!)!.party.map(m=>m.die?.faceIndex)).toEqual(faces);
  expect(dispatch).not.toHaveBeenCalled(); expect(f.session.getSnapshot().record!.head).toEqual(before.head);
});
it("does not expose an interactive empty battlefield on art failure; Retry only prepares assets", async () => {
  const f = await manorClientFixture(); fixtures.push(f); vi.useFakeTimers();
  vi.mocked(prepareImages).mockRejectedValue(new Error("missing sprite"));
  const head = f.session.getSnapshot().record!.head;
  const mounted = render(<Mount f={f} phase="idle"/>); await advance();
  expect(screen.getByRole("alert")).toHaveTextContent("战场画面准备失败");
  expect(screen.queryByRole("button",{name:"ROLL"})).toBeNull();
  expect(mounted.container.querySelector(".abyssa-expedition")).toHaveAttribute("inert");
  vi.mocked(prepareImages).mockResolvedValue();
  await act(() => fireEvent.click(screen.getByRole("button",{name:"重新加载画面"})));
  await advance(40); await advance(SCENE_SEQUENCE_MS.boardIn); settleBoard();
  expect(screen.queryByRole("alert")).toBeNull();
  expect(mounted.container.querySelector("[data-manor-assets]")).toHaveAttribute("data-manor-assets","ready");
  expect(f.session.getSnapshot().record!.head).toEqual(head);
});
it("resolves corridor/banquet from the room regardless of skin; event rooms gain no fake enemies", async () => {
  const f = await manorClientFixture(); fixtures.push(f);
  const v = f.runtime.queries.journey(f.session.getSnapshot().record!)!;
  for (const id of ["old-manor.service-corridor", "old-manor.banquet-hall"]) {
    const scene = manorScene({...v,room:{...v.room!,sceneId:id},battle:null},"hero-party")!;
    expect(scene.background).toBe(manorScenes[id]);
    expect(scene.assets).toContain(manorScenes[id]);
    expect(scene.assets).not.toContain(manorEnemyArt["old-manor.waiting-guest"].url);
  }
});
