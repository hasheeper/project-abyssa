import { D5_CATALOG_DATA } from "../../../content/gameplay/demo-v2/foundation";
import { validateD5Catalog } from "../../contracts/d5-validation";
import { canonicalJson, invalid } from "../../contracts/validation";
import { createDemoBattleEngine } from "../../battle/demo-engine";
import { resolveDemoCharacter } from "../../battle/rules/v2/configuration";
import { d5EventOrigin } from "../d5-parse";
import { d5MemorySupplyId, projectD5Progress } from "../d5-progress";
import type { DemoTerminal } from "../demo-expedition";
import type { D5MemoryBattleState, D5ExpeditionState, D5ProgressEntry, D5ProgressEvent, D5RunReaders } from "../d5-types";

export const d5Catalog = validateD5Catalog(D5_CATALOG_DATA);
export function d5Scenario() {
  const entries: D5ProgressEntry[] = [];
  const proofs = new Map<string, D5MemoryBattleState>();
  const expeditionProofs = new Map<string, D5ExpeditionState>();
  // A sealed, exact fixture reader substitutes ONLY for the not-yet-implemented C reader.
  // These terminal fixtures test provenance/lifecycle, not Marietta's combat or balance.
  const readers: D5RunReaders = { memory: (_c, raw) => {
    const proof = proofs.get(canonicalJson(raw));
    if (!proof) invalid("fixture", "Not a sealed terminal fixture");
    return structuredClone(proof);
  }, expedition: (_c, raw) => {
    const proof = expeditionProofs.get(canonicalJson(raw));
    if (!proof) invalid("fixture", "Not a sealed expedition terminal fixture");
    return structuredClone(proof);
  } };
  const state = () => projectD5Progress(d5Catalog, entries, readers);
  function add(event: D5ProgressEvent) {
    const revision = entries.length + 1;
    entries.push({ id: `proof:${revision}`, revision, origin: d5EventOrigin(event.type), event: structuredClone(event) });
    return entries.at(-1)!;
  }
  function depart(runId: string, partyIds = [...d5Catalog.data.initialParty], itemIds: string[] = []) {
    const s = state();
    add({ type: "expedition-started", runId, routeId: s.manor.takeover ? "old-manor.maintenance" : "old-manor.first-clear", partyIds, itemIds, progress: s.progress });
  }
  function settle(outcome: DemoTerminal["outcome"] = "extracted") {
    const s = state(), start = [...entries].reverse().find(e => e.event.type === "expedition-started")!.event;
    if (start.type !== "expedition-started") throw Error("fixture");
    const route = d5Catalog.data.routes[start.routeId], n = outcome === "cleared" ? 5 : 3;
    const rows = route.layers.map((row, l) => row.map((_, r) => `${start.runId}:room:${l + 1}:${r + 1}`));
    const rooms = rows.flat(), encounters = route.layers.flatMap((row, l) => row.filter(id => d5Catalog.data.journey!.rooms[id].kind === "battle").map((_, i) => `${start.runId}:encounter:${l + 1}-${i + 1}`));
    const terminal: DemoTerminal = {
      id: `terminal:${start.runId}`, runId: start.runId, routeId: start.routeId, outcome, deepestLayer: n,
      partyIds: [...start.partyIds], bankedGold: 0, lostLooseGold: 0, lostBankedGold: 0, totalGold: 0,
      returnedSupplies: [], layerResults: Array.from({ length: n }, (_, i) => ({ layer: i + 1, roomId: rows[i][0], looseGold: 0, handBonusPercent: 0, depthPercent: d5Catalog.data.journey!.depthPercent[i], earthPercent: 100, gold: 0 })),
      completion: outcome === "cleared" ? { roomIds: rooms, encounterIds: encounters } : null,
    };
    if (start.itemIds.length) throw Error("Use an explicit supply terminal fixture");
    if (s.activeRunRef?.id !== start.runId) throw Error("fixture active run");
    // The immutable fixture body exercises reader binding; no claim of a played D5 run.
    const base = createDemoBattleEngine(d5Catalog.shared).create({ runId: start.runId, routeId: start.routeId, partyIds: d5Catalog.data.initialParty, progress: start.progress, seed: 1 });
    const finalRun: D5ExpeditionState = { node: "finished", result: terminal, encounter: null, undo: [], run: { ...base.run, contentRef: d5Catalog.ref, layer: n, completedRoomIds: rooms, completedEncounterIds: encounters, layerResults: terminal.layerResults, progress: start.progress } };
    // Marietta's battle capability arrives in C; this fixture only carries a frozen configuration.
    finalRun.run.party = start.partyIds.map(id => {
      const old = base.run.party.find(p => p.id === id) ?? base.run.party[0];
      return { ...old, id, config: resolveDemoCharacter(d5Catalog.data, start.progress, id), hp: outcome === "wipe" ? 0 : old.hp };
    });
    expeditionProofs.set(canonicalJson(finalRun), structuredClone(finalRun));
    add({ type: "expedition-settled", terminal, finalRun });
    return terminal;
  }
  function claim(eventId: string, basisId: string) {
    const sessionId = `story:${entries.length}`;
    add({ type: "story-started", sessionId, eventId, basisId });
    add({ type: "story-advanced", sessionId, step: 0, choice: "skip" });
    return add({ type: "story-completed", sessionId });
  }
  function firstClear() {
    depart("first"); const t = settle("cleared");
    add({ type: "manor-story", terminalId: t.id, step: 0, choice: "skip" });
    return t;
  }
  function enterMemory() {
    add({ type: "memory-started", runId: "memory-one", chapterId: d5Catalog.data.progression.chapter.id, templateId: d5Catalog.data.progression.chapter.templateId, seed: 41 });
    const ref = { kind: "memory" as const, id: "memory-one", attempt: 1 };
    for (const node of ["history-opening", "teaching", "battle"] as const) add({ type: "memory-advanced", runRef: ref, node });
    return ref;
  }
  function memoryEnd(victory = true) {
    const m = state().memory!;
    const base = createDemoBattleEngine(d5Catalog.shared).create({ runId: m.id, routeId: "old-manor.first-clear", partyIds: d5Catalog.data.progression.chapter.partyIds, progress: d5Catalog.data.progression.chapter.progress, seed: m.seed });
    const b: D5MemoryBattleState = { ...base, run: { ...base.run, contentRef: d5Catalog.ref, supplies: d5Catalog.data.progression.chapter.supplies.map(s => ({ ...s, instanceId: d5MemorySupplyId(m.id, s.definitionId), source: "memory.marietta.allowance" })) }, undo: [] };
    b.encounter.definitionId = d5Catalog.data.progression.chapter.encounterId;
    b.encounter.phase = "complete"; b.encounter.outcome = victory ? "victory" : "wipe";
    b.encounter.enemies = [d5Catalog.data.progression.chapter.bossId, ...Array(3).fill(d5Catalog.data.progression.chapter.puppetId)].map((definitionId: string, i) => ({ ...base.encounter.enemies[0], id: `${base.encounter.id}:enemy:${i + 1}`, definitionId, hp: i === 0 ? victory ? 0 : 18 : 3 }));
    b.encounter.formation = victory ? [] : [b.encounter.enemies[0].id];
    if (!victory) b.run.party.forEach(p => { p.hp = 0; });
    proofs.set(canonicalJson(b), structuredClone(b));
    return add({ type: "memory-ended", terminal: { id: `terminal:memory:${m.attempt}`, runRef: { kind: "memory", id: m.id, attempt: m.attempt }, chapterId: m.chapterId, templateId: m.templateId, finalBattle: b } });
  }
  function unlock() {
    enterMemory(); const complete = memoryEnd();
    add({ type: "memory-advanced", runRef: { kind: "memory", id: "memory-one", attempt: 1 }, node: "return-pending" });
    claim(d5Catalog.data.progression.chapter.storyId, complete.id);
  }
  return { entries, readers, state, add, depart, settle, claim, firstClear, enterMemory, memoryEnd, unlock };
}
