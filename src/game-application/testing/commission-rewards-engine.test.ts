import {expect, it} from "vitest";
import {SHOP_AIRP_CATALOG as catalog} from "../../game-runtime/shop-wave-context";
import {createD5ExpeditionEngine, initialD5Projection} from "../../game-core/session";
import {applyGameStart} from "../../game-core/session/game-start";
import type {CommissionReward} from "../../game-core/contracts/commission-rewards";
import type {D5JourneyOperation} from "../../game-core/session/d5-journey-contracts";
import type {D5GameRecord} from "../versions/d5-contracts";
import {nextD5PlayCommand} from "./d5-playthrough";
import {earnedLoot} from "../../game-core/contracts/loot";

const engine = createD5ExpeditionEngine(catalog), routeId = "old-manor.maintenance";
const [objectiveId, objective] = Object.entries(catalog.data.airpDirector!.capabilities.objectives).find(([, o]) => o.routeId === routeId && o.layer === 3)!;
const reward: CommissionReward = {definitionId: "test:medicine", eventId: "test:commission", stepId: "patrol", objectiveId, label: "空药箱", description: "目标房间的空药箱。", layer: objective.layer, roomIndex: objective.roomIndex, roomDefinitionId: objective.roomDefinitionId, awardWhen: "room-cleared"};
// Only public engine commands: the fixture never edits HP, completed rooms or reward results.
function play(awardWhen: CommissionReward["awardWhen"] | null, ending: "early" | "return" | "wipe") {
  const campaign = initialD5Projection(catalog); applyGameStart(catalog, campaign, "airp-director", "test-start");
  const placement = reward;
  let state = engine.create(campaign, {runId: "quest-run", routeId, partyIds: catalog.data.initialParty, itemIds: ["item.food", "item.potion"], seed: 19,
    ...(awardWhen ? {commissionRewards: [{...placement, awardWhen}]} : {})});
  const events: {type: string; payload: unknown}[] = [];
  let beforeBank = false, afterBank = false, checkedRestore = false;
  for (let step = 0; state.node !== "finished" && step < 900; step++) {
    const record = {snapshot: {run: {kind: "expedition", id: state.run.id, state}}} as D5GameRecord;
    const c = nextD5PlayCommand(catalog, record, ending === "early" || ending === "wipe" && state.run.layer > 3);
    const op: D5JourneyOperation = c.type === "resume-run" ? {type: "resume"}
      : c.type === "battle-command" ? {type: "battle", command: c.command}
      : c.type === "advance-room" ? {type: "advance", roomId: c.roomId}
      : c.type === "choose-event" ? {type: "event", roomId: c.roomId, choice: c.choiceId, actorId: c.actorId}
      : c.type === "choose-exit" ? {type: "exit", roomId: c.roomId, choice: ending === "early" || ending === "return" && state.run.layer >= 3 ? "leave" : "continue"}
      : c.type === "use-item" ? {type: "item", instanceId: c.instanceId, target: c.target}
      : (() => {throw Error(c.type);})();
    const result = engine.dispatch(state, op); state = result.state; events.push(...result.events);
    if (state.run.completedRoomIds.includes(state.run.roomIds[2][0]) && !state.run.settledLayers.includes(3)) {
      beforeBank = true; expect(state.run.commissionRewards?.items.length ?? 0).toBe(awardWhen === "room-cleared" ? 1 : 0);
    }
    if (state.run.settledLayers.includes(3)) {afterBank = true; expect(state.run.commissionRewards?.items.length ?? 0).toBe(awardWhen ? 1 : 0);}
    if (!checkedRestore && state.run.commissionRewards?.items.length) {
      checkedRestore = true; expect(engine.restore(state)).toEqual(state);
      const removed = structuredClone(state); removed.run.commissionRewards!.items = [];
      expect(() => engine.restore(removed)).toThrow(/Quest item instances/);
      const duplicate = structuredClone(state); duplicate.run.commissionRewards!.items.push(duplicate.run.commissionRewards!.items[0]);
      expect(() => engine.restore(duplicate)).toThrow(/Quest item instances/);
    }
  }
  if (state.node !== "finished") throw Error("Run did not finish");
  expect(engine.restore(state)).toEqual(state);
  expect(state.run.carriedLoot).toEqual(earnedLoot(catalog.data.loot!, catalog.data.routes, state.run.id, routeId, state.run.completedRoomIds, state.run.rng.loot.seed));
  return {state, events, beforeBank, afterBank};
}
it.each(["room-cleared", "layer-banked"] as const)("executes GM reward condition %s once and returns the same physical instance", condition => {
  const {state, events, beforeBank, afterBank} = play(condition, "return");
  expect(beforeBank && afterBank).toBe(true);
  expect(events.filter(e => e.type === "commission-item-found")).toHaveLength(1);
  expect(state.result.commissionRewards!.returned).toEqual(state.run.commissionRewards!.items);
  expect(state.result.commissionRewards!.returned).toHaveLength(1);
});
it("loses an acquired and banked quest object on an actual later wipe", () => {
  const {state, events} = play("room-cleared", "wipe");
  expect(state.result.outcome).toBe("wipe");
  expect(events.filter(e => e.type === "commission-item-found")).toHaveLength(1);
  expect(state.result.commissionRewards!.items).toHaveLength(1);
  expect(state.result.commissionRewards!.returned).toEqual([]);
});
it("failure before the target earns no quest object; legacy runs keep their original structure", () => {
  expect(play("room-cleared", "early").state.result.commissionRewards!.items).toEqual([]);
  const {state, events} = play(null, "return");
  expect(state.run.commissionRewards).toBeUndefined(); expect(state.result.commissionRewards).toBeUndefined();
  expect(events.some(e => e.type === "commission-item-found")).toBe(false);
});
