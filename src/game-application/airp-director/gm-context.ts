import { canonicalJson, sha256, invalid, type ValidatedD5Catalog } from "../../game-core/contracts";
import { directorActorLocation } from "../../game-core/session";
import type { AirpReplayInput } from "../versions/airp-boundary";
import type { SourceDocument } from "../airp-generation/contracts";
import { selectSceneSources } from "../airp-generation/source-selection";
import type { DirectorSource, DirectorState, GMContext } from "./contracts";
export type { GMContext } from "./contracts";
import { projectDirectorContext } from "./context";
import { directorSettlementContext } from "./settlement-context";
import { readGMShare } from "../airp-game/gm-share";
import { directorMemoryContext } from "../airp-memory/d5";

export function projectGMContext(catalog: ValidatedD5Catalog, state: DirectorState, input: AirpReplayInput): GMContext {
  input = {...input, facts: input.facts.filter(f => f.source.saveId === input.head.saveId && f.source.epoch === input.head.epoch && f.source.revision <= input.head.revision)};
  const c = projectDirectorContext(catalog, state, input);
  const memoryContext = (state.lowContextVersion ?? 0) >= 19 ? directorMemoryContext(state, input) : undefined;
  const shared = directorSettlementContext(input, c.capabilities, true, memoryContext);
  const effective = input.facts.filter(f => !input.retracted.includes(f.id));
  const previousRead: GMContext["previousRead"] = [];
  for (const job of state.jobs) {
    if (job.kind !== "scene" || !job.scene || !job.text) continue;
    const reads = effective.filter(f => f.kind === "airp-director" && f.payload.command.type === "airp-director-read" && f.payload.command.jobId === job.id);
    if (!reads.length) continue;
    previousRead.push({sceneId: job.id, text: reads.map(f => {
      if (f.kind !== "airp-director" || f.payload.command.type !== "airp-director-read") return "";
      const line = job.text!.lines[f.payload.command.cursor]; return `${line.speaker}：${line.text}`;
    }).join("\n"), knownBy: ["kael", ...job.scene.actorIds], evidenceIds: reads.map(f => f.id), readCount: reads.length,
    complete: state.events.find(e => e.id === job.scene!.eventId)?.readSceneIds.includes(job.id) ?? false});
  }
  const originals = new Set(previousRead.map(r => `memory:${r.sceneId}`));
  const program = (s: DirectorSource) => /^(decision|action|wait|delivery|resolved):/.test(s.id);
  const threads = shared.memories.filter(m => {
    try { return !!JSON.parse(m.text).unresolved; } catch { return false; }
  });
  const threadIds = new Set(threads.map(t => t.id));
  return structuredClone({...(memoryContext ? {memoryContext} : {}), version: 1, sourceHead: input.head, knowledge: "gm-only-not-common-npc-knowledge", playerName: c.playerName,
    world: c.world, capabilities: c.capabilities, budget: c.budget,
    activity: {clock: input.after.clock, activeStoryId: input.after.activeStoryId ?? null, activeRun: input.run ? {id: input.run.run.id, routeId: input.run.run.routeId, node: input.run.node, layer: input.run.run.layer, roomIndex: input.run.run.room, partyIds: input.run.run.party.map(p => p.id)} : null},
    actorPresence: c.capabilities.actorIds.map(actorId => input.run?.run.party.some(p => p.id === actorId)
      ? {actorId, locationId: null, basis: "active-expedition"} : {actorId, locationId: directorActorLocation(c.capabilities, c.world, actorId), basis: "effective-state-or-program-schedule"}),
    tasks: state.events,
    dayPlans: state.days.map(d => {const j = state.jobs.find(j => j.id === d.jobId)!; return {...d, sourceHead: j.planning!.world.head, replaces: j.replaces ?? [], proposal: j.proposal!, proposalHash: sha256(canonicalJson(j.proposal))};}),
    facts: [...c.facts, ...c.memories.filter(program)],
    memories: c.memories.filter(m => !originals.has(m.id) && !threadIds.has(m.id) && !program(m)), openThreads: threads,
    settlement: shared.state ?? null, previousRead, expedition: readGMShare(input.facts, input.retracted), documents: []});
}

/** Trigger only from current public checkpoint data/history, never recursively from loaded cards or future nodes. */
export function selectGMDocuments(sources: SourceDocument[], context: GMContext, intent: string) {
  const actors = Object.fromEntries(context.capabilities.actorIds.map(id => [id, id]));
  const selected = selectSceneSources(sources, actors, {intent, activity: context.activity,
    tasks: context.tasks.map(e => ({title: e.card.title, synopsis: e.card.synopsis, motivation: e.card.motivation, status: e.status})),
    facts: context.facts, memories: context.memories, openThreads: context.openThreads}, context.previousRead.map(p => p.text).join("\n") + "\n" + (context.expedition?.reads.map(r => r.text).join("\n") ?? ""));
  const full = selected.full.filter(s => s.kind !== "guideline");
  for (const s of full) if (sha256(s.text) !== s.sha256) invalid("gm.sources", `Changed original: ${s.id}`);
  if (!full.some(s => s.kind === "player") || !full.some(s => s.kind === "world")) invalid("gm.sources", "Missing full player/base world");
  context.documents = full.map(s => ({id: s.id, sha256: s.sha256}));
  return full;
}

export function resolveGMDocuments(context: GMContext, sources: SourceDocument[]): SourceDocument[] {
  if (context.version !== 1 || context.knowledge !== "gm-only-not-common-npc-knowledge") invalid("gm.context", "Unknown frozen GM protocol");
  return context.documents.map(ref => {
    const source = sources.find(s => s.id === ref.id && s.sha256 === ref.sha256);
    if (!source || sha256(source.text) !== ref.sha256) return invalid("gm.sources", `Missing frozen full source: ${ref.id}`);
    return source;
  });
}
