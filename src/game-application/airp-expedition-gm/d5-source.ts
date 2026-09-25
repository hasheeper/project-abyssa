import { canonicalJson, demoRoom, emptyDirectorBudget, sha256, type ExpeditionItemTemplate, type ExpeditionPlanInput, type ValidatedD5Catalog } from "../../game-core/contracts";
import { airpPhaseIndex, createD5ExpeditionEngine, expeditionPlanHash, type D5Departure } from "../../game-core/session";
import type { D5GameRecord } from "../versions/d5-contracts";
import { registeredPatrol } from "../airp-director/commissions";
import { sameHead } from "../transaction";
import { validateSettlementSnapshot } from "../airp-settlement/service";
import type { SettlementLedger } from "../airp-settlement/contracts";
import { currentSettlementActors } from "../airp-settlement/actor-context";
import { cloneExpedition, freezeExpeditionFrame } from "./context";
import { ExpeditionGMError, type ExpeditionContext, type ExpeditionDocument, type ExpeditionSource } from "./contracts";
import { projectGMContext, selectGMDocuments } from "../airp-director/gm-context";
import { recordMemoryContext } from "../airp-memory/d5";
import { effectiveSettlementMemories, effectiveThreads } from "../airp-memory/effective";
import { expeditionAppraisalSlots } from "../../game-core/session";

