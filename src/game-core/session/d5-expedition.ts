import type { ValidatedD5Catalog } from "../contracts/d5";
import * as v from "../contracts/validation";
import { departureSupplies } from "./d5-economy";
import { createRuleBattleEngine } from "../battle/demo-engine";
import { readD5Battle } from "../battle/d5-engine";
import { readD5Expedition } from "./d5-run-readers";
import type { D5Projection, D5ExpeditionState } from "./d5-types";
import { fromDemoBattle, asDemoBattle, continueRuleExpedition, advanceRuleRoom, chooseRuleExit } from "./demo-expedition";
import { chooseRuleEvent, useRuleItem, type DemoItemTarget } from "./demo-items-events";
import type { DemoBattleCommand } from "../battle/domain/demo-state";

export type D5Departure = { runId: string; routeId: string; partyIds: string[]; itemIds: string[]; seed: number };
export type D5JourneyOperation =
  | { type: "resume" }
  | { type: "battle"; command: DemoBattleCommand }
  | { type: "advance"; roomId: string }
  | { type: "event"; roomId: string; choice: "read" | "attempt" | "skip"; actorId: string | null }
  | { type: "exit"; roomId: string; choice: "leave" | "continue" }
  | { type: "item"; instanceId: string; target: DemoItemTarget };

/** The same room, item and combat rules, bound to strict v4 readers. */
export function createD5ExpeditionEngine(catalog: ValidatedD5Catalog) {
  const read = (raw: unknown) => readD5Expedition(catalog, raw);
  const battle = createRuleBattleEngine(catalog, raw => readD5Battle(catalog, raw));
  return {
    restore: read,
    create(campaign: D5Projection, input: D5Departure): D5ExpeditionState {
      if (campaign.activeRunRef || campaign.activeStoryId) v.invalid("run", "Finish the active run or story", "run-active");
      const routeId = campaign.manor.takeover ? catalog.data.manor!.maintenanceRouteId : catalog.data.manor!.firstClearRouteId;
      if (input.routeId !== routeId || input.partyIds.some(id => !campaign.availableCharacterIds.includes(id))) v.invalid("departure", "Unavailable route or party");
      const state = battle.create({ runId: input.runId, routeId: input.routeId, partyIds: input.partyIds, seed: input.seed, progress: campaign.progress });
      state.run.supplies = departureSupplies(catalog, campaign, input.runId, input.itemIds);
      return read(fromDemoBattle(state));
    },
    dispatch(input: D5ExpeditionState, operation: D5JourneyOperation) {
      if (operation.type === "resume") return continueRuleExpedition(catalog, input, read, battle);
      if (operation.type === "advance") return advanceRuleRoom(catalog, input, operation.roomId, read, battle);
      if (operation.type === "event") return chooseRuleEvent(catalog, input, operation.roomId, operation.choice, operation.actorId, read);
      if (operation.type === "exit") return chooseRuleExit(catalog, input, operation.roomId, operation.choice, read, battle);
      if (operation.type === "item") return useRuleItem(catalog, input, operation.instanceId, operation.target, read);
      const state = asDemoBattle(read(input));
      if (!state) v.invalid("battle", "No active encounter", "command-not-available");
      const result = battle.dispatch(state, operation.command);
      return { state: fromDemoBattle(result.state), events: result.events };
    },
  };
}
