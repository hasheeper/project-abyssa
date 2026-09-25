import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import type { ReactNode } from "react";
import { reefFixture, playReef } from "../../../game-application/testing/tide-reef-fixture";
import { GameSession } from "../../../game-client/session";
import { GameSessionScope } from "../../../game-client/react";
import { SceneTransitionProvider } from "../../../shared/transition";
import { UiMotionProvider } from "../../../shared/ui/motion/UiMotionProvider";
import { ManorBattleBinding } from "../ManorBattleBinding";
import type { BattlePresentationSlots } from "../ManorBattleView";
import type { DemoJourneyView } from "../../../game-runtime/demo-journey-view";
import { manorScene, settlementScene } from "../presentation/manor-scene";
import { expeditionEnemyArt, expeditionScenes } from "../../../content/presentation/expedition-art";
import { ENEMY_ART_BOUNDS, layoutEnemyStage } from "../presentation/enemy-stage-model";
import { manorBattleModel } from "../presentation/manor-battle-model";
import { manorJourneyStory } from "../presentation/manor-journey-story";
import { manorJourneyTitle } from "../presentation/ManorJourneyPanel";
import { expeditionRewardFeedback } from "./useExpeditionLootFeedback";
import { expeditionLootView } from "./expedition-loot-view";
import { d5VisibleEvents } from "../../../game-runtime/d5-views";

// DOM/data acceptance only. No browser, canvas, art decoding or recording.
vi.mock("../../../shared/presentation/adv/SceneSequence", async original => ({...await original<object>(), SceneSequence: ({frame}: {frame: {content: ReactNode}}) => frame.content}));
vi.mock("../presentation/useBattleSceneAssets", () => ({useBattleSceneAssets: () => ({status: "ready", retry() {}})}));
vi.mock("../../../game-client/CampaignPanel", () => ({CampaignPanel: () => null}));
vi.mock("../../../game-client/AirpPanel", () => ({AirpPanel: () => null}));
vi.mock("../../../game-client/StoryReading", () => ({StoryReading: ({title}: {title: string}) => <main aria-label={title}/> }));
vi.mock("../ManorBattleView", () => ({ManorBattleView: ({slots}: {slots: BattlePresentationSlots}) => <main>{slots.renderLedger?.(() => {})}{slots.terminal}{slots.feedback}</main>}));
vi.mock("../presentation/ExpeditionBattleSurface", () => ({ExpeditionBattleSurface: ({overlays}: {overlays: ReactNode}) => <main>{overlays}</main>}));

const sessions: GameSession[] = [];
afterEach(() => { cleanup(); sessions.splice(0).forEach(s => s.dispose()); sessionStorage.clear(); });
function mount(session: GameSession) {
  const onSettle = vi.fn();
  render(<GameSessionScope session={session}><SceneTransitionProvider><UiMotionProvider preference="reduced"><ManorBattleBinding uiSkin="timber" onSettle={onSettle}/></UiMotionProvider></SceneTransitionProvider></GameSessionScope>);
  return onSettle;
}

it("connects every actual reef room, two-pocket LOG, pickup notices and restored main result", async () => {
  const f = await reefFixture();
  const rooms = new Map<string, DemoJourneyView>();
  let firstLoot: DemoJourneyView | undefined;
  const {record, terminal} = await playReef(f, "clear", record => {
    const v = f.runtime.queries.journey(record)!;
    if (!rooms.has(v.room!.id)) rooms.set(v.room!.id, v);
    if (!firstLoot && v.lootBags?.unbanked.length) firstLoot = v;
  });
  expect(rooms.size).toBe(6);
  for (const v of rooms.values()) {
    const scene = manorScene(v)!;
    expect(scene.id).toBe(v.room!.sceneId);
    expect(scene.assets).toContain(expeditionScenes[scene.id].background);
    expect(scene.assets.some(url => /old-manor|greybox/.test(url))).toBe(false);
    expect(manorJourneyStory(v)).toBeNull();
    const models = manorBattleModel(v, null).enemies;
    expect(models.every(e => !e.boss)).toBe(true);
    for (const slot of layoutEnemyStage(models, 680, 420)) {
      expect([slot.artLeft, slot.artTop, slot.visibleWidth, slot.visibleHeight].every(Number.isFinite)).toBe(true);
      expect(slot.visibleHeight).toBeGreaterThan(0);
      expect(slot.frameLeft).toBeGreaterThanOrEqual(0);
      expect(slot.frameRight).toBeLessThanOrEqual(680);
    }
    for (const enemy of v.battle?.enemies ?? []) {
      const art = expeditionEnemyArt(enemy.definition)!;
      expect(scene.assets).toContain(art.url);
      expect(art.height).toBeGreaterThan(0);
      const box = ENEMY_ART_BOUNDS[enemy.definition.artId!]!;
      expect(box.bounds[2]).toBeGreaterThan(box.bounds[0]);
      expect(box.bounds[3]).toBeGreaterThan(box.bounds[1]);
      expect(box.bounds[2]).toBeLessThanOrEqual(box.original[0]);
      expect(box.bounds[3]).toBeLessThanOrEqual(box.original[1]);
    }
  }
  expect(manorJourneyTitle(rooms.get("room.tide-reef.exit-2")!)).toBe("整备返程");
  expect(expeditionLootView(firstLoot!).ledger).toMatchObject({banked: {items: []}, unbanked: {items: [{itemId: "loot.salvage.shell", quantity: 1}]}});
  const view = f.runtime.queries.journey(record)!;
  const found = d5VisibleEvents(record, {kind: "expedition", id: f.runId}).filter(fact => fact.kind === "loot-found");
  expect(found).toHaveLength(5);
  const notices = found.map(fact => expeditionRewardFeedback({id: fact.id, type: fact.kind, actorId: null, payload: fact.payload}, view));
  expect(notices.map(n => n?.kind === "reward" ? n.reward.quantity : 0)).toEqual([1, 1, 1, 1, 1]);
  expect(notices.at(-1)).toMatchObject({kind: "reward", reward: {name: "结着盐壳的铜环", rarity: "unknown"}});

  const session = new GameSession(f.runtime, {saveId: f.saveId, epoch: record.head.epoch, expeditionId: f.runId}, sessionStorage);
  sessions.push(session); await session.refresh();
  const confirm = mount(session);
  expect(screen.getByRole("dialog", {name: "远征完成"})).toHaveTextContent("潮声溶洞");
  expect(screen.queryByText("首次接管奖励")).not.toBeInTheDocument();
  expect(screen.queryByRole("main", {name: "家宴落幕"})).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", {name: "返回洋馆"}));
  expect(confirm).toHaveBeenCalledOnce();
  cleanup();
  await session.dispatch({type: "settle-expedition", runRef: {kind: "expedition", id: f.runId}, terminalRef: terminal.id});
  expect(session.getSnapshot().error).toBeNull();
  await session.refresh(); mount(session);
  const settled = f.runtime.queries.journey(session.getSnapshot().record!)!;
  expect(settlementScene(settled, terminal)!.id).toBe("scene.tide-reef.boardwalk");
  expect(document.querySelector("[data-manor-scene]")).toHaveAttribute("data-manor-scene", "scene.tide-reef.boardwalk");
  expect(document.querySelector("[data-manor-scene]")?.getAttribute("style")).toContain(expeditionScenes["scene.tide-reef.boardwalk"].background);
  expect(screen.getByRole("dialog", {name: "远征完成"})).toHaveTextContent("潮声溶洞");
}, 120_000);
