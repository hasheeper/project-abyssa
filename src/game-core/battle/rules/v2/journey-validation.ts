import { eventFaceMethod } from "./event-face";
import type { RuleContext as ValidatedDemoCatalog } from "../../domain/rule-state";
import * as v from "../../../contracts/validation";
import type { DemoLayerResult, DemoRunState, DemoSupply } from "../../domain/demo-state";

export function validateSupplies(catalog: ValidatedDemoCatalog, raw: unknown, max: number, memory = false): DemoSupply[] {
  const seen = new Set<string>(), defs = new Set<string>();
  for (const x of v.list(raw, "supplies", max)) {
    const s = v.record(x, "supply", ["instanceId", "definitionId", "source", "charges"]);
    const id = v.id(s.instanceId, "supply.instanceId"), defId = v.id(s.definitionId, "supply.definitionId");
    const def = v.reference(catalog.data.journey?.items ?? {}, defId, "supply");
    const economy = catalog.data.rulesVersion === 4 ? catalog.data.economy : undefined;
    const source = memory && catalog.ref.rulesVersion === 4 ? "memory.marietta.allowance"
      : economy && !economy.freeItemIds.includes(defId) ? "supply.demo.shop" : "supply.demo.allowance";
    v.choice(s.source, [source], "supply.source");
    v.number(s.charges, "charges", 0, def.capacity);
    if (seen.has(id) || defs.has(defId)) v.invalid("supplies", "Duplicate supply instance or slot");
    seen.add(id); defs.add(defId);
  }
  return raw as DemoSupply[];
}
export function layerGold(loose: number, bonus: number, depth: number, earth: number) {
  return Math.floor((loose * (100 + bonus) * depth * earth + 500000) / 1000000);
}
export function validateLayerResult(catalog: ValidatedDemoCatalog, raw: unknown): DemoLayerResult {
  const r = v.record(raw, "layerResult", ["layer", "roomId", "looseGold", "handBonusPercent", "depthPercent", "earthPercent", "gold"]);
  const j = catalog.data.journey;
  if (!j) v.invalid("layerResult", "No layer economy in this Catalog");
  const layer = v.number(r.layer, "layer", 1, j.depthPercent.length);
  v.id(r.roomId, "roomId");
  const loose = v.number(r.looseGold, "looseGold", 0, 1e6), bonus = v.number(r.handBonusPercent, "handBonusPercent", 0, j.handBonusCapPercent);
  const depth = v.choice(r.depthPercent, [j.depthPercent[layer - 1]], "depthPercent");
  const earth = v.choice(r.earthPercent, [100, 110], "earthPercent");
  if (r.gold !== layerGold(loose, bonus, depth, earth)) v.invalid("gold", "Layer payout differs");
  return raw as DemoLayerResult;
}
export function validateJourneyRun(catalog: ValidatedDemoCatalog, r: Record<string, unknown>) {
  const run = r as unknown as DemoRunState, route = catalog.data.routes[run.routeId];
  const all: string[] = [];
  const rows = v.list(r.roomIds, "roomIds", 5);
  if (rows.length !== route.layers.length) v.invalid("roomIds", "Layer identities differ");
  rows.forEach((row, index) => {
    const ids = v.ids(row, "roomIds", 20);
    if (ids.length !== route.layers[index].length) v.invalid("roomIds", "Room identities differ");
    ids.forEach(id => { if (!id.startsWith(`${run.id}:room:`) || all.includes(id)) v.invalid("roomId", "Invalid room instance"); all.push(id); });
  });
  const completed = v.ids(r.completedRoomIds, "completedRoomIds", 100);
  const current = all.indexOf(run.roomIds[run.layer - 1][run.room]);
  completed.forEach(id => { if (!all.includes(id) || all.indexOf(id) > current) v.invalid("completedRoomIds", "Completion outside visited rooms"); });
  validateSupplies(catalog, r.supplies, 4, catalog.data.rulesVersion === 4 && run.routeId === catalog.data.combat.memory.routeId);
  for (const [id, amount] of Object.entries(v.record(r.foodUses, "foodUses"))) {
    if (!run.party.some(m => m.id === id)) v.invalid("foodUses", "Member outside party");
    v.number(amount, "foodUses", 0, 2);
  }
  const layerResults = v.list(r.layerResults, "layerResults", 5).map(raw => validateLayerResult(catalog, raw));
  if (new Set(layerResults.map(x => x.layer)).size !== layerResults.length) v.invalid("layerResults", "Duplicate layer payout");
  for (const x of layerResults) {
    if (x.layer > run.layer || !run.roomIds[x.layer - 1].includes(x.roomId) || !completed.includes(x.roomId)) v.invalid("layerResult", "Unfinished layer payout");
    if (x.earthPercent !== (run.party.filter(m => m.config.suits.includes("earth")).length >= 4 ? 110 : 100)) v.invalid("earthPercent", "Wrong frozen resonance");
  }
  if (catalog.data.journey && (v.canonicalJson(run.settledLayers) !== v.canonicalJson(layerResults.map(x => x.layer)) || run.bankedGold !== layerResults.reduce((n, x) => n + x.gold, 0))) v.invalid("bankedGold", "Banked ledger differs");
  const eventRooms = new Set<string>();
  for (const raw of v.list(r.eventResults, "eventResults", 100)) {
    const e = v.record(raw, "eventResult", ["roomId", "eventId", "choiceId", "actorId", "faceId", "method", "cost", "reward"]);
    const roomId = v.id(e.roomId, "event.roomId");
    if (!completed.includes(roomId) || eventRooms.has(roomId)) v.invalid("event", "Uncompleted or duplicate event");
    eventRooms.add(roomId);
    const pos = run.roomIds.findIndex(row => row.includes(roomId));
    const room = catalog.data.journey?.rooms[route.layers[pos][run.roomIds[pos].indexOf(roomId)]];
    if (room?.kind !== "event" || room.eventId !== e.eventId) v.invalid("event", "Event differs from room");
    const def = v.reference(catalog.data.journey?.events ?? {}, e.eventId, "eventId");
    v.choice(e.choiceId, ["read", "attempt", "skip"], "choiceId");
    const method = v.choice(e.method, ["read", "skip", "strong", "weak", "failed"], "method");
    if (e.choiceId === "attempt") {
      const member = run.party.find(m => m.id === e.actorId);
      if (!member || !member.config.faces.some(f => f.id === e.faceId)) v.invalid("event.actor", "Face outside member");
      if (method !== eventFaceMethod(catalog.data, member.config.faces.find(f => f.id === e.faceId)!)) v.invalid("event.method", "Outcome differs from face");
      if (def.kind !== "relic" || e.cost !== def.cost || e.reward !== (["strong", "weak"].includes(method) ? def.reward : 0)) v.invalid("event", "Event reward differs");
    } else if ((e.choiceId === "read" && def.kind === "relic") || e.actorId !== null || e.faceId !== null || e.cost !== 0 || e.reward !== 0 || method !== e.choiceId) v.invalid("event", "Non-random choice has effects");
  }
  v.ids(r.revealed, "revealed", 100).forEach(id => {
    if (id.startsWith("layer:")) { const n = Number(id.slice(6)); if (!Number.isInteger(n) || n < 2 || n > route.layers.length || n > run.layer + 1) v.invalid("revealed", "Unknown information layer"); }
    else { const l = run.roomIds.findIndex(row => row.includes(id)); const index = l < 0 ? -1 : run.roomIds[l].indexOf(id); if (l < 0 || all.indexOf(id) > current || catalog.data.journey?.rooms[route.layers[l][index]].kind !== "event") v.invalid("revealed", "Unknown information target"); }
  });
  const rng = v.record(r.eventRng, "eventRng", ["algorithm", "seed", "cursor"]);
  v.choice(rng.algorithm, ["mulberry32"], "eventRng.algorithm"); v.number(rng.seed, "eventRng.seed", 0, 0xffffffff); v.number(rng.cursor, "eventRng.cursor");
  if (rng.seed !== ((run.rng.combat.seed ^ 0x3c6ef372) >>> 0) || rng.cursor !== run.eventResults.filter(e => e.choiceId === "attempt").length) v.invalid("eventRng", "Event stream differs from decisions");
}
