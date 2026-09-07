import type { ValidatedD5Catalog } from "../contracts/d5";
import * as v from "../contracts/validation";
import type { D5ExpeditionState, D5RunReaders } from "./d5-types";
import { readD5Battle, readD5MemoryBattle } from "../battle/d5-engine";
import { validateRuleRunState } from "../battle/rules/v2/validation";
import { validateTerminal } from "./demo-expedition";
import { demoRoom } from "../contracts/demo-journey-validation";

export function readD5Expedition(catalog: ValidatedD5Catalog, raw: unknown): D5ExpeditionState {
  v.assertJson(raw);
  const s = v.record(raw, "expedition", ["run", "node", "encounter", "undo", "result"]), run = validateRuleRunState(catalog, s.run);
  if (![catalog.data.manor!.firstClearRouteId, catalog.data.manor!.maintenanceRouteId].includes(run.routeId)) v.invalid("run.kind", "Ordinary expedition route required");
  const node = v.choice(s.node, ["battle", "event", "room-complete", "exit", "finished"], "node"), def = demoRoom(catalog.data, run.routeId, run.layer, run.room);
  const room = run.roomIds[run.layer - 1][run.room], same = (a: unknown, b: unknown) => v.canonicalJson(a) === v.canonicalJson(b);
  if (node === "battle") {
    if (def.kind !== "battle" || s.result !== null) v.invalid("node", "Invalid battle room");
    readD5Battle(catalog, {run, encounter: s.encounter, undo: s.undo});
  } else {
    if (s.encounter !== null || v.list(s.undo, "undo").length) v.invalid("node", "Non-battle retains combat");
    if (node === "finished") {
      const t = validateTerminal(catalog, s.result);
      if (t.runId !== run.id || t.routeId !== run.routeId || t.deepestLayer !== run.layer || t.bankedGold !== run.bankedGold || !same(t.partyIds, run.party.map(m => m.id)) || !same(t.layerResults, run.layerResults) || !same(t.returnedSupplies, run.supplies)) v.invalid("terminal", "Terminal differs from run");
      if (t.outcome === "wipe" ? run.party.some(m => m.hp > 0) : t.outcome === "cleared" ? run.layer !== 5 || run.settledLayers.length !== 5 || !run.roomIds.flat().every(id => run.completedRoomIds.includes(id)) || !run.party.some(m => m.hp > 0) || !same(t.completion, {roomIds: run.completedRoomIds, encounterIds: run.completedEncounterIds}) : def.kind !== "exit" || !run.settledLayers.includes(run.layer)) v.invalid("terminal", "No legal terminal cause");
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
  return structuredClone(raw) as D5ExpeditionState;
}
export const D5_RUN_READERS: D5RunReaders = { expedition: readD5Expedition, memory: readD5MemoryBattle, requireJourneyHistory: true };
