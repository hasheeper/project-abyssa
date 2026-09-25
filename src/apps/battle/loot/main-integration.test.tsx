import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import type { ReactNode } from "react";
import { createBattlePreviewSession } from "../../../game-client/battle-preview";
import { GameSessionScope } from "../../../game-client/react";
import { nextD5PlayCommand } from "../../../game-application/testing/d5-playthrough";
import { PLAYER_CATALOGS } from "../../../game-runtime/player-runtime";
import { SceneTransitionProvider } from "../../../shared/transition";
import { UiMotionProvider } from "../../../shared/ui/motion/UiMotionProvider";
import { ManorBattleBinding } from "../ManorBattleBinding";
import type { BattlePresentationSlots } from "../ManorBattleView";

// Logic acceptance only: omit stage art, timers and battle rendering.
vi.mock("../../../shared/presentation/adv/SceneSequence", async original => ({...await original<object>(), SceneSequence: ({frame}: {frame: {content: ReactNode}}) => frame.content}));
vi.mock("../presentation/useBattleSceneAssets", () => ({useBattleSceneAssets: () => ({status: "ready", retry() {}})}));
vi.mock("../../../game-client/CampaignPanel", () => ({CampaignPanel: () => null}));
vi.mock("../../../game-client/AirpPanel", () => ({AirpPanel: () => null}));
vi.mock("../../../game-client/StoryReading", () => ({StoryReading: ({title, onNext}: {title: string; onNext: () => void}) => <main aria-label={title}><button onClick={onNext}>阅读下一句</button></main>}));
vi.mock("../ManorBattleView", () => ({ManorBattleView: ({slots}: {slots: BattlePresentationSlots}) => <main aria-label="普通远征">{slots.renderLedger?.(() => {})}{slots.terminal}{slots.feedback}</main>}));
vi.mock("../presentation/ExpeditionBattleSurface", () => ({ExpeditionBattleSurface: ({overlays}: {overlays: ReactNode}) => <main aria-label="已结算远征">{overlays}</main>}));

const sessions: Awaited<ReturnType<typeof createBattlePreviewSession>>[] = [];
afterEach(() => { cleanup(); sessions.splice(0).forEach(s => s.dispose()); sessionStorage.clear(); });
function mount(session: typeof sessions[number], onSettle = vi.fn()) {
  render(<GameSessionScope session={session}><SceneTransitionProvider><UiMotionProvider preference="reduced"><ManorBattleBinding onSettle={onSettle}/></UiMotionProvider></SceneTransitionProvider></GameSessionScope>);
  return onSettle;
}
async function play(outcome: "cleared" | "retreated" | "failed") {
  const session = await createBattlePreviewSession(); sessions.push(session);
  for (let step = 0; step < 600; step++) {
    const record = session.getSnapshot().record!;
    if (record.schemaVersion !== 4) throw Error("Current record required");
    const run = record.snapshot.run;
    if (!run || run.kind === "expedition" && run.state.node === "finished") return session;
    const entry = PLAYER_CATALOGS.find(c => c.version === 4 && c.catalog.ref.digest === record.contentRef.digest);
    if (entry?.version !== 4) throw Error("Missing preview catalog");
    const command = nextD5PlayCommand(entry.catalog, record, outcome === "failed");
    if (command.type === "resume-run") throw Error("Session owns continuations");
    if (command.type === "choose-exit" && outcome === "retreated") command.choice = "leave";
    await session.dispatch(command);
    if (session.getSnapshot().error) throw Error(JSON.stringify(session.getSnapshot().error));
    if (step % 20 === 0) await new Promise(resolve => setTimeout(resolve, 0));
  }
  throw Error("Run did not finish");
}

it("installs the two-pocket LOG in ordinary main battles without preview loot or tools", async () => {
  const session = await createBattlePreviewSession(); sessions.push(session); mount(session);
  expect(screen.getByRole("region", {name: "未入袋"})).toBeInTheDocument();
  expect(screen.getByRole("region", {name: "已入袋"})).toBeInTheDocument();
  expect(screen.queryByText("LOOT LAB")).not.toBeInTheDocument();
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
});

it.each(["failed", "retreated"] as const)("uses the transparent %s result before and after persisted settlement", async outcome => {
  const session = await play(outcome);
  const confirm = mount(session);
  const title = outcome === "failed" ? "远征失利" : "撤离归来";
  expect(screen.getByRole("dialog", {name: title})).toBeInTheDocument();
  expect(screen.getByRole("region", {name: "剩余战备"})).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", {name: "返回洋馆"}));
  expect(confirm).toHaveBeenCalledOnce();
  cleanup();
  const before = session.getSnapshot().record!;
  if (before.schemaVersion !== 4 || before.snapshot.run?.kind !== "expedition" || before.snapshot.run.state.node !== "finished") throw Error("Finished run required");
  await session.dispatch({type: "settle-expedition", runRef: {kind: "expedition", id: before.snapshot.run.id}, terminalRef: before.snapshot.run.state.result.id});
  const revision = session.getSnapshot().record!.head.revision;
  await session.refresh(); mount(session);
  expect(screen.getByRole("dialog", {name: title})).toBeInTheDocument();
  expect(session.getSnapshot().record!.head.revision).toBe(revision);
}, 120_000);

it("keeps the first-clear ADV before settlement, then shows the bonus and review action", async () => {
  const session = await play("cleared"); mount(session);
  expect(screen.getByRole("main", {name: "家宴落幕"})).toBeInTheDocument();
  expect(screen.queryByRole("dialog", {name: "远征完成"})).not.toBeInTheDocument();
  let steps = 0;
  while (screen.queryByRole("button", {name: "阅读下一句"})) {
    if (++steps > 256) throw Error("Ending story did not end");
    await act(async () => { fireEvent.click(screen.getByRole("button", {name: "阅读下一句"})); });
  }
  const result = screen.getByRole("dialog", {name: "远征完成"});
  expect(result).toHaveTextContent("首次接管奖励");
  expect(result).toHaveTextContent("2,000");
  expect(screen.getByRole("button", {name: "回顾落幕"})).toBeInTheDocument();
}, 120_000);
