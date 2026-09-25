import { expect, it } from "vitest";
import { SHOP_WAVE_CATALOG_DATA } from "../../content/gameplay/demo-v23/content";
import { validateD5Catalog } from "../contracts/d5-validation";
import { equipmentTargets } from "../contracts/equipment";
import { createD5BattleEngine } from "../battle";
import { evaluateDemoHand } from "../battle/rules/v2/hand";
import { resolveDemoCovenants } from "../battle/rules/v2/covenants";

const catalog = validateD5Catalog(SHOP_WAVE_CATALOG_DATA), engine = createD5BattleEngine(catalog);
it.each(Object.keys(catalog.data.equipment))("executes %s through the actual battle action engine", definitionId => {
  const def = catalog.data.equipment[definitionId];
  const ownerId = catalog.data.initialParty.find(id => equipmentTargets(catalog.data, id, def).length)!;
  const target = equipmentTargets(catalog.data, ownerId, def)[0];
  const state = engine.create({runId: "gear-combat", routeId: "old-manor.first-clear", partyIds: catalog.data.initialParty, seed: 19,
    progress: {appliedGrowthIds: [], equipment: [{instanceId: "gear:1", definitionId, ownerId, ...(def.scope === "native-face" ? {targetFaceId: target.id} : {})}]}});
  state.encounter.phase = "act";
  for (const die of state.encounter.dice) {die.faceIndex = die.ownerId === ownerId ? target.slot - 1 : 0; die.loaded = true; die.spent = false;}
  state.run.party[0].hp = 1;
  const member = engine.select(state).party.find(m => m.id === ownerId)!;
  const option = member.actions.options.find(o => o.choice === def.replacement)!;
  expect(option).toBeDefined();
  const after = engine.dispatch(state, {type: "act", actorId: ownerId, choice: def.replacement, targetId: option.targetId});
  expect(after.state.encounter.dice.find(d => d.ownerId === ownerId)?.spent).toBe(true);
  if (target.fate === "asleep") expect(evaluateDemoHand(catalog.data, state).dice.some(d => d.ownerId === ownerId)).toBe(false);
});

it("checks Norma against any living unsealed blank, including another hero's remaining blank", () => {
  const progress = {appliedGrowthIds: [], equipment: [{instanceId: "gear:bell", definitionId: "equipment.watch-bell", ownerId: "kororo", targetFaceId: equipmentTargets(catalog.data, "kororo", catalog.data.equipment["equipment.watch-bell"])[0].id}]};
  const state = engine.create({runId: "gear-norma", routeId: "old-manor.first-clear", partyIds: catalog.data.initialParty, seed: 19, progress});
  state.encounter.phase = "act";
  const blanks = catalog.data.characters.kororo.faces.filter(f => catalog.data.actions[f.actionId].kind === "blank");
  for (const die of state.encounter.dice) {die.faceIndex = die.ownerId === "kororo" ? blanks[1].slot - 1 : 0; die.loaded = true; die.spent = false;}
  expect(evaluateDemoHand(catalog.data, state).hasBlank).toBe(true);
  state.encounter.dice.find(d => d.ownerId === "kororo")!.sealed = true;
  expect(evaluateDemoHand(catalog.data, state).hasBlank).toBe(false);
  state.encounter.dice.find(d => d.ownerId === "kororo")!.sealed = false;
  state.run.party.find(m => m.id === "kororo")!.hp = 0;
  expect(evaluateDemoHand(catalog.data, state).hasBlank).toBe(false);
  // Hand pattern and blank action are independent requirements for this covenant.
  const hand = {...evaluateDemoHand(catalog.data, state), covenantOwnerIds: ["norma"], hasBlank: true};
  state.encounter.hand = {...hand, patterns: {...hand.patterns, twoPair: true}};
  const context = {state, events: [] as import("../battle/domain/demo-state").DemoEvent[]};
  resolveDemoCovenants(catalog.data, context);
  expect(context.events.some(e => e.type === "covenant-triggered" && e.actorId === "norma")).toBe(true);
  context.events = []; state.encounter.hand.hasBlank = false;
  resolveDemoCovenants(catalog.data, context);
  expect(context.events.some(e => e.type === "covenant-triggered" && e.actorId === "norma")).toBe(false);
});
