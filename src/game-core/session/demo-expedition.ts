import { earnedCommissionItems, commissionReceipt, validateCommissionBag, type CommissionRewardReceipt } from "../contracts/commission-rewards";
import type { ValidatedDemoCatalog } from "../contracts/demo";
import * as v from "../contracts/validation";
import { earnedLoot, type LootDrop } from "../contracts/loot";
import { hasOrdinaryLoot, hasTableLoot, lootPockets, retainHalfLoot, type ExpeditionLootLedger } from "./expedition-loot";
import { sha256 } from "../contracts/sha256";
import { departureSupplyLimit } from "../contracts/journey-limits";
import { demoRoom } from "../contracts/demo-journey-validation";
import type { RuleContext, RuleRun, RuleCatalog, RuleExpeditionRun } from "../battle/domain/rule-state";
import type { createRuleBattleEngine } from "../battle/demo-engine";
import { createDemoBattleEngine } from "../battle/demo-engine";
import { validateDemoRunState } from "../battle/rules/v2/validation";
import { layerGold, validateLayerResult, validateSupplies } from "../battle/rules/v2/journey-validation";
import type { DemoBattleState, DemoRunState, DemoEvent, DemoSupply, DemoLayerResult } from "../battle/domain/demo-state";

export type DemoTerminal = { commissionRewards?: CommissionRewardReceipt; lootProof?: {seed: number; completedRoomIds: string[]}; lootLedger?: ExpeditionLootLedger; returnedLoot?: LootDrop[]; id: string; runId: string; routeId: string; outcome: "extracted" | "wipe" | "cleared"; completion?: {roomIds: string[]; encounterIds: string[]} | null; deepestLayer: number; partyIds: string[]; bankedGold: number; lostLooseGold: number; lostBankedGold: number; totalGold: number; returnedSupplies: DemoSupply[]; layerResults: DemoLayerResult[] };
export type DemoExpeditionState<R extends RuleRun = DemoRunState> = { run: R; undo: DemoBattleState<R>["undo"] } & (
  | { node: "battle"; encounter: DemoBattleState["encounter"]; result: null }
  | { node: "event" | "room-complete" | "exit"; encounter: null; result: null }
  | { node: "finished"; encounter: null; result: DemoTerminal }
);
export type DemoExpeditionResolution<R extends RuleRun = DemoRunState> = { state: DemoExpeditionState<R>; events: DemoEvent[] };
export const roomInstance = (run: RuleRun) => run.roomIds[run.layer - 1][run.room];
export const asDemoBattle = <R extends RuleRun>(state: DemoExpeditionState<R>): DemoBattleState<R> | null => state.node === "battle" ? { run: state.run, encounter: state.encounter, undo: state.undo } : null;
export const fromDemoBattle = <R extends RuleRun>(state: DemoBattleState<R>): DemoExpeditionState<R> => ({ ...state, node: "battle", result: null });
export function journeyEvent(state: DemoExpeditionState<RuleRun>, type: string, payload: DemoEvent["payload"], actorId: string | null = null): DemoEvent {
  return { id: `${state.run.id}:event:${++state.run.sequence}`, type, actorId, payload };
}
/** Called at room completion, before banking. Shared by battles and event rooms. */
export function collectRoomLoot(catalog: RuleContext, state: DemoExpeditionState<RuleRun>): DemoEvent[] {
  const questEvents = collectCommissionRewards(state);
  if (!("loot" in catalog.data) || !catalog.data.loot) return questEvents;
  const previous = new Set(state.run.carriedLoot?.map(item => item.instanceId));
  state.run.carriedLoot = earnedLoot(catalog.data.loot, catalog.data.routes, state.run.id, state.run.routeId, state.run.completedRoomIds, state.run.rng.loot.seed);
  return [...questEvents, ...state.run.carriedLoot.filter(item => !previous.has(item.instanceId)).map(item => journeyEvent(state, "loot-found", {...item}))];
}
function collectCommissionRewards(state: DemoExpeditionState<RuleRun>): DemoEvent[] {
  const run = state.run, bag = run.commissionRewards;
  if (!bag) return [];
  const previous = new Set(bag.items.map(i => i.instanceId));
  bag.items = earnedCommissionItems(bag.manifest, run.id, run.roomIds, run.completedRoomIds, run.settledLayers);
  return bag.items.filter(i => !previous.has(i.instanceId)).map(i => journeyEvent(state, "commission-item-found", {...i}));
}
export function validateTerminal(catalog: import("../battle/domain/rule-state").RuleContext, raw: unknown): DemoTerminal {
  const r = v.record(raw, "terminal", ["id", "runId", "routeId", "outcome", "deepestLayer", "partyIds", "bankedGold", "lostLooseGold", "lostBankedGold", "totalGold", "returnedSupplies", "layerResults", ...(catalog.ref.rulesVersion >= 3 ? ["completion"] : []), ...("loot" in catalog.data && catalog.data.loot ? ["returnedLoot"] : [])], ["lootLedger", "lootProof", "commissionRewards"]);
  v.id(r.id, "terminal.id"); v.id(r.runId, "terminal.runId");
  const route = v.reference(catalog.data.routes, r.routeId, "terminal.routeId");
  v.choice(r.outcome, ["extracted", "wipe", ...(catalog.ref.rulesVersion >= 3 ? ["cleared"] : [])], "terminal.outcome"); v.number(r.deepestLayer, "deepestLayer", 1, route.layers.length);
  v.ids(r.partyIds, "partyIds", 5).forEach(id => v.reference(catalog.data.characters, id, "partyIds"));
  for (const key of ["bankedGold", "lostLooseGold", "lostBankedGold", "totalGold"]) v.number(r[key], key, 0, 1e9);
  const results = v.list(r.layerResults, "layerResults", 5).map(x => validateLayerResult(catalog, x));
  if (new Set(results.map(x => x.layer)).size !== results.length || r.bankedGold !== results.reduce((n, x) => n + x.gold, 0)) v.invalid("terminal", "Bank ledger differs");
  const retained = r.outcome === "wipe" ? Math.floor((r.bankedGold as number) / 2) : r.bankedGold;
  if (r.totalGold !== retained || r.lostBankedGold !== (r.bankedGold as number) - (retained as number) || (r.outcome !== "wipe" && r.lostLooseGold !== 0)) v.invalid("terminal", "Loss accounting differs");
  if (catalog.ref.rulesVersion >= 3) {
    if (r.outcome === "cleared") {
      const proof = v.record(r.completion, "completion", ["roomIds", "encounterIds"]);
      const rooms = v.ids(proof.roomIds, "completion.rooms", 100), encounters = v.ids(proof.encounterIds, "completion.encounters", 20);
      if (r.deepestLayer !== route.layers.length || results.length !== route.layers.length || rooms.length !== route.layers.flat().length || encounters.length !== route.layers.flat().filter(id => catalog.data.journey!.rooms[id].kind === "battle").length) v.invalid("completion", "Incomplete route proof");
      rooms.forEach(id => {if (!id.startsWith(`${r.runId}:room:`)) v.invalid("completion", "Foreign room");});
      encounters.forEach(id => {if (!id.startsWith(`${r.runId}:encounter:`)) v.invalid("completion", "Foreign encounter");});
      results.forEach((result, i) => {if (result.layer !== i + 1 || !rooms.includes(result.roomId)) v.invalid("completion", "Unproved layer");});
    } else if (r.completion !== null) v.invalid("completion", "Premature completion");
    if (r.outcome === "extracted" && (catalog.ref.rulesVersion === 4 && catalog.ref.contentVersion >= 20
      ? !route.layers[(r.deepestLayer as number) - 1].some(id => catalog.data.journey!.rooms[id].kind === "exit")
      : r.deepestLayer !== 3)) v.invalid("terminal", "No exit on this layer");
  }
  if ("loot" in catalog.data && catalog.data.loot) {
    const completion = r.completion as {roomIds: string[]} | null;
    const rows = route.layers.map((row, l) => row.map((_, i) => `${r.runId}:room:${l + 1}:${i + 1}`));
    let proof: DemoTerminal["lootProof"];
    if (hasTableLoot(catalog, r.routeId as string)) {
      const p = v.record(r.lootProof, "lootProof", ["seed", "completedRoomIds"]);
      proof = {seed: v.number(p.seed, "lootProof.seed", 0, 0xffffffff), completedRoomIds: v.ids(p.completedRoomIds, "lootProof.completedRoomIds", 100)};
      const available = rows.slice(0, r.deepestLayer as number).flat();
      if (v.canonicalJson(proof.completedRoomIds) !== v.canonicalJson(available.slice(0, proof.completedRoomIds.length)) ||
        results.some(result => rows[result.layer - 1].some((id, i) => catalog.data.journey!.rooms[route.layers[result.layer - 1][i]].kind !== "exit" && !proof!.completedRoomIds.includes(id))) ||
        r.outcome === "cleared" && v.canonicalJson(proof.completedRoomIds) !== v.canonicalJson(completion!.roomIds))
        v.invalid("lootProof", "Room proof differs from route and completed layers");
    } else if (r.lootProof !== undefined) v.invalid("lootProof", "Fixed rewards do not use random loot proofs");
    let expected = earnedLoot(catalog.data.loot, catalog.data.routes, r.runId as string, r.routeId as string, proof?.completedRoomIds ?? (r.outcome === "cleared" ? completion!.roomIds : []), proof?.seed);
    if (hasOrdinaryLoot(catalog, r.routeId as string)) {
      const ledger = v.record(r.lootLedger, "lootLedger", ["banked", "unbanked"]);
      const rooms = rows;
      const eligible = earnedLoot(catalog.data.loot, catalog.data.routes, r.runId as string, r.routeId as string, proof?.completedRoomIds ?? rooms.slice(0, r.deepestLayer as number).flat(), proof?.seed);
      const pockets = lootPockets(eligible, rooms, results.map(result => result.layer));
      if (v.canonicalJson(ledger.banked) !== v.canonicalJson(pockets.banked)) v.invalid("lootLedger", "Banked loot differs from completed layers");
      const unbanked = v.list(ledger.unbanked, "lootLedger.unbanked", 32);
      if (proof && v.canonicalJson(unbanked) !== v.canonicalJson(pockets.unbanked)) v.invalid("lootLedger", "Unbanked loot differs from room proof");
      if (new Set(unbanked.map(item => v.canonicalJson(item))).size !== unbanked.length || unbanked.some(item => !pockets.unbanked.some(drop => v.canonicalJson(drop) === v.canonicalJson(item))) || r.outcome === "cleared" && unbanked.length) v.invalid("lootLedger", "Unproved unbanked loot");
      expected = r.outcome === "wipe" ? retainHalfLoot(pockets.banked) : pockets.banked;
    } else if (r.lootLedger !== undefined) v.invalid("lootLedger", "Ordinary loot ledger is not enabled for this route");
    if (v.canonicalJson(r.returnedLoot) !== v.canonicalJson(expected)) v.invalid("returnedLoot", "Loot differs from proven room rewards and retention");
  } else if (r.lootLedger !== undefined || r.lootProof !== undefined) v.invalid("lootLedger", "No loot catalog");
  if (r.commissionRewards !== undefined) {
    const q = v.record(r.commissionRewards, "commissionReceipt", ["version", "manifest", "items", "completedRoomIds", "returned"]);
    const completed = v.ids(q.completedRoomIds, "commissionReceipt.completedRoomIds", 100);
    const rows = route.layers.map((rooms, l) => rooms.map((_, i) => `${r.runId}:room:${l + 1}:${i + 1}`));
    const available = rows.slice(0, r.deepestLayer as number).flat();
    if (v.canonicalJson(completed) !== v.canonicalJson(available.slice(0, completed.length)) ||
      results.some(result => rows[result.layer - 1].some((id, i) => catalog.data.journey!.rooms[route.layers[result.layer - 1][i]].kind !== "exit" && !completed.includes(id))) ||
      r.lootProof !== undefined && v.canonicalJson(completed) !== v.canonicalJson((r.lootProof as {completedRoomIds: string[]}).completedRoomIds))
      v.invalid("commissionReceipt", "Quest room evidence differs from executed route");
    const bag = {version: q.version, manifest: q.manifest, items: q.items};
    validateCommissionBag(catalog, r.routeId as string, r.runId as string, rows, completed, results.map(x => x.layer), bag);
    const expected = commissionReceipt(bag as CommissionRewardReceipt, completed, results.map(x => x.layer), r.outcome as string);
    if (v.canonicalJson(q) !== v.canonicalJson(expected)) v.invalid("commissionReceipt", "Quest return differs from ownership and outcome");
  }
  validateSupplies(catalog, r.returnedSupplies, departureSupplyLimit(catalog.ref));
  return raw as DemoTerminal;
}
export function validateDemoExpedition(catalog: ValidatedDemoCatalog, raw: unknown): DemoExpeditionState {
  const s = v.record(raw, "expedition", ["run", "node", "encounter", "undo", "result"]);
  const run = validateDemoRunState(catalog, s.run);
  const node = v.choice(s.node, ["battle", "event", "room-complete", "exit", "finished"], "node");
  const def = demoRoom(catalog.data, run.routeId, run.layer, run.room);
  if (node === "battle") {
    if (def.kind !== "battle" || s.result !== null) v.invalid("node", "Invalid battle room");
    createDemoBattleEngine(catalog).restore({run, encounter: s.encounter, undo: s.undo});
  } else {
    if (s.encounter !== null || v.list(s.undo, "undo").length) v.invalid("node", "Non-battle retains encounter");
    if (node === "finished") {
      const result = validateTerminal(catalog, s.result);
      if (result.lootLedger && v.canonicalJson(result.lootLedger) !== v.canonicalJson(lootPockets(run.carriedLoot ?? [], run.roomIds, run.settledLayers))) v.invalid("lootLedger", "Loot receipt differs from run");
      if (result.runId !== run.id || result.routeId !== run.routeId || result.deepestLayer !== run.layer || result.bankedGold !== run.bankedGold || v.canonicalJson(result.partyIds) !== v.canonicalJson(run.party.map(m => m.id)) || v.canonicalJson(result.layerResults) !== v.canonicalJson(run.layerResults) || v.canonicalJson(result.returnedSupplies) !== v.canonicalJson(run.supplies)) v.invalid("terminal", "Terminal differs from run");
      if (result.outcome === "wipe" ? run.party.some(m => m.hp > 0) : result.outcome === "cleared" ? !routeComplete(catalog.data, stateFromRun(run)) || v.canonicalJson(result.completion) !== v.canonicalJson({roomIds: run.completedRoomIds, encounterIds: run.completedEncounterIds}) : def.kind !== "exit" || !run.settledLayers.includes(run.layer)) v.invalid("terminal", "Terminal has no legal cause");
    } else if (s.result !== null) v.invalid("result", "Premature terminal result");
    if (node === "event" && (def.kind !== "event" || run.completedRoomIds.includes(roomInstance(run)))) v.invalid("node", "Invalid event window");
    if (node === "exit" && (def.kind !== "exit" || !run.settledLayers.includes(run.layer))) v.invalid("node", "Exit is not unlocked");
    if (node === "room-complete" && !run.completedRoomIds.includes(roomInstance(run))) v.invalid("node", "Room is not completed");
  }
  const rows = run.roomIds;
  for (let l = 0; l < run.layer; l++) for (let r = 0; r < rows[l].length; r++) {
    if (l === run.layer - 1 && r >= run.room) break;
    if (!run.completedRoomIds.includes(rows[l][r])) v.invalid("room", "Earlier room was skipped");
  }
  for (const paid of run.layerResults) {
    const ids = rows[paid.layer - 1].filter((_, index) => demoRoom(catalog.data, run.routeId, paid.layer, index).kind !== "exit");
    if (!ids.every(id => run.completedRoomIds.includes(id))) v.invalid("layer", "Paid before all rooms completed");
  }
  return structuredClone(raw) as DemoExpeditionState;
}
export function layerReady(catalog: RuleCatalog, state: DemoExpeditionState<RuleRun>) {
  const run = state.run;
  return !!catalog.journey && !run.settledLayers.includes(run.layer) && run.roomIds[run.layer - 1].every((id, index) => demoRoom(catalog, run.routeId, run.layer, index).kind === "exit" || run.completedRoomIds.includes(id));
}
export function finishDemoRun<R extends RuleExpeditionRun>(catalog: RuleContext, state: DemoExpeditionState<R>, outcome: "extracted" | "wipe" | "cleared"): DemoExpeditionResolution<R> {
  const run = state.run, totalGold = outcome === "wipe" ? Math.floor(run.bankedGold / 2) : run.bankedGold;
  const lootLedger = hasOrdinaryLoot(catalog, run.routeId) ? lootPockets(run.carriedLoot ?? [], run.roomIds, run.settledLayers) : undefined;
  const returnedLoot = lootLedger ? outcome === "wipe" ? retainHalfLoot(lootLedger.banked) : lootLedger.banked : outcome === "cleared" ? run.carriedLoot ?? [] : [];
  const result: DemoTerminal = { ...(lootLedger ? {lootLedger: structuredClone(lootLedger)} : {}), ...(run.carriedLoot ? {returnedLoot: structuredClone(returnedLoot)} : {}), id: `terminal:${sha256(run.id).slice(0, 32)}`, runId: run.id, routeId: run.routeId, outcome, deepestLayer: run.layer, partyIds: run.party.map(m => m.id), bankedGold: run.bankedGold, lostLooseGold: outcome === "wipe" ? run.looseGold : 0, lostBankedGold: run.bankedGold - totalGold, totalGold, returnedSupplies: structuredClone(run.supplies), layerResults: structuredClone(run.layerResults), ...(run.contentRef.rulesVersion >= 3 ? {completion: outcome === "cleared" ? {roomIds: [...run.completedRoomIds], encounterIds: [...run.completedEncounterIds]} : null} : {}) };
  if (run.commissionRewards) result.commissionRewards = commissionReceipt(run.commissionRewards, run.completedRoomIds, run.settledLayers, outcome);
  if (hasTableLoot(catalog, run.routeId)) result.lootProof = {seed: run.rng.loot.seed, completedRoomIds: [...run.completedRoomIds]};
  run.looseGold = 0; run.handBonus = 0;
  const next: DemoExpeditionState<R> = {run, node: "finished", encounter: null, undo: [], result};
  return { state: next, events: [journeyEvent(next, "expedition-finished", {...result})] };
}
const stateFromRun = <R extends RuleRun>(run: R): DemoExpeditionState<R> => ({run, node: "room-complete", encounter: null, undo: [], result: null});
export function routeComplete(catalog: RuleCatalog, state: DemoExpeditionState<RuleRun>) {
  const run = state.run;
  return catalog.rulesVersion >= 3 && state.node === "room-complete" && run.layer === catalog.routes[run.routeId].layers.length && run.settledLayers.includes(run.layer) && run.roomIds.flat().every(id => run.completedRoomIds.includes(id)) && run.party.some(m => m.hp > 0);
}
/** One mandatory continuation. Choices and movement never happen here. */
export function continueRuleExpedition<R extends RuleExpeditionRun>(catalog: RuleContext, input: DemoExpeditionState<R>, read: (raw: unknown) => DemoExpeditionState<R>, engine: ReturnType<typeof createRuleBattleEngine<DemoBattleState<R>>>): DemoExpeditionResolution<R> {
  const state = read(input);
  if (state.node === "battle") {
    const b = asDemoBattle(state)!;
    if (b.encounter.phase === "complete") {
      if (b.encounter.outcome === "wipe") return finishDemoRun(catalog, state, "wipe");
      state.run.completedRoomIds.push(roomInstance(state.run));
      const next: DemoExpeditionState<R> = {run: state.run, node: "room-complete", encounter: null, undo: [], result: null};
      const events = [journeyEvent(next, "room-completed", {roomId: roomInstance(next.run), layer: next.run.layer})];
      events.push(...collectRoomLoot(catalog, next));
      return {state: next, events};
    }
    const command = b.encounter.phase === "enemy" ? b.encounter.cursor < b.encounter.enemyOrder.length ? "resolve-next-enemy" : "next-round" : b.encounter.phase === "act" && !b.encounter.formation.length ? "end-turn" : null;
    if (command) { const r = engine.dispatch(b, {type: command}); return {state: fromDemoBattle(r.state), events: r.events}; }
  }
  if (layerReady(catalog.data, state)) {
    const run = state.run, j = catalog.data.journey!;
    const bonus = Math.min(j.handBonusCapPercent, Math.round(run.handBonus * 100)), depth = j.depthPercent[run.layer - 1], earth = run.party.filter(m => m.config.suits.includes("earth")).length >= 4 ? 110 : 100;
    const result: DemoLayerResult = {layer: run.layer, roomId: roomInstance(run), looseGold: run.looseGold, handBonusPercent: bonus, depthPercent: depth, earthPercent: earth, gold: layerGold(run.looseGold, bonus, depth, earth)};
    run.layerResults.push(result); run.settledLayers.push(run.layer); run.bankedGold += result.gold; run.looseGold = 0; run.handBonus = 0;
    return {state, events: [journeyEvent(state, "layer-banked", {...result}), ...collectCommissionRewards(state)]};
  }
  if (routeComplete(catalog.data, state)) return finishDemoRun(catalog, state, "cleared");
  return v.invalid("continuation", "Waiting for player input", "command-not-available");
}
export function advanceRuleRoom<R extends RuleExpeditionRun>(catalog: RuleContext, input: DemoExpeditionState<R>, id: string, read: (raw: unknown) => DemoExpeditionState<R>, engine: ReturnType<typeof createRuleBattleEngine<DemoBattleState<R>>>): DemoExpeditionResolution<R> {
  const state = read(input), run = state.run;
  if (state.node !== "room-complete" || id !== roomInstance(run) || layerReady(catalog.data, state)) v.invalid("room", "Room cannot advance", "command-not-available");
  if (++run.room === catalog.data.routes[run.routeId].layers[run.layer - 1].length) {
    run.layer++; run.room = 0;
    for (const m of run.party) if (m.rainyReturn) { m.hp = Math.max(m.hp, Math.min(2, m.config.maxHp)); m.rainyReturn = false; }
  }
  if (run.layer > catalog.data.routes[run.routeId].layers.length) v.invalid("route", "No published next room");
  const def = demoRoom(catalog.data, run.routeId, run.layer, run.room);
  if (def.kind === "battle") {
    run.encounterSequence++;
    const next = engine.startEncounter(run);
    return {state: fromDemoBattle(next.state), events: next.events};
  }
  const next: DemoExpeditionState<R> = {run, node: def.kind, encounter: null, undo: [], result: null};
  return {state: next, events: []};
}
export function chooseRuleExit<R extends RuleExpeditionRun>(catalog: RuleContext, input: DemoExpeditionState<R>, id: string, choice: "leave" | "continue", read: (raw: unknown) => DemoExpeditionState<R>, engine: ReturnType<typeof createRuleBattleEngine<DemoBattleState<R>>>): DemoExpeditionResolution<R> {
  const state = read(input), run = state.run, room = demoRoom(catalog.data, run.routeId, run.layer, run.room);
  if (state.node !== "exit" || room.kind !== "exit" || id !== roomInstance(run)) v.invalid("exit", "No legal exit", "command-not-available");
  if (choice === "leave") return finishDemoRun(catalog, state, "extracted");
  if (!room.canContinue) v.invalid("exit", "Next section is not released", "content-unavailable");
  run.completedRoomIds.push(id);
  const found = collectRoomLoot(catalog, state);
  const next = advanceRuleRoom(catalog, {...state, node: "room-complete"}, id, read, engine);
  return {...next, events: [...found, ...next.events]};
}

// Legacy entry points keep their strict v2/v3 readers.
export function continueDemoExpedition(catalog: ValidatedDemoCatalog, input: DemoExpeditionState) {
  return continueRuleExpedition(catalog, input, raw => validateDemoExpedition(catalog, raw), createDemoBattleEngine(catalog));
}
export function advanceDemoRoom(catalog: ValidatedDemoCatalog, input: DemoExpeditionState, id: string) {
  return advanceRuleRoom(catalog, input, id, raw => validateDemoExpedition(catalog, raw), createDemoBattleEngine(catalog));
}
export function chooseDemoExit(catalog: ValidatedDemoCatalog, input: DemoExpeditionState, id: string, choice: "leave" | "continue") {
  return chooseRuleExit(catalog, input, id, choice, raw => validateDemoExpedition(catalog, raw), createDemoBattleEngine(catalog));
}
