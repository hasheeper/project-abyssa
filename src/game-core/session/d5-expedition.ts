import type { ValidatedD5Catalog } from "../contracts/d5";
import * as v from "../contracts/validation";
import { departureSupplies } from "./d5-economy";
import { createRuleBattleEngine } from "../battle/demo-engine";
import { readD5Battle } from "../battle/d5-engine";
import { readD5Expedition, readD5BaseExpedition } from "./d5-run-readers";
import type { D5Projection, D5ExpeditionState } from "./d5-types";
import { fromDemoBattle, asDemoBattle, continueRuleExpedition, advanceRuleRoom, chooseRuleExit } from "./demo-expedition";
import { chooseRuleEvent, useRuleItem } from "./demo-items-events";
import type { TutorialOperation } from "./tutorial-types";
import { beginTutorial, resolveTutorial } from "./tutorial-engine";
import type { D5Departure, D5JourneyOperation } from "./d5-journey-contracts";
export type { D5Departure, D5JourneyOperation } from "./d5-journey-contracts";

/** The same room, item and combat rules, bound to strict v4 readers. */
export function createD5ExpeditionEngine(catalog: ValidatedD5Catalog) {
  const read = (raw: unknown) => readD5Expedition(catalog, raw);
  const readBase = (raw: unknown) => readD5BaseExpedition(catalog, raw);
  const battle = createRuleBattleEngine(catalog, raw => readD5Battle(catalog, raw));
  const dispatchBase = (input: D5ExpeditionState, operation: Exclude<D5JourneyOperation, TutorialOperation>) => {
    if (operation.type === "resume") return continueRuleExpedition(catalog, input, readBase, battle);
    if (operation.type === "advance") return advanceRuleRoom(catalog, input, operation.roomId, readBase, battle);
    if (operation.type === "event") return chooseRuleEvent(catalog, input, operation.roomId, operation.choice, operation.actorId, readBase);
    if (operation.type === "exit") return chooseRuleExit(catalog, input, operation.roomId, operation.choice, readBase, battle);
    if (operation.type === "item") return useRuleItem(catalog, input, operation.instanceId, operation.target, readBase);
    const state = asDemoBattle(readBase(input));
    if (!state) v.invalid("battle", "No active encounter", "command-not-available");
    const result = battle.dispatch(state, operation.command);
    return { state: fromDemoBattle(result.state), events: result.events };
  };
  return {
    restore: read,
    create(campaign: D5Projection, input: D5Departure): D5ExpeditionState {
      if (campaign.activeRunRef || campaign.activeStoryId) v.invalid("run", "Finish the active run or story", "run-active");
      if (catalog.data.tutorial && input.routeId === catalog.data.tutorial.routeId) {
        const spec = catalog.data.tutorial;
        if (campaign.tutorial?.status !== "pending" || campaign.opening?.status === "playing" || campaign.prologue?.status === "playing" || campaign.progress.appliedGrowthIds.length || campaign.progress.equipment.length || v.canonicalJson(input.partyIds) !== v.canonicalJson(spec.partyIds) || v.canonicalJson(input.itemIds) !== v.canonicalJson(spec.itemIds)) v.invalid("tutorial.departure", "Complete the morning and use the fixed level-one party and allowance");
        const state = battle.create({ runId: input.runId, routeId: spec.routeId, partyIds: spec.partyIds, seed: spec.firstBattleSeed, progress: campaign.progress });
        state.run.supplies = departureSupplies(catalog, campaign, input.runId, input.itemIds);
        return read(beginTutorial(fromDemoBattle(state), catalog, input.seed));
      }
      if (campaign.tutorial && !["completed", "exempt"].includes(campaign.tutorial.status)) v.invalid("tutorial", "Complete the opening before ordinary departure");
      const routeId = campaign.manor.takeover ? catalog.data.manor!.maintenanceRouteId : catalog.data.manor!.firstClearRouteId;
      if (input.routeId !== routeId || input.partyIds.some(id => !campaign.availableCharacterIds.includes(id))) v.invalid("departure", "Unavailable route or party");
      const state = battle.create({ runId: input.runId, routeId: input.routeId, partyIds: input.partyIds, seed: input.seed, progress: campaign.progress });
      state.run.supplies = departureSupplies(catalog, campaign, input.runId, input.itemIds);
      return read(fromDemoBattle(state));
    },
    dispatch(input: D5ExpeditionState, operation: D5JourneyOperation) {
      if (input.tutorial || input.run.routeId === catalog.data.tutorial?.routeId) {
        const state = read(input);
        const result = resolveTutorial(catalog, state, operation, dispatchBase);
        return { ...result, state: read(result.state) };
      }
      if (operation.type === "tutorial-read" || operation.type === "tutorial-retry" || operation.type === "tutorial-hints" || operation.type === "tutorial-guide" || operation.type === "tutorial-observe") v.invalid("tutorial", "No active tutorial");
      return dispatchBase(input, operation);
    },
  };
}
