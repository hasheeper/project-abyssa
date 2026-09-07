import type { ValidatedD5Catalog } from "../contracts/d5";
import type { D5BattleState, D5MemoryBattleState } from "../session/d5-types";
import * as v from "../contracts/validation";
import { createRuleBattleEngine } from "./demo-engine";
import { validateRuleBattleState } from "./rules/v2/validation";
import { emit } from "./rules/demo-events";
import type { DemoEvent } from "./domain/demo-state";
import { parseDemoItemTarget } from "../session/demo-items-events";

export function readD5Battle(catalog: ValidatedD5Catalog, raw: unknown): D5BattleState {
  const state = validateRuleBattleState(catalog, raw);
  if (state.run.routeId === catalog.data.combat.memory.routeId) v.invalid("run.kind", "Memory requires the historical reader");
  return state as D5BattleState;
}
export function readD5MemoryBattle(catalog: ValidatedD5Catalog, raw: unknown): D5MemoryBattleState {
  const state = validateRuleBattleState(catalog, raw);
  if (!state.encounter.memory) v.invalid("run.kind", "Expected a historical battle");
  return state as D5MemoryBattleState;
}
export function createD5BattleEngine(catalog: ValidatedD5Catalog) {
  const engine = createRuleBattleEngine(catalog, raw => readD5Battle(catalog, raw));
  return {contentRef:engine.contentRef, create:engine.create, restore:engine.restore, dispatch:engine.dispatch, select:engine.select, startEncounter:engine.startEncounter};
}
export function createD5MemoryEngine(catalog: ValidatedD5Catalog) {
  const engine = createRuleBattleEngine(catalog, raw => readD5MemoryBattle(catalog, raw));
  return {
    contentRef: catalog.ref, restore: engine.restore, dispatch: engine.dispatch, select: engine.select,
    useItem(input: D5MemoryBattleState, raw: unknown) {
      const state = engine.restore(input), r = v.record(raw, "item", ["instanceId", "target"]), target = parseDemoItemTarget(r.target);
      const supply = state.run.supplies.find(s => s.instanceId === v.id(r.instanceId, "instanceId"));
      if (state.encounter.phase !== "act" || state.encounter.memory!.defeated || state.encounter.itemsUsed >= 2 || !supply?.charges) v.invalid("item", "No legal local item use", "command-not-available");
      state.undo.push({run: structuredClone(state.run), encounter: structuredClone(state.encounter)});
      const ctx = {state, events: [] as DemoEvent[]};
      let applied: number;
      if (supply.definitionId === "item.potion" && target.kind === "member") {
        const member = state.run.party.find(m => m.id === target.id && m.hp > 0 && m.hp < m.config.maxHp);
        if (!member || target.faceId) v.invalid("target", "Potion needs a wounded living member");
        applied = Math.min(2, member.config.maxHp - member.hp); member.hp += applied;
      } else if (supply.definitionId === "item.ward" && target.kind === "intent") {
        const enemy = state.encounter.enemies.find(e => e.intent?.id === target.id && e.hp > 0 && e.disposition === "active" && e.intent.kind === "attack");
        if (!enemy?.intent || !state.run.party.some(m => m.id === enemy.intent!.targetId && m.hp > 0)) v.invalid("target", "Ward needs a live attack intent");
        applied = 2; enemy.intent.blocked += applied;
      } else v.invalid("target", "Invalid historical item target");
      supply.charges--; state.encounter.itemsUsed++;
      emit(ctx, "memory-item-used", null, {instanceId: supply.instanceId, definitionId: supply.definitionId, target, applied});
      return {state: engine.restore(state), events: ctx.events};
    },
    create(raw: unknown) {
      const r = v.record(raw, "memory.start", ["runId", "seed"]);
      return engine.create({ runId: r.runId, seed: r.seed, routeId: catalog.data.combat.memory.routeId, partyIds: catalog.data.progression.chapter.partyIds, progress: catalog.data.progression.chapter.progress });
    },
  };
}