/** Only accepts records already returned by the version-specific application reader/replay. */
export function projectD5ExpeditionPreparation(options: {
  catalog: ValidatedD5Catalog; record: D5GameRecord; departure: D5Departure; intent: string;
  settlement: SettlementLedger; documents: ExpeditionDocument[];
  fixedEvents?: ExpeditionPlanInput["fixedEvents"]; itemTemplates?: ExpeditionItemTemplate[];
  limits?: ExpeditionPlanInput["limits"];
  /** Readback must still work when later gameplay invalidates a prepared departure. */
  checkAvailability?: boolean;
  /** Explicit per-frame opt-in; old frozen preparations do not silently upgrade. */
  gmContextVersion?: 1;
  memoryVersion?: 19;
  commissionRewardVersion?: 1;
  appraisalPlanVersion?: 1;
  /** S3 metadata corrections can be newer than the gameplay world head. */
  gmRecord?: D5GameRecord;
}): { context: ExpeditionContext; documents: ExpeditionDocument[]; departure: D5Departure } {
  const { record: r, catalog, departure: d, settlement } = options, c = r.snapshot.campaign, director = r.airpDirector;
  const gmRecord = options.memoryVersion === 19 ? options.gmRecord ?? r : r;
  const memoryView = options.memoryVersion === 19 ? recordMemoryContext(gmRecord) : undefined;
  const memories = memoryView ? effectiveSettlementMemories(settlement.memories, memoryView) : settlement.memories;
  const openThreads = memoryView ? effectiveThreads(memoryView) : settlement.openThreads;
  const deny = (message: string): never => { throw new ExpeditionGMError("invalid", message); };
  if (expeditionPlanHash(r.contentRef) !== expeditionPlanHash(catalog.ref) || !sameHead(settlement.state.head, r.head)) deny("Wrong Catalog or stale settlement state");
  validateSettlementSnapshot({ head: r.head, worldHead: settlement.state.head, ledger: settlement, appliedItemOperations: [] });
  if (options.checkAvailability !== false && (r.snapshot.run || director?.reading && !director.reading.paused)) deny("Cannot prepare during active gameplay/reading");
  // Pure dry validation through the actual engine; does not start a run or mutate the campaign.
  if (options.checkAvailability !== false) createD5ExpeditionEngine(catalog).create(cloneExpedition(c), cloneExpedition(d));
  const phase = airpPhaseIndex(c.clock.day, c.clock.phase), day = c.clock.day;
  const effective = r.facts.filter(f => f.kind !== "airp-game" && f.source.saveId === r.head.saveId && f.source.epoch === r.head.epoch && f.source.revision <= r.head.revision && !r.retractedFactIds.includes(f.id) && r.commits.some(commit => sameHead(commit.ref, f.source) && commit.factIds.includes(f.id)));
  if (!effective.length) deny("Missing committed program evidence");
  const sources: ExpeditionSource[] = [];
  const add = (id: string, kind: ExpeditionSource["kind"], text: string, sourcePhase: number, knownBy: string[], evidenceIds: string[]) => {
    if (!sources.some(s => s.id === id)) sources.push({ id, kind, text, phase: sourcePhase, knownBy: [...new Set(knownBy)], evidenceIds, digest: sha256(text) });
  };
  const allTasks = director?.events.filter(e => !["cancelled", "reserve", "planned"].includes(e.status)) ?? [];
  const tasks = allTasks.map(e => ({ id: e.id, status: e.status, stepId: e.card.actions[e.actionIndex]?.id ?? null, selected: e.selected.map(s => ({ id: s.id, intent: s.intent, sourceId: s.sourceId })), evidenceIds: e.evidenceIds.filter(id => effective.some(f => f.id === id)) }));
  add(`snapshot:${expeditionPlanHash(r.head)}`, "program", canonicalJson({ kind: "current-program-state", clock: c.clock, playerName: c.playerName ?? "凯尔", availableActorIds: c.availableCharacterIds, tasks, departure: { runId: d.runId, routeId: d.routeId, partyIds: d.partyIds, itemIds: d.itemIds, intent: options.intent, status: "confirmed-not-started" } }), phase, ["kael"], [effective.at(-1)!.id]);
  for (const f of effective) if (f.kind === "progression" && f.payload.type === "expedition-settled" && f.payload.terminal.routeId === d.routeId) add(f.id, "program", canonicalJson({ kind: "past-run-result", runId: f.payload.terminal.runId, routeId: d.routeId, outcome: f.payload.terminal.outcome, deepestLayer: f.payload.terminal.deepestLayer }), airpPhaseIndex(f.worldTime.day, f.worldTime.phase), ["kael"], [f.id]);
  const eligible = allTasks.filter(e => registeredPatrol(e) && !e.binding);
  const related = eligible.filter(e => { const a = e.card.actions[e.actionIndex]; return a.kind === "patrol" && catalog.data.airpDirector?.capabilities.objectives[a.objectiveId]?.routeId === d.routeId; });
  // Catalog objectives are conditional capabilities, not public discoveries. The
  // old reducer binds them only after this action was actually chosen. Exposing
  // every route objective would turn an unaccepted commission into exploration.
  const activeObjectiveIds = new Set(related.flatMap(e => { const a = e.card.actions[e.actionIndex]; return a.kind === "patrol" ? [a.objectiveId] : []; }));
  const requiredActorIds = [...new Set([...d.partyIds.filter(id => id !== "kael"), ...related.flatMap(e => e.card.actorIds)])];
  for (const m of director?.memories ?? []) if (m.phase <= phase && m.evidenceIds.length && m.evidenceIds.every(id => effective.some(f => f.id === id)) && (m.knownBy.some(id => requiredActorIds.includes(id)) || related.some(e => e.evidenceIds.some(id => m.evidenceIds.includes(id))))) add(m.id, "program", m.text, m.phase, m.knownBy, m.evidenceIds);
  for (const f of effective) {
    if (f.kind !== "airp-director" || f.payload.command.type !== "airp-director-read") continue;
    const command = f.payload.command, job = director?.jobs.find(j => j.id === command.jobId), line = job?.text?.lines[command.cursor];
    if (!job?.scene || !line || !job.scene.actorIds.some(id => requiredActorIds.includes(id))) continue;
    add(`read:${f.id}`, "read", `${line.speaker}：${line.text}`, airpPhaseIndex(f.worldTime.day, f.worldTime.phase), ["kael", ...job.scene.actorIds], [f.id]);
  }
  for (const m of memories) add(m.id, "settlement", canonicalJson(m), m.phase, ["gm"], m.sources.map(s => s.id));
  for (const j of settlement.jobs.filter(j => j.mode === "program-only" && j.status === "applied")) add(`assessment:${j.id}`, "settlement", canonicalJson({ taskId: j.id, assessment: "program-only", narrativeVariables: "not-assessed", originalTextRetained: true }), j.frames.at(-1)!.input.state.phase, ["gm"], [j.id]);
  add(`assets:${expeditionPlanHash(r.head)}`, "program", canonicalJson({ kind: "actual-program-assets", authority: "program; no narrative extra award", owned: (c.loot ?? []).map(item => ({ instanceId: item.instanceId, resultId: item.resultId })), trades: (c.lootTrades ?? []).map(t => ({ id: t.id, kind: t.kind, instanceId: t.item.instanceId, resultId: t.item.resultId, gold: t.gold })) }), phase, ["kael"], [effective.at(-1)!.id]);
  const slots: ExpeditionPlanInput["slots"] = [];
  for (const [l, rooms] of catalog.data.routes[d.routeId].layers.entries()) for (let roomIndex = 0; roomIndex < rooms.length; roomIndex++) {
    const room = demoRoom(catalog.data, d.routeId, l + 1, roomIndex);
    const timings = room.kind === "exit" ? ["exit" as const] : ["arrive" as const, "cleared" as const];
    for (const timing of timings) slots.push({ id: `slot:${l + 1}:${roomIndex}:${timing}`, layer: l + 1, roomIndex, roomDefinitionId: room.id, timing, actorIds: [...d.partyIds],
      actionIds: room.kind === "exit" ? ["leave", ...(room.canContinue ? ["continue"] : [])] : timing === "arrive" && room.kind === "event" ? ["event-enter", "event-leave"] : ["continue"],
      objectiveIds: Object.entries(catalog.data.airpDirector?.capabilities.objectives ?? {}).filter(([id, o]) => activeObjectiveIds.has(id) && o.routeId === d.routeId && o.layer === l + 1 && o.roomIndex === roomIndex && o.roomDefinitionId === room.id && timing === "cleared").map(([id]) => id) });
  }
  const commissions: ExpeditionPlanInput["commissions"] = related.map(e => {
    const a = e.card.actions[e.actionIndex]; if (a.kind !== "patrol") return deny("Invalid patrol action");
    const sourceId = `task:${e.id}`;
    add(sourceId, "program", canonicalJson({ eventId: e.id, status: e.status, stepId: a.id, objectiveId: a.objectiveId, originalCard: e.card, selected: e.selected, returnRequired: true }), phase, ["gm"], e.evidenceIds.filter(id => effective.some(f => f.id === id)));
    const author = catalog.data.airpDirector!.authorSources.find(s => s.id === catalog.data.airpDirector!.fixed.find(f => f.card.id === e.card.id)?.sourceId);
    if (author) add(`author:${author.id}`, "author", canonicalJson(author.body), phase, ["gm"], [sourceId]);
    const slot = slots.find(s => s.objectiveIds.includes(a.objectiveId)) ?? deny("Author objective is outside the executable route");
    return { ...(options.commissionRewardVersion ? {itemTemplateId: `commission-object:${expeditionPlanHash([e.id, a.id])}`} : {}), eventId: e.id, stepId: a.id, definitionId: e.card.id, title: e.card.title, objectiveId: a.objectiveId, slotId: slot.id, actorIds: e.card.actorIds, basisIds: [sourceId], returnRequired: true };
  });
  for (const doc of options.documents.filter(d => d.kind === "author")) add(doc.id, "author", doc.text, phase, ["gm"], [sources[0].id]);
  const active = director?.events.filter(e => ["offered", "accepted", "waiting-action", "feedback", "ready"].includes(e.status)) ?? [];
  const rules: ExpeditionPlanInput = {
    ...(options.appraisalPlanVersion ? {appraisalPlanVersion: 1 as const, appraisalSlots: expeditionAppraisalSlots(catalog, d)} : {}),
    ...(options.commissionRewardVersion ? {commissionRewardVersion: 1 as const} : {}),
    protocol: 1, head: r.head, phase, departure: { runId: d.runId, routeId: d.routeId, partyIds: [...d.partyIds], itemIds: [...d.itemIds], commandHash: expeditionPlanHash(d), intent: options.intent }, capabilityId: `d5:${catalog.ref.digest}`,
    slots, commissions, sourceIds: sources.map(s => s.id),
    schedule: { budget: cloneExpedition(director?.budgets.find(b => b.day === day) ?? emptyDirectorBudget(day)),
      reservations: (director?.events.filter(e => e.status === "planned" && Math.floor(e.fromPhase / 4) + 1 === day) ?? []).map(e => ({ id: e.id, ownerId: "day-director", day, load: e.card.load, themeKey: e.card.themeKey, themeDescription: e.card.themeDescription, objectIds: e.card.objectIds })),
      themes: (director?.events.filter(e => e.status === "planned" || active.some(a => a.id === e.id) || e.endedPhase !== null) ?? []).map(e => ({ key: e.card.themeKey, description: e.card.themeDescription, objectIds: e.card.objectIds, sourceId: e.id, untilPhase: e.endedPhase === null ? null : e.endedPhase + 256 })),
      existing: active.map(e => ({ id: e.id, load: e.card.load, status: e.status === "offered" ? "offered" : e.status === "ready" ? "ready" : "accepted" })), requiredStoryIds: c.activeStoryId ? [c.activeStoryId] : [], busyFocus: !!c.activeRunRef,
      uniqueCompletedIds: (director?.events.filter(e => e.status === "resolved" && e.card.repeat === "once") ?? []).flatMap(e => [e.card.id, ...e.card.actions.flatMap(a => a.kind === "patrol" ? [a.objectiveId] : [])]) },
    fixedEvents: cloneExpedition(options.fixedEvents ?? []), itemTemplates: options.commissionRewardVersion ? commissions.map(c => {
      const source = catalog.data.airpDirector!.authorSources.find(s => s.id === catalog.data.airpDirector!.fixed.find(f => f.card.id === c.definitionId)?.sourceId);
      const label = (source?.body as {card?: {objective?: {itemLabel?: string}}})?.card?.objective?.itemLabel;
      if (!label) return deny("Commission lacks an authored quest object");
      const template = {id: c.itemTemplateId!, maxPerRun: 1, fields: [
        {key: "label", label: "委托物品原名", maxLength: 80, values: [label]},
        {key: "description", label: "物品外观与取得方式，必须符合任务原文", maxLength: 400, values: null},
        {key: "awardWhen", label: "程序奖励条件：room-cleared 为目标战斗胜利，layer-banked 为目标层完成；无需阅读对白领取", maxLength: 40, values: ["room-cleared", "layer-banked"]},
      ]};
      return {...template, digest: expeditionPlanHash(template)};
    }) : cloneExpedition(options.itemTemplates ?? []), limits: options.limits ?? { nodes: 4, events: 1, definitions: 0 },
  };
  const context: ExpeditionContext = { rules, playerName: c.playerName ?? "凯尔", requiredActorIds, actors: currentSettlementActors(settlement.state.actors, phase, r.facts.filter(f => !r.retractedFactIds.includes(f.id))), affinity: cloneExpedition(settlement.state.affinity), tasks, sources, memories: cloneExpedition(memories), openThreads: cloneExpedition(openThreads), receipts: cloneExpedition(settlement.receipts), pendingSettlementIds: settlement.jobs.filter(j => j.status !== "applied").map(j => j.id) };
  let documents = options.documents;
  if (options.gmContextVersion === 1) {
    if (!director || !r.airpGame) deny("GM global input requires the same owning game state");
    const global = projectGMContext(catalog, options.memoryVersion === 19 ? director! : {...director!, lowContextVersion: 18}, {head: gmRecord.head, before: c, after: c, run: null, facts: gmRecord.facts, group: [], retracted: gmRecord.retractedFactIds});
    const full = selectGMDocuments(r.airpGame!.material.sources, global, options.intent);
    context.gmContext = global;
    documents = full.map(s => ({id: s.id, kind: s.kind as "world" | "player" | "character", text: s.text, digest: s.sha256, triggerIds: [d.routeId]}));
    documents.push(...options.documents.filter(d => d.kind === "author"));
    if (options.appraisalPlanVersion === 1) {
      const appraiser = options.documents.find(d => d.kind === "character" && d.id === "tibby");
      if (appraiser && !documents.some(d => d.id === appraiser.id)) {
        documents.push(appraiser);
        global.documents.push({id: appraiser.id, sha256: appraiser.digest});
      }
    }
  }
  freezeExpeditionFrame(context, documents, d);
  return cloneExpedition({ context, documents, departure: d });
}

/** Actual program provenance, not a user-supplied plan-start flag. */
export function projectD5DepartureProofs(record: D5GameRecord) {
  return record.facts.flatMap(f => {
    if (f.kind !== "journey" || f.payload.operation.type !== "start" || record.retractedFactIds.includes(f.id) || f.source.saveId !== record.head.saveId || f.source.epoch !== record.head.epoch || !record.commits.some(c => sameHead(c.ref, f.source) && c.factIds.includes(f.id))) return [];
    const beforeHead = record.commits.find(c => sameHead(c.ref, f.source) && c.factIds.includes(f.id))?.previous;
    const {commissionRewards: _rewards, ...playerDeparture} = f.payload.operation.input;
    return beforeHead ? [{ runId: f.payload.operation.input.runId, commandHash: expeditionPlanHash(playerDeparture), factId: f.id, beforeHead }] : [];
  });
}
