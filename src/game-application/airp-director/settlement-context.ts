import { canonicalJson, type DirectorCapabilities } from "../../game-core/contracts";
import { currentSettlementActors } from "../airp-settlement/actor-context";
import type { AirpReplayInput } from "../versions/airp-boundary";
import type { DirectorSource } from "./contracts";
import type { MemoryView } from "../airp-memory/contracts";

/** Replayed from the handoffs present AT this command, never from a later save snapshot. */
export function directorSettlementContext(input: AirpReplayInput, capabilities: DirectorCapabilities, includeAssets = false, view?: MemoryView) {
  const shares = input.facts.filter(f => f.kind === "airp-game" && f.payload.settlement && !input.retracted.includes(f.id));
  const memories: DirectorSource[] = [], facts: DirectorSource[] = [];
  const threads = new Map<string, DirectorSource>();
  let latest: import("../airp-settlement/share").SettlementShare | undefined;
  const reads: DirectorSettlementReads = [];
  for (const f of shares) {
    if (f.kind !== "airp-game" || !f.payload.settlement) continue;
    const share = f.payload.settlement;
    reads.push({ eventId: share.memory.scope.eventId, runId: share.memory.scope.runId, lines: share.read });
    latest = share;
    const source = (id: string, text: string, knownBy: string[]): DirectorSource => ({ id, text, phase: share.memory.phase, knownBy, evidenceIds: [f.id] });
    share.memory.points.forEach((point, i) => memories.push(source(`${share.memory.id}:${i}`, canonicalJson(point), point.knownBy)));
    for (const closed of share.memory.closed) threads.delete(closed.id);
    for (const opened of share.memory.opened) threads.set(opened.id, source(opened.id, canonicalJson({ unresolved: opened }), opened.knownBy));
    if (share.assessment === "program-only") facts.push(source(`assessment:${f.id}`, canonicalJson({ taskId: share.taskId, assessment: share.assessment, narrativeVariables: "not-assessed", originalTextRetained: true }), ["kael"]));
  }
  if (view) {
    const original = new Map([...memories, ...threads.values()].map(m => [m.id, m]));
    memories.length = 0; threads.clear();
    for (const t of view.targets) {
      const source = original.get(t.id); if (!source) continue;
      const effective = {...source, text: canonicalJson(t.kind === "thread" ? {unresolved: t.value} : t.value)};
      if (t.kind === "thread") threads.set(t.id, effective); else memories.push(effective);
    }
  }
  const phase = (input.after.clock.day - 1) * 4 + ["dawn", "day", "dusk", "night"].indexOf(input.after.clock.phase);
  if (includeAssets) facts.push({ id: "assets:current", phase, text: canonicalJson({ kind: "actual-program-assets", authority: "program-only; no narrative extra award",
    owned: (input.after.loot ?? []).map(item => ({ instanceId: item.instanceId, resultId: item.resultId })),
    trades: (input.after.lootTrades ?? []).map(t => ({ id: t.id, kind: t.kind, instanceId: t.item.instanceId, resultId: t.item.resultId, gold: t.gold })) }), knownBy: ["kael"], evidenceIds: input.facts.length ? [input.facts.at(-1)!.id] : [] });
  if (!latest) return { memories, facts, capabilities, occupiedActorIds: [] as string[], state: undefined, reads };
  const actors = currentSettlementActors(latest.state.actors, phase, input.facts.filter(f => !input.retracted.includes(f.id)));
  const c = structuredClone(capabilities), currentPhase = input.after.clock.phase;
  for (const a of actors) if (a.locationId && c.locationIds.includes(a.locationId) && c.locations[a.actorId]) c.locations[a.actorId][currentPhase] = a.locationId;
  facts.push({ id: `variables:${latest.taskId}`, phase, text: canonicalJson({ kind: "current-settlement-state", affinity: latest.state.affinity, actors, assessment: latest.assessment }), knownBy: ["kael"], evidenceIds: [shares.at(-1)!.id] });
  return { memories: [...memories, ...threads.values()], facts, capabilities: c, occupiedActorIds: actors.filter(a => a.activity).map(a => a.actorId), state: { actors, affinity: latest.state.affinity }, reads };
}

export type DirectorSettlementReads = { eventId: string | null; runId: string | null; lines: import("../airp-settlement/share").SettlementShare["read"] }[];
/** Author context includes every related read original, not only NPC-shared speech.
 * knownBy remains attached: author knowledge must not become common character knowledge. */
export function relatedDirectorRead(reads: DirectorSettlementReads, eventId: string, runId: string | null) {
  const seen = new Set<string>();
  return reads.filter(r => r.eventId === eventId || runId !== null && r.runId === runId).flatMap(r => r.lines).filter(line => {
    if (seen.has(line.sourceId)) return false;
    seen.add(line.sourceId); return true;
  });
}
