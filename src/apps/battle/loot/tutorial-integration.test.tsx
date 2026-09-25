import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeAll, expect, it, vi } from "vitest";
import type { ReactNode } from "react";
import type { D5GameRecord } from "../../../game-application";
import { GameStorageError } from "../../../game-application";
import { playShopTutorial, shopFixture } from "../../../game-application/testing/shop-foundation-fixture";
import { g2Command, g2RunRef } from "../../../game-application/testing/tide-guided-g2-playthrough";
import { GameSession } from "../../../game-client/session";
import { GameSessionScope, useGameSession, useGameState } from "../../../game-client/react";
import { tideOperation } from "../../../game-client/testing/tide-cave";
import { SceneTransitionProvider } from "../../../shared/transition";
import { UiMotionProvider } from "../../../shared/ui/motion/UiMotionProvider";
import { ManorBattleBinding } from "../ManorBattleBinding";
import type { BattlePresentationSlots } from "../ManorBattleView";
import type { useManorBattlePresentation } from "../controller/useManorBattlePresentation";
import { expeditionLootView } from "./expedition-loot-view";

// Keep real commands, presentation queue, notifications, item details and modal.
// Only omit scene art / board drawing; this is DOM acceptance, not visual QA.
vi.mock("../../../shared/presentation/adv/SceneSequence", async original => ({...await original<object>(), SceneSequence: ({frame}: {frame: {id: string; content: ReactNode}}) => <div data-frame={frame.id}>{frame.content}</div>}));
vi.mock("../presentation/useBattleSceneAssets", () => ({useBattleSceneAssets: () => ({status: "ready", retry() {}})}));
vi.mock("../../../game-client/CampaignPanel", () => ({CampaignPanel: () => null}));
vi.mock("../../../game-client/AirpPanel", () => ({AirpPanel: () => null}));
vi.mock("../../../game-client/StoryReading", () => ({StoryReading: ({title, onNext}: {title: string; onNext: () => void}) => <main aria-label={title}><button onClick={onNext}>阅读下一句</button></main>}));
let performNext: () => Promise<void>;
vi.mock("../ManorBattleView", () => ({ManorBattleView: ({slots, presentation}: {slots: BattlePresentationSlots; presentation: ReturnType<typeof useManorBattlePresentation>}) => {
  const session = useGameSession();
  performNext = async () => {
    const command = g2Command(tideOperation(session.getSnapshot().record as D5GameRecord)!);
    if (command.type === "resume-run" || command.type === "start-expedition") throw Error("Expected an active player command");
    await presentation.perform(command);
  };
  return <main className="abyssa-expedition" aria-label="教学战斗">{slots.renderLedger?.(() => {})}{slots.terminal}{slots.feedback}</main>;
}}));

