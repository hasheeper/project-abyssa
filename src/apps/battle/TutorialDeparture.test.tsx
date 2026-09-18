import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, expect, it } from "vitest";
import { tutorialEntryFixture } from "../../game-client/testing/new-game";
import { tideClientFixture } from "../../game-client/testing/tide-cave";
import { GameSessionScope, useGameSession, useGameState } from "../../game-client/react";
import { GameStorageError } from "../../game-application";
import type { GameSession } from "../../game-client/session";
import { TutorialDeparture } from "./TutorialDeparture";

const sessions: GameSession[] = [];
afterEach(() => { cleanup(); sessions.splice(0).forEach(s => s.dispose()); });
function Entry() {
  const session = useGameSession(), game = useGameState();
  return session.runtime.queries.tutorial(game.record!)?.canBegin ? <TutorialDeparture/> : <p>教程远征已开始</p>;
}
async function mount(session: GameSession) { await act(async () => {render(<GameSessionScope session={session}><Entry/></GameSessionScope>);}); }

it("starts the opening scene automatically without putting the handbook before it", async () => {
  const f = await tutorialEntryFixture(); sessions.push(f.session);
  const before = f.session.getSnapshot().record!;
  await mount(f.session);
  await waitFor(() => expect(screen.getByText("教程远征已开始")).toBeVisible());
  expect(screen.queryByRole("heading", {name: "战斗与探索规则总览"})).toBeNull();
  const record = f.session.getSnapshot().record!;
  expect(record.head.revision).toBe(before.head.revision + 1);
  if (record.schemaVersion !== 4 || record.snapshot.run?.kind !== "expedition") throw Error("run");
  expect(record.snapshot.run.state.tutorial).toMatchObject({stage: "story", story: {id: "S3-1", step: 0}, guide: {mode: "guided", cursor: 0}});
});

it("refreshing an active opening does not create another departure", async () => {
  const f = await tutorialEntryFixture(); sessions.push(f.session);
  await mount(f.session);
  await waitFor(() => expect(screen.getByText("教程远征已开始")).toBeVisible());
  const record = f.session.getSnapshot().record!;
  cleanup(); await act(() => f.session.refresh()); await mount(f.session);
  expect(screen.getByText("教程远征已开始")).toBeVisible();
  expect(f.session.getSnapshot().record).toEqual(record);
});

it("retries a failed departure with the saved request, without inventing another run", async () => {
  const f = await tutorialEntryFixture(); sessions.push(f.session);
  const commit = f.store.commit.bind(f.store), before = f.session.getSnapshot().record;
  f.store.commit = async () => {throw new GameStorageError("storage-quota", "full");};
  const user = userEvent.setup(); await mount(f.session);
  await waitFor(() => expect(screen.getByRole("button", {name: "重试出发"})).toBeVisible());
  expect(f.session.getSnapshot().record).toEqual(before);
  f.store.commit = commit;
  await user.click(screen.getByRole("button", {name: "重试出发"}));
  await waitFor(() => expect(screen.getByText("教程远征已开始")).toBeVisible());
  expect(f.session.getSnapshot().record!.head.revision).toBe(before!.head.revision + 1);
});

it("does not change the older four-room tutorial departure", async () => {
  const f = await tideClientFixture(9); sessions.push(f.session);
  await mount(f.session);
  await waitFor(() => expect(screen.getByText("教程远征已开始")).toBeVisible());
  expect(screen.queryByRole("heading", {name: "战斗与探索规则总览"})).toBeNull();
});
