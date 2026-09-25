import { type ReactNode } from "react";
import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import type { D5GameRecord } from "../../../game-application";
import { GameSessionScope } from "../../../game-client/react";
import { tideClientFixture, tideCommand, tideOperation } from "../../../game-client/testing/tide-cave";
import { guidedTideModel } from "../presentation/guided-tide-model";
import { useManorBattlePresentation, type ManorPlayerCommand } from "./useManorBattlePresentation";

const fixtures: Awaited<ReturnType<typeof tideClientFixture>>[] = [];
afterEach(() => {
  cleanup(); fixtures.splice(0).forEach(f => f.session.dispose()); vi.useRealTimers();
});

it.each([11, "current"] as const)("tutorial %s goes from fixing directly to the target, without a second actor click", async version => {
  vi.useFakeTimers({toFake: ["setTimeout", "clearTimeout"]});
  const f = await tideClientFixture(version); fixtures.push(f); await f.start();
  const operation = () => tideOperation(f.session.getSnapshot().record as D5GameRecord)!;
  for (let count = 0; count < 20; count++) {
    const next = operation();
    if (next.type === "battle" && next.command.type === "toggle-load") break;
    await f.send(tideCommand(next));
  }
  const fix = operation();
  if (fix.type !== "battle" || fix.command.type !== "toggle-load") throw Error("Expected the first tutorial fix");
  const owner = fix.command.actorId;
  const {result} = renderHook(() => useManorBattlePresentation(), {
    wrapper: ({children}: {children: ReactNode}) => <GameSessionScope session={f.session}>{children}</GameSessionScope>,
  });
  const perform = async (command: ManorPlayerCommand) => {
    let pending!: Promise<void>;
    await act(async () => { pending = result.current.perform(command); });
    await act(async () => { await vi.runAllTimersAsync(); await pending; });
  };
  expect(result.current.heldActor).toBeNull();
  const enemyHp = result.current.view.battle!.enemies.map(enemy => enemy.hp);
  await perform({type: "battle-command", runRef: {kind: "expedition", id: "tide-run"}, command: fix.command});
  expect(result.current.heldActor).toBe(owner);
  expect(result.current.view.party.find(member => member.id === owner)!.die).toMatchObject({loaded: true, spent: false});
  expect(result.current.view.battle!.enemies.map(enemy => enemy.hp)).toEqual(enemyHp);
  const attack = operation();
  if (attack.type !== "battle" || attack.command.type !== "act") throw Error("Expected target selection after fixing");
  expect(guidedTideModel(result.current.view, {heldActor: result.current.heldActor})!.targets)
    .toEqual([`battle.enemy:${attack.command.targetId}`]);

  // Manual deselection retains the actor-card recovery hint without advancing the lesson.
  const revision = f.session.getSnapshot().record!.head.revision;
  act(() => result.current.holdActor(null));
  expect(guidedTideModel(result.current.view, {heldActor: result.current.heldActor})!.targets).toEqual([`battle.member:${owner}`]);
  expect(f.session.getSnapshot().record!.head.revision).toBe(revision);
  act(() => result.current.holdActor(owner));
  await perform({type: "battle-command", runRef: {kind: "expedition", id: "tide-run"}, command: attack.command});
  expect(result.current.view.party.find(member => member.id === owner)!.die?.spent).toBe(true);
  expect(result.current.heldActor).toBeNull();
}, 20_000);
