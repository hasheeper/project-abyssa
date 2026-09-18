import type { ValidatedD5Catalog } from "../../contracts/d5";
import { createD5BattleEngine } from "../../battle/d5-engine";
import { demoActionOptions } from "../../battle/rules/v2/combat";
import type { DemoActionOption } from "../../battle/rules/v2/combat";
import { asDemoBattle, layerReady, roomInstance, routeComplete } from "../demo-expedition";
import type { D5ExpeditionState } from "../d5-types";
import type { D5JourneyOperation } from "../d5-expedition";
import { demoItemTargets } from "../demo-items-events";

export type TutorialStrategy = "basic" | "tactical" | "attack-only";

/** Deterministic test driver, not a player auto-battle feature or alternative resolver. */
export function tutorialNextOperation(catalog: ValidatedD5Catalog, state: D5ExpeditionState, strategy: TutorialStrategy): D5JourneyOperation | null {
  const tutorial = state.tutorial!;
  if (["failed", "claimable"].includes(tutorial.stage)) return null;
  if (tutorial.story) {
    const {id: storyId, step} = tutorial.story, spec = catalog.data.tutorial!.stories[storyId];
    return {type: "tutorial-read", storyId, step, choice: spec.choiceStep === step ? "A" : "continue"};
  }
  if (state.node === "room-complete") {
    if (strategy !== "attack-only" && state.run.room < 3) {
      const food = state.run.supplies.find(s => s.definitionId === "item.food" && s.charges);
      const target = food && demoItemTargets(catalog, state, food.instanceId)[0];
      if (food && target) return {type: "item", instanceId: food.instanceId, target};
    }
    return layerReady(catalog.data, state) || routeComplete(catalog.data, state) ? {type: "resume"} : {type: "advance", roomId: roomInstance(state.run)};
  }
  const battle = asDemoBattle(state)!;
  if (battle.encounter.phase === "roll") return {type: "battle", command: {type: "roll"}};
  if (battle.encounter.phase !== "act" || !battle.encounter.formation.length) return {type: "resume"};
  const selected = createD5BattleEngine(catalog).select(battle);
  const options: {actorId: string; option: DemoActionOption; loaded: boolean}[] = [];
  for (const die of battle.encounter.dice) {
    const preview = {...battle, encounter: {...battle.encounter, dice: battle.encounter.dice.map(d => d === die ? {...d, loaded: true} : d)}};
    options.push(...demoActionOptions(catalog.data, preview, die.ownerId).options.map(option => ({actorId: die.ownerId, option, loaded: die.loaded})));
  }
  const action = (row: typeof options[number]): D5JourneyOperation => ({type: "battle", command: row.loaded ? {type: "act", actorId: row.actorId, choice: row.option.choice, targetId: row.option.targetId} : {type: "toggle-load", actorId: row.actorId}});
  const attack = options.filter(o => o.option.choice === "attack");
  const incoming = (id: string) => selected.enemies.filter(e => e.intent?.targetId === id).reduce((n, e) => n + e.damage, 0);
  const danger = battle.run.party.filter(m => m.hp > 0 && incoming(m.id) >= m.hp);
  const enemy = (id: string | null) => selected.enemies.find(e => e.id === id)!;
  if (strategy !== "attack-only") {
    const rescueKill = attack.filter(o => enemy(o.option.targetId).hp <= o.option.amount && danger.some(m => enemy(o.option.targetId).intent?.targetId === m.id));
    if (rescueKill.length) return action(rescueKill[0]);
    const heal = options.find(o => o.option.choice === "heal" && danger.some(m => m.id === o.option.targetId));
    if (heal) return action(heal);
    const guard = options.find(o => o.option.choice === "guard" && enemy(o.option.targetId).damage > 0 && danger.some(m => enemy(o.option.targetId).intent?.targetId === m.id));
    if (guard) return action(guard);
    const potion = state.run.supplies.find(s => s.definitionId === "item.potion" && s.charges);
    if (potion) {
      const targets = demoItemTargets(catalog, state, potion.instanceId);
      const target = targets.find(t => t.kind === "member" && danger.some(m => m.id === t.id));
      if (target) return {type: "item", instanceId: potion.instanceId, target};
    }
  }
  if (attack.length) {
    if (strategy === "basic") return action(attack[0]);
    attack.sort((a, b) => {
      const score = (row: typeof options[number]) => {
        const e = enemy(row.option.targetId);
        return (e.hp <= row.option.amount ? 30 : 0) + (e.definitionId.includes("crossbowman") ? 5 : 0) + Math.min(e.hp, row.option.amount) - e.hp * .1;
      };
      return score(b) - score(a);
    });
    return action(attack[0]);
  }
  if (strategy !== "attack-only") {
    const heal = options.find(o => o.option.choice === "heal");
    if (heal) return action(heal);
    if (strategy === "tactical") {
      const guard = options.find(o => o.option.choice === "guard" && enemy(o.option.targetId).damage > 0);
      if (guard) return action(guard);
    }
  }
  const eligible = battle.encounter.dice.some(d => !d.loaded && !d.spent && !d.sealed && battle.run.party.some(m => m.id === d.ownerId && m.hp > 0));
  if (eligible && battle.encounter.rerolls > (strategy === "basic" ? 1 : 0)) return {type: "battle", command: {type: "reroll"}};
  return {type: "battle", command: {type: "end-turn"}};
}
