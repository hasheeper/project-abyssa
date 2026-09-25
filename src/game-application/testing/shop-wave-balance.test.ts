import { setImmediate } from "node:timers/promises";
import { expect, it } from "vitest";
import { SHOP_WAVE_CATALOG } from "../../game-runtime/shop-wave-context";
import { createD5ExpeditionEngine, initialD5Projection } from "../../game-core/session";
import { applyGameStart } from "../../game-core/session/game-start";
import type { D5JourneyOperation } from "../../game-core/session/d5-journey-contracts";
import type { D5GameRecord } from "../versions/d5-contracts";
import { nextD5PlayCommand } from "./d5-playthrough";

/** Balance probe: equipment is installed directly into a disposable core state.
 * Transaction/provenance acceptance is covered separately by shop-wave.test. */
it("samples the first shop pair against identical real route seeds", async () => {
  const catalog = SHOP_WAVE_CATALOG, engine = createD5ExpeditionEngine(catalog);
  const results: {route: string; build: string; clears: number; gold: number; hp: number; turns: number}[] = [];
  for (const route of ["tide-reef.ordinary", "old-manor.first-clear"]) for (const equipped of [false, true]) {
    const row = {route, build: equipped ? "D2两件 / 2480G" : "无装备", clears: 0, gold: 0, hp: 0, turns: 0};
    for (const seed of [2, 7, 19, 31]) {
      const campaign = initialD5Projection(catalog); applyGameStart(catalog, campaign, "hub", "balance:start");
      if (equipped) campaign.progress.equipment = [
        {instanceId: "probe:blade", definitionId: "equipment.spare-blade", ownerId: "kororo"},
        {instanceId: "probe:bracer", definitionId: "equipment.iron-bracer", ownerId: "kael", targetFaceId: catalog.data.characters.kael.faces.find(f => catalog.data.actions[f.actionId].kind === "guard")!.id},
      ];
      let state = engine.create(campaign, {runId: "balance:run", routeId: route, partyIds: catalog.data.initialParty, itemIds: ["item.food", "item.potion"], seed});
      let steps = 0;
      while (state.node !== "finished" && steps++ < 1000) {
        if (steps % 16 === 0) await setImmediate();
        const command = nextD5PlayCommand(catalog, {snapshot: {run: {kind: "expedition", id: state.run.id, state}}} as D5GameRecord);
        let operation: D5JourneyOperation;
        if (command.type === "resume-run") operation = {type: "resume"};
        else if (command.type === "advance-room") operation = {type: "advance", roomId: command.roomId};
        else if (command.type === "choose-event") operation = {type: "event", roomId: command.roomId, choice: command.choiceId, actorId: command.actorId};
        else if (command.type === "choose-exit") operation = {type: "exit", roomId: command.roomId, choice: command.choice};
        else if (command.type === "use-item") operation = {type: "item", instanceId: command.instanceId, target: command.target};
        else if (command.type === "battle-command") {operation = {type: "battle", command: command.command}; if (command.command.type === "end-turn") row.turns++;}
        else throw Error(`Unexpected ${command.type}`);
        state = engine.dispatch(state, operation).state;
      }
      expect(state.node).toBe("finished");
      if (state.node !== "finished") throw Error("unfinished probe");
      row.clears += Number(state.result.outcome === "cleared"); row.gold += state.result.totalGold;
      row.hp += state.run.party.reduce((sum, p) => sum + p.hp, 0);
    }
    row.gold /= 4; row.hp /= 4; row.turns /= 4; results.push(row);
  }
  console.table(results);
  expect(results.every(row => Number.isFinite(row.gold) && row.gold > 0)).toBe(true);
}, 120_000);
