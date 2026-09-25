import type { DirectorCard, DirectorWorld, ValidatedD5Catalog } from "../../game-core/contracts";
import { canonicalJson, emptyDirectorBudget } from "../../game-core/contracts";
import { airpPhaseIndex, directorActorLocation, directorDay, directorSceneId } from "../../game-core/session";
import { airpEligible, type AirpReplayInput } from "../versions/airp-boundary";
import type { DirectorEvent, DirectorPlanningContext, DirectorSceneContext, DirectorSource, DirectorState } from "./contracts";
import { directorSettlementContext, relatedDirectorRead } from "./settlement-context";
import { directorMemoryContext } from "../airp-memory/d5";
import { directorSceneProgress } from "./progress";
import { directorTaskGuide } from "./task-guide";
import { directorReplyPurpose } from "./continuation";
import { withResidentCapabilities } from "./residents";
import { directorReplyPurposeV20 } from "./event-brief-v20";

export const ongoingDirectorEvent = (e: DirectorEvent) => ["offered", "accepted", "waiting-action", "feedback", "ready"].includes(e.status);
export function directorFollowupCard(parent: DirectorEvent): DirectorCard {
  return {...structuredClone(parent.card), id: `${parent.card.id}.followup`, title: `${parent.card.title} · 后续`, form: "vignette", load: "light", actions: [],
    synopsis: "承接已完成并读完的结果，只继续一个新生活节拍，不重新发布原任务。", motivation: "只据父事件的实际经历与已读文本。",
    volatility: "inert", offerPhases: 8, repeat: "once", aftermath: null};
}
export function projectDirectorContext(catalog: ValidatedD5Catalog, state: DirectorState, input: AirpReplayInput): DirectorPlanningContext {
  const content = catalog.data.airpDirector!, c = input.after, phase = airpPhaseIndex(c.clock.day, c.clock.phase);
  const effective = input.facts.filter(f => !input.retracted.includes(f.id));
  const facts: DirectorSource[] = effective.flatMap(f => f.kind === "progression" || f.kind === "save-created" ? [{id: f.id, phase: airpPhaseIndex(f.worldTime.day, f.worldTime.phase),
    text: canonicalJson([22, 24, 26, 28].includes(catalog.ref.contentVersion) && f.kind === "progression" && f.payload.type === "expedition-settled" ? { type: f.payload.type, runId: f.payload.terminal.runId, routeId: f.payload.terminal.routeId, outcome: f.payload.terminal.outcome, deepestLayer: f.payload.terminal.deepestLayer } : f.payload), knownBy: ["kael"], evidenceIds: [f.id]}] : []);
  const shared = directorSettlementContext(input, withResidentCapabilities(content.capabilities, state.residentCast), [22, 24, 26, 28].includes(catalog.ref.contentVersion), (state.lowContextVersion ?? 0) >= 19 ? directorMemoryContext(state, input) : undefined);
  facts.push(...shared.facts);
  const memories = [...state.memories.filter(m => m.phase <= phase && m.evidenceIds.every(id => effective.some(f => f.id === id))), ...shared.memories];
  const world: DirectorWorld = {
    head: {...input.head}, phase, eligible: airpEligible(c), availableActorIds: [...new Set([...c.availableCharacterIds, ...Object.keys(state.residentCast?.locations ?? {})])], occupiedActorIds: state.residentCast ? [...new Set([...shared.occupiedActorIds, ...(input.run?.run.party.map(p => p.id) ?? [])])] : shared.occupiedActorIds,
    sourceIds: [...facts.map(f => f.id), ...memories.map(m => m.id)],
    existing: state.events.filter(ongoingDirectorEvent).map(e => ({id: e.id, load: e.card.load, form: e.card.form, status: e.status === "offered" ? "offered" : e.status === "ready" ? "ready" : "accepted"})),
    requiredStoryIds: c.activeStoryId ? [c.activeStoryId] : [], busyFocus: !!c.activeRunRef,
    reserves: state.events.filter(e => e.status === "reserve").map(e => ({eventId: e.id, card: e.card, availableFromPhase: (Math.floor(e.expiresPhase! / 4) + 1) * 4})),
    themes: state.events.filter(e => e.status === "planned" || ongoingDirectorEvent(e) || e.endedPhase !== null).map(e => ({key: e.card.themeKey, description: e.card.themeDescription, objectIds: e.card.objectIds, sourceId: e.id, untilPhase: e.endedPhase === null ? null : e.endedPhase + 256})),
    uniqueCompletedIds: state.events.filter(e => e.status === "resolved" && e.card.repeat === "once" && !e.parentId).flatMap(e => [e.card.id, ...e.card.actions.flatMap(a => a.kind === "patrol" ? [a.objectiveId] : [])]),
    followups: state.events.filter(e => !e.parentId && e.status === "resolved").map(e => ({parentId: e.id, card: directorFollowupCard(e), consumed: e.followupConsumed,
      eligible: e.readSceneIds.length > 0 && (state.memories.some(m => m.id === `excerpt:${e.readSceneIds.at(-1)}`) || effective.some(f => f.kind === "airp-game" && f.payload.settlement?.memory.scope.eventId === e.id && f.payload.settlement.memory.scope.kind === "event"))})),
  };
  return {version: 1, sourceKind: "gameplay", playerName: c.playerName ?? "凯尔", world, capabilities: shared.capabilities, fixed: content.fixed,
    authorSources: content.authorSources.map(s => ({id: s.id, text: canonicalJson(s.body), digest: s.digest})), facts, memories,
    tasks: state.events.filter(ongoingDirectorEvent).map(({id, card, status, role, actionIndex, occurrence, selected, deferredUntil, actionPhase, actionOutcome, evidenceIds, readSceneIds}) =>
      structuredClone({id, card, status, role, actionIndex, occurrence, selected, deferredUntil, actionPhase, actionOutcome, evidenceIds, readSceneIds})),
    budget: state.budgets.find(b => b.day === directorDay(phase)) ?? emptyDirectorBudget(directorDay(phase))};
}
export function directorEventSceneId(e: DirectorEvent) {const id = directorSceneId(e.id, e.role, e.actionIndex, e.occurrence); return e.dialogueTurn ? `${id}:turn:${e.dialogueTurn}` : id;}
export function directorEntrance(e: DirectorEvent, c: DirectorPlanningContext): {actorId: string; locationId: string} | null {
  if (!c.world.eligible || e.status === "planned" || e.status === "reserve" || e.status === "cancelled" || e.deferredUntil > c.world.phase) return null;
  if (e.role === "action" && e.actionPhase !== null) return null;
  if ((e.status === "closed" || e.status === "resolved") && e.readSceneIds.includes(directorEventSceneId(e))) return null;
  const a = e.card.actions[e.actionIndex];
  const actorId = e.role === "action" || e.role === "feedback" ? a?.actorId ?? e.card.giverId : e.card.giverId;
  const locationId = e.role === "action" || e.role === "feedback" ? a?.locationId ?? e.card.locationId : e.card.locationId;
  const participants = e.role === "aftermath" ? e.card.aftermath!.actorIds : [actorId];
  return [actorId, ...participants].every(id => directorActorLocation(c.capabilities, c.world, id) === locationId) ? {actorId, locationId} : null;
}
export function projectDirectorScene(catalog: ValidatedD5Catalog, state: DirectorState, e: DirectorEvent, input: AirpReplayInput): DirectorSceneContext {
  const context = projectDirectorContext(catalog, state, input), a = e.card.actions[e.actionIndex];
  const shared = directorSettlementContext(input, context.capabilities, [22, 24, 26, 28].includes(catalog.ref.contentVersion), (state.lowContextVersion ?? 0) >= 19 ? directorMemoryContext(state, input) : undefined);
  const actorIds = e.role === "aftermath" ? [...e.card.aftermath!.actorIds] : [e.role === "action" || e.role === "feedback" ? a?.actorId ?? e.card.giverId : e.card.giverId];
  if (state.residentCast && e.role !== "aftermath") {
    const location = e.role === "action" || e.role === "feedback" ? a?.locationId ?? e.card.locationId : e.card.locationId;
    for (const id of e.card.actorIds) if (!actorIds.includes(id) && directorActorLocation(context.capabilities, context.world, id) === location) actorIds.push(id);
  }
  const known = (s: {knownBy: string[]}) => actorIds.every(id => s.knownBy.includes(id));
  const readJobs = state.jobs.filter(j => j.kind === "scene" && (j.scene?.eventId === e.id && e.readSceneIds.includes(j.scene.sceneId) || e.parentId && j.scene?.eventId === e.parentId && state.events.find(p => p.id === e.parentId)?.readSceneIds.includes(j.id)) && j.text);
  const previous = readJobs
    .map(j => ({sceneId: j.scene!.sceneId, text: j.text!.lines.map(l => `${l.speaker}：${l.text}`).join("\n"), knownBy: ["kael", ...j.scene!.actorIds], evidenceIds: state.memories.find(m => m.id === `memory:${j.scene!.sceneId}`)?.evidenceIds ?? []})).filter(known);
  // Only an accepted task's read request/reply can travel with its player relay.
  // This is not a global knowledge grant or a claim that the recipient witnessed the source scene.
  const taskReports = e.card.form === "liaison" && (e.role === "action" || e.role === "result") ? readJobs.filter(j => {
    const s = j.scene!;
    return s.eventId === e.id && !actorIds.every(id => s.actorIds.includes(id)) &&
      (e.role === "action" && (s.role === "offer" || s.role === "acceptance") ||
       s.role === "feedback" && s.actionIndex < e.actionIndex);
  }).map(j => ({sceneId: j.id, text: j.text!.lines.map(l => `${l.speaker}：${l.text}`).join("\n"),
    fromActorIds: [...j.scene!.actorIds], toActorIds: [...actorIds], via: "player-task-relay" as const,
    evidenceIds: state.memories.find(m => m.id === `memory:${j.id}`)?.evidenceIds ?? []})) : [];
  const sharedFacts = context.memories.filter(known);
  const deliveryMemory = state.memories.find(m => m.id === `delivery:${e.id}`);
  if (deliveryMemory && known(deliveryMemory) && !sharedFacts.some(m => m.id === deliveryMemory.id)) sharedFacts.push(deliveryMemory);
  const stageIntent = e.role === "action" ? `当前行动前的交谈。${a?.intent}。停在玩家做法选择前。` : e.role === "feedback" ? `只反馈玩家刚才的实际行动，结果为${e.actionOutcome}。${a?.intent}。失败不能宣称完成。`
    : e.role === "aftermath" ? e.card.aftermath!.intent : e.role === "followup" ? "承接父事件已读结果的额外生活后续，不重新接受原任务。" : e.card.scenes[e.role as keyof typeof e.card.scenes];
  const source = context.authorSources.find(s => s.id === (context.fixed.find(f => f.card.id === e.card.id)?.sourceId));
  const purpose = {role: e.role, turn: e.dialogueTurn ?? 0, intent: stageIntent ?? e.card.scenes.result};
  const intent = (state.lowContextVersion ?? 0) >= 20 ? directorReplyPurposeV20({...purpose, cardId: e.card.id, digest: source?.digest}) : (state.lowContextVersion ?? 0) >= 13 ? directorReplyPurpose(purpose) : stageIntent;
  const v3 = (state.lowContextVersion ?? 0) >= 3;
  // Keep complete originals once in previous/taskReports. These were previously repeated
  // as both facts and memories; their prose is not an additional program fact.
  const originals = new Set([...previous, ...taskReports].map(p => `memory:${p.sceneId}`));
  const programMemory = (id: string) => /^(decision|action|wait|delivery|resolved):/.test(id);
  const facts = v3 ? [...context.facts.filter(known), ...sharedFacts.filter(m => programMemory(m.id))] : sharedFacts;
  const memories = v3 ? sharedFacts.filter(m => !originals.has(m.id) && !programMemory(m.id)) : sharedFacts;
  const v6 = (state.lowContextVersion ?? 0) >= 6;
  const progress = v3 ? directorSceneProgress(e, input, readJobs.filter(j => previous.some(p => p.sceneId === j.id)), v6) : undefined;
  const priorTurn = readJobs.filter(j => j.scene?.role === e.role && j.scene.actionIndex === e.actionIndex && j.scene.occurrence === e.occurrence && previous.some(p => p.sceneId === j.id)).at(-1);
  return {version: 1, sourceKind: "gameplay", head: {...input.head}, phase: context.world.phase, playerName: context.playerName,
    eventId: e.id, sceneId: directorEventSceneId(e), role: e.role, actorIds, locationId: directorEntrance(e, context)?.locationId ?? e.card.locationId,
    card: e.card, actionIndex: e.actionIndex, occurrence: e.occurrence, intent: intent ?? e.card.scenes.result,
    ...((state.lowContextVersion ?? 0) >= 11 ? {dialogue: {turn: e.dialogueTurn ?? 0, role: e.role, purpose: intent ?? e.card.scenes.result, programState: progress,
      ...((state.lowContextVersion ?? 0) >= 12 ? {programDecisionPending: e.role === "offer" || e.role === "action"} : {}),
      ...((state.lowContextVersion ?? 0) >= 13 ? {previousRead: structuredClone(previous)} : {}),
      ...((state.lowContextVersion ?? 0) >= 14 ? {gmManaged: true as const} : {}),
      taskGuide: directorTaskGuide(e, context.capabilities, context.authorSources), selectedResponse: readJobs.filter(j => j.scene?.role === e.role && j.scene.actionIndex === e.actionIndex && j.scene.occurrence === e.occurrence).at(-1)?.lowResponse?.text ?? null}} : {}),
    choices: e.role === "offer" ? e.card.choices : e.role === "action" ? a.choices : [], selected: structuredClone(e.selected),
    ...((state.lowContextVersion ?? 0) >= 8 ? { selectedAttitudes: state.memories.filter(m => m.id.startsWith("attitude:") && e.evidenceIds.some(id => m.evidenceIds.includes(id)) && known(m)) } : {}),
    facts, memories, previous, taskReports,
    ...((state.lowContextVersion ?? 0) >= 15 ? {previousEvaluation: priorTurn?.sceneGMEvaluation ? {...structuredClone(priorTurn.sceneGMEvaluation), sceneId: priorTurn.id} : null} : {}),
    ...(progress ? { progress } : {}),
    authorSource: source ? {text: source.text, digest: source.digest} : null,
    ...(shared.state ? { settlement: shared.state, settlementRead: v6 ? relatedDirectorRead(shared.reads, e.id, progress?.runResult?.runId ?? null) : shared.reads.filter(r => r.eventId === e.id).flatMap(r => r.lines).filter(line => actorIds.every(id => line.knownBy.includes(id))) } : {})};
}
