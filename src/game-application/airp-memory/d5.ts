import type { SettlementMemory, SettlementThread } from "../../game-core/contracts";
import type { HeadRef } from "../contracts";
import type { DirectorState } from "../airp-director/contracts";
import type { AirpReplayInput } from "../versions/airp-boundary";
import type { D5GameRecord } from "../versions/d5-contracts";
import { readGMShare } from "../airp-game/gm-share";
import type { MemoryContext, MemoryEvidence } from "./contracts";
import { effectiveMemory, memoryTargets } from "./effective";

/** Read the validated historical prefix, never a later mutable settlement ledger. */
export function directorMemoryContext(state: DirectorState, input: AirpReplayInput): MemoryContext {
  const facts = input.facts.filter(f => !input.retracted.includes(f.id) && f.source.saveId === input.head.saveId && f.source.epoch === input.head.epoch && f.source.revision <= input.head.revision);
  const memories: Pick<SettlementMemory, "id" | "phase" | "scope" | "points">[] = [], allThreads = new Map<string, SettlementThread>(), rawClosed = new Set<string>();
  const evidence = new Map<string, MemoryEvidence>(), readHeads: Record<string, HeadRef> = {};
  const add = (id: string, knownBy: string[], head: HeadRef, speakerId?: string) => {
    const old = evidence.get(id);
    if (!old || head.revision < old.head.revision) evidence.set(id, {id, knownBy: [...new Set(knownBy)], head, ...(speakerId ? {speakerId} : {})});
  };
  for (const f of facts) {
    if (f.kind === "airp-game" && f.payload.settlement) {
      const m = f.payload.settlement.memory; memories.push(m);
      for (const t of m.opened) { allThreads.set(t.id, t); rawClosed.delete(t.id); }
      for (const t of m.closed) rawClosed.add(t.id);
      for (const line of f.payload.settlement.read) {
        const speaker = line.text.slice(0, line.text.indexOf("："));
        add(line.sourceId, line.knownBy, f.source, speaker && speaker !== "narrator" ? speaker : undefined);
      }
    }
    if (f.kind === "airp-director" && f.payload.command.type === "airp-director-read") {
      const cmd = f.payload.command, job = state.jobs.find(j => j.id === cmd.jobId);
      if (job?.text && job.scene) {
        const line = job.text.lines[cmd.cursor], knownBy = line?.speaker === "narrator" ? ["kael"] : ["kael", ...job.scene.actorIds];
        add(f.id, knownBy, f.source, line?.speaker !== "narrator" ? line?.speaker : undefined); add(`read:${f.id}`, knownBy, f.source, line?.speaker !== "narrator" ? line?.speaker : undefined);
        add(`current:${job.id}:${cmd.cursor}`, knownBy, f.source, line?.speaker !== "narrator" ? line?.speaker : undefined);
        if (cmd.cursor === job.text.lines.length - 1 && state.events.some(e => e.readSceneIds.includes(job.id))) readHeads[job.id] = f.source;
      }
    } else if (f.kind !== "airp-director" && f.kind !== "airp-game") add(f.id, ["kael"], f.source);
  }
  // These entries are actual selections/program results, not full prose or GM plans.
  for (const m of state.memories.filter(m => /^(attitude|decision|action|wait|delivery|resolved):/.test(m.id))) {
    const sources = facts.filter(f => m.evidenceIds.includes(f.id));
    if (sources.length === new Set(m.evidenceIds).size && sources.length) {
      add(m.id, m.knownBy, sources.at(-1)!.source);
      for (const f of sources) add(f.id, m.knownBy, f.source);
    }
  }
  const share = readGMShare(facts, []);
  for (const r of share?.reads ?? []) {
    const speaker = r.text.slice(0, r.text.indexOf("："));
    add(r.sourceId, r.knownBy, r.head, speaker && speaker !== "narrator" ? speaker : undefined);
  }
  const records = [...state.jobs.flatMap(j => j.memoryCorrections ?? []), ...(share?.memoryCorrections ?? [])]
    .filter(r => r.recordedHead.revision <= input.head.revision);
  const view = effectiveMemory(memoryTargets(memories, [...allThreads.values()]), records, readHeads);
  view.targets = view.targets.filter(t => t.kind !== "thread" || !rawClosed.has(t.id));
  return {...view, sourceHead: input.head, evidence: [...evidence.values()]};
}
export function recordMemoryContext(record: D5GameRecord): MemoryContext | undefined {
  if (!record.airpDirector || (record.airpDirector.lowContextVersion ?? 0) < 19) return undefined;
  const c = record.snapshot.campaign;
  return directorMemoryContext(record.airpDirector, {head: record.head, before: c, after: c, facts: record.facts, group: [], retracted: record.retractedFactIds, run: null});
}
/** Only this ID admits the unread draft; candidates/GM guidance are not evidence. */
export function sceneMemoryContext(context: MemoryContext, sceneId: string, actorIds: string[], lines: {speaker: string; text: string}[]): MemoryContext {
  return {...context, evidence: [...context.evidence, ...lines.map((line, index) => ({id: `current:${sceneId}:${index}`, text: `${line.speaker}：${line.text}`,
    knownBy: line.speaker === "narrator" ? ["kael"] : ["kael", ...actorIds], head: context.sourceHead, pendingSceneId: sceneId, ...(line.speaker !== "narrator" ? {speakerId: line.speaker} : {})}))]};
}