let checkpoints: Record<string, D5GameRecord>;
beforeAll(async () => { ({checkpoints} = await playShopTutorial("tutorial", 23)); }, 120_000);
const sessions: GameSession[] = [];
afterEach(() => { cleanup(); sessions.splice(0).forEach(s => s.dispose()); sessionStorage.clear(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });

async function restore(checkpoint: string) {
  const f = shopFixture(checkpoints[checkpoint]);
  const session = new GameSession(f.runtime, {saveId: f.saveId, epoch: f.read().head.epoch, expeditionId: g2RunRef.id}, sessionStorage);
  sessions.push(session); await session.refresh();
  return {f, session};
}
function mount(session: GameSession, onSettle: () => void = vi.fn()) {
  function Binding() {
    const game = useGameState();
    const record = game.record as D5GameRecord;
    // The real App leaves the battle immediately when the tutorial is claimed.
    if (!record.snapshot.run && record.snapshot.campaign.tutorial?.status === "completed") return <main>已返回洋馆</main>;
    return <ManorBattleBinding uiSkin="hero-party" onSettle={onSettle} saving={game.status !== "ready"}/>;
  }
  render(<GameSessionScope session={session}><SceneTransitionProvider><UiMotionProvider preference="reduced"><Binding/></UiMotionProvider></SceneTransitionProvider></GameSessionScope>);
}

it("shows committed Boss pickups across the return-story boundary without the old discovery gate", async () => {
  vi.stubGlobal("matchMedia", (query: string) => ({media: query, matches: query.includes("prefers-reduced-motion"), addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {}}));
  const {session} = await restore("beforeBossLoot");
  expect(session.getSnapshot().record!.contentRef.contentVersion).toBe(23);
  mount(session);
  expect(screen.getByRole("region", {name: "已入袋"})).toHaveTextContent("回馆统一领取");
  expect(screen.queryByText(/失败另折损一半/)).not.toBeInTheDocument();
  const feedbackHost = document.querySelector(".tutorial-reward-feedback");
  expect(feedbackHost).not.toHaveTextContent("旧十字币");
  await act(async () => { await performNext(); });
  expect(document.querySelector('[data-frame="tutorial:S3-5"]')).toBeInTheDocument();
  expect(screen.queryByRole("button", {name: "收好，继续"})).not.toBeInTheDocument();
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  expect(document.querySelector(".tutorial-reward-feedback")).toBe(feedbackHost);
  await waitFor(() => expect(feedbackHost).toHaveTextContent("旧十字币"));
  expect(feedbackHost).toHaveTextContent("发黑的金属钉");
  expect(feedbackHost).not.toHaveTextContent("黯秘银结界钉");
  expect(feedbackHost).toHaveTextContent("12");
  // Five notices (bounty + four kinds) drain through four visible slots.
  await waitFor(() => expect(feedbackHost).toHaveTextContent("干黑面包"), {timeout: 7000});
}, 30_000);

it("reloads into the existing return story without replaying pickups or granting items early", async () => {
  const {f, session} = await restore("bossLoot");
  const original = f.read(); mount(session);
  expect(document.querySelector('[data-frame="tutorial:S3-5"]')).toBeInTheDocument();
  expect(document.querySelectorAll(".scene-feedback__presentation")).toHaveLength(0);
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  expect(f.read()).toEqual(original);
  expect(original.snapshot.campaign.loot).toEqual([]);
  expect(original.snapshot.campaign.funds.party).toBe(0);
}, 30_000);

it("keeps all return-story steps before the shared claim modal", async () => {
  const {f, session} = await restore("bossLoot"); mount(session);
  let steps = 0;
  while (screen.queryByRole("button", {name: "阅读下一句"})) {
    if (++steps > 256) throw Error("Return story did not end");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    await act(async () => { fireEvent.click(screen.getByRole("button", {name: "阅读下一句"})); });
  }
  expect(steps).toBeGreaterThan(1);
  expect(screen.getByRole("dialog", {name: "远征完成"})).toBeInTheDocument();
  expect(f.read().snapshot.campaign.funds.party).toBe(0);
  expect(f.read().snapshot.campaign.loot).toEqual([]);
}, 30_000);

it("uses real quantities, unknown identity and remaining supplies with working item details", async () => {
  vi.stubGlobal("ResizeObserver", class { observe() {} unobserve() {} disconnect() {} });
  const {f, session} = await restore("claimable");
  const confirm = vi.fn(), original = f.read(); mount(session, confirm);
  const dialog = screen.getByRole("dialog", {name: "远征完成"});
  expect(screen.getByRole("group", {name: "带回资金 4,400 G"})).toBeInTheDocument();
  expect(dialog).toHaveTextContent(/追回货物报酬\s*800\s*G/);
  expect(dialog).not.toHaveTextContent("首次接管奖励");
  const loot = screen.getByRole("list", {name: "带回道具"});
  expect(within(loot).getAllByRole("button")).toHaveLength(4);
  expect(within(loot).getByRole("button", {name: /旧十字币，数量 12/})).toBeInTheDocument();
  const nail = within(loot).getByRole("button", {name: /发黑的金属钉，数量 1，鉴定品，品质未知/});
  expect(dialog).not.toHaveTextContent("黯秘银结界钉");
  const supplies = screen.getByRole("list", {name: "带回战备"});
  expect(within(supplies).getAllByRole("button")).toHaveLength(2);
  expect(within(supplies).getByRole("button", {name: /数量 3，战备道具/})).toBeInTheDocument();
  expect(within(supplies).getByRole("button", {name: /数量 2，战备道具/})).toBeInTheDocument();
  fireEvent.click(nail);
  const tooltip = screen.getByRole("tooltip", {hidden: true});
  expect(tooltip).toHaveTextContent("品质未知");
  expect(tooltip.parentElement).toBe(dialog);
  expect(loot.contains(tooltip)).toBe(false);
  fireEvent.keyDown(nail, {key: "Escape"});
  expect(screen.queryByRole("tooltip", {hidden: true})).not.toBeInTheDocument();
  expect(confirm).not.toHaveBeenCalled();
  expect(f.read()).toEqual(original);
  fireEvent.keyDown(dialog, {key: "Escape"});
  expect(confirm).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", {name: "领取并返回洋馆"}));
  expect(confirm).toHaveBeenCalledOnce();
}, 30_000);

it("matches the tutorial's fixed ledger and never adds carried supplies to acquired loot", () => {
  const f = shopFixture(checkpoints.claimable), view = f.runtime.queries.journey(f.read())!;
  const loot = expeditionLootView(view);
  expect(loot.ledger.banked.items.map(i => i.quantity)).toEqual([12, 1, 1, 1]);
  expect(loot.receipt!.returned.items).toEqual(loot.ledger.banked.items);
  expect(loot.receipt!.lostBanked.items).toEqual([]);
  expect(loot.receipt!.lostUnbanked.items).toEqual([]);
  expect(loot.supplies.items).toEqual([{itemId: "item.food", quantity: 3}, {itemId: "item.potion", quantity: 2}]);
});

it.each(["before", "after"] as const)("recovers a %s-commit claim failure without duplicate rewards", async when => {
  const {f, session} = await restore("claimable");
  const commit = f.store.commit.bind(f.store);
  let armed = true;
  f.store.commit = async plan => {
    if (armed) { armed = false; if (when === "after") await commit(plan); throw new GameStorageError("storage-unavailable", "test-only"); }
    return commit(plan);
  };
  const claim = async () => {
    if (session.getSnapshot().error) await session.refresh();
    const run = (session.getSnapshot().record as D5GameRecord).snapshot.run;
    if (run?.kind === "expedition" && run.state.node === "finished")
      await session.dispatch({type: "settle-expedition", runRef: g2RunRef, terminalRef: run.state.result.id});
  };
  let pending: Promise<void> | undefined;
  mount(session, () => { pending = claim(); });
  await act(async () => { fireEvent.click(screen.getByRole("button", {name: "领取并返回洋馆"})); await pending; });
  if (when === "before") {
    expect(screen.getByRole("alert")).toBeInTheDocument();
    expect(screen.getByRole("button", {name: "重试结算"})).toBeEnabled();
    await act(async () => { fireEvent.click(screen.getByRole("button", {name: "重试结算"})); await pending; });
  } else {
    // A lost acknowledgement still exposes the durable completed tutorial.
    // Re-entry/refresh recovers its pending receipt instead of awarding again.
    expect(session.getSnapshot().status).toBe("error");
    expect(screen.getByText("已返回洋馆")).toBeInTheDocument();
  }
  const campaign = f.read().snapshot.campaign;
  expect(campaign.funds.party).toBe(4400);
  expect(campaign.loot).toHaveLength(4);
  expect(campaign.settlements).toHaveLength(1);
  expect(f.read().snapshot.run).toBeNull();
  await act(async () => { await session.refresh(); });
  expect(session.getSnapshot().status).toBe("ready");
  expect(f.read().snapshot.campaign).toEqual(campaign);
}, 30_000);
