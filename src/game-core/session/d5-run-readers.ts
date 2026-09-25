import { commissionReceipt } from "../contracts/commission-rewards";
import type { ValidatedD5Catalog } from "../contracts/d5";
import * as v from "../contracts/validation";
import type { D5BaseExpeditionState, D5ExpeditionState, D5RunReaders } from "./d5-types";
import { validateTutorialRun } from "./tutorial-validation";
import { readD5Battle, readD5MemoryBattle } from "../battle/d5-engine";
import { validateRuleRunState } from "../battle/rules/v2/validation";
import { validateTerminal } from "./demo-expedition";
import { lootPockets } from "./expedition-loot";
import { demoRoom } from "../contracts/demo-journey-validation";
import { isOrdinaryExpedition } from "./ordinary-expeditions";

export function readD5Expedition(catalog: ValidatedD5Catalog, raw: unknown): D5ExpeditionState {
  const value = v.record(raw, "expedition", ["run", "node", "encounter", "undo", "result"], ["tutorial"]);
  const { tutorial, ...rest } = value;
  const base = readD5BaseExpedition(catalog, rest);
  if (base.run.routeId === catalog.data.tutorial?.routeId) return { ...base, tutorial: validateTutorialRun(catalog, tutorial, base, value => readD5BaseExpedition(catalog, value)) };
  if (tutorial !== undefined) v.invalid("tutorial", "Ordinary expeditions cannot carry tutorial state");
  return base;
}

export function readD5BaseExpedition(catalog: ValidatedD5Catalog, raw: unknown): D5BaseExpeditionState {
  v.assertJson(raw);
  const s = v.record(raw, "expedition", ["run", "node", "encounter", "undo", "result"]), run = validateRuleRunState(catalog, s.run);
  if (!isOrdinaryExpedition(catalog.data, run.routeId) && run.routeId !== catalog.data.tutorial?.routeId) v.invalid("run.kind", "Ordinary expedition route required");
  const layers = catalog.data.routes[run.routeId].layers.length;
  const node = v.choice(s.node, ["battle", "event", "room-complete", "exit", "finished"], "node"), def = demoRoom(catalog.data, run.routeId, run.layer, run.room);
  const room = run.roomIds[run.layer - 1][run.room], same = (a: unknown, b: unknown) => v.canonicalJson(a) === v.canonicalJson(b);
  if (node === "battle") {
    if (def.kind !== "battle" || s.result !== null) v.invalid("node", "Invalid battle room");
    readD5Battle(catalog, {run, encounter: s.encounter, undo: s.undo});
  } else {
    if (s.encounter !== null || v.list(s.undo, "undo").length) v.invalid("node", "Non-battle retains combat");
    if (node === "finished") {
      const t = validateTerminal(catalog, s.result);
      if (!same(t.commissionRewards ?? null, run.commissionRewards ? commissionReceipt(run.commissionRewards, run.completedRoomIds, run.settledLayers, t.outcome) : null)) v.invalid("commissionRewards", "Quest receipt differs from run");
      if (t.lootProof && !same(t.lootProof, {seed: run.rng.loot.seed, completedRoomIds: run.completedRoomIds})) v.invalid("lootProof", "Loot proof differs from run");
      if (t.lootLedger && !same(t.lootLedger, lootPockets(run.carriedLoot ?? [], run.roomIds, run.settledLayers))) v.invalid("lootLedger", "Loot receipt differs from run");
      if (t.runId !== run.id || t.routeId !== run.routeId || t.deepestLayer !== run.layer || t.bankedGold !== run.bankedGold || !same(t.partyIds, run.party.map(m => m.id)) || !same(t.layerResults, run.layerResults) || !same(t.returnedSupplies, run.supplies)) v.invalid("terminal", "Terminal differs from run");
      if (t.outcome === "wipe" ? run.party.some(m => m.hp > 0) : t.outcome === "cleared" ? run.layer !== layers || run.settledLayers.length !== layers || !run.roomIds.flat().every(id => run.completedRoomIds.includes(id)) || !run.party.some(m => m.hp > 0) || !same(t.completion, {roomIds: run.completedRoomIds, encounterIds: run.completedEncounterIds}) : def.kind !== "exit" || !run.settledLayers.includes(run.layer)) v.invalid("terminal", "No legal terminal cause");
    } else {
      if (s.result !== null) v.invalid("result", "Premature terminal");
      if (node === "event" && (def.kind !== "event" || run.completedRoomIds.includes(room))) v.invalid("node", "Invalid event window");
      if (node === "exit" && (def.kind !== "exit" || !run.settledLayers.includes(run.layer))) v.invalid("node", "Locked exit");
      if (node === "room-complete" && !run.completedRoomIds.includes(room)) v.invalid("node", "Uncompleted room");
    }
  }
  for (let l = 0; l < run.layer; l++) for (let r = 0; r < run.roomIds[l].length; r++) {
    if (l === run.layer - 1 && r >= run.room) break;
    if (!run.completedRoomIds.includes(run.roomIds[l][r])) v.invalid("room", "Earlier room skipped");
  }
  for (const paid of run.layerResults) if (!run.roomIds[paid.layer - 1].every((id, i) => demoRoom(catalog.data, run.routeId, paid.layer, i).kind === "exit" || run.completedRoomIds.includes(id))) v.invalid("layer", "Premature layer payment");
  return structuredClone(raw) as D5BaseExpeditionState;
}
export const D5_RUN_READERS: D5RunReaders = { expedition: readD5Expedition, memory: readD5MemoryBattle, requireJourneyHistory: true };
