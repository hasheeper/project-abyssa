import { canonicalJson, sha256, type SettlementEvidence, type SettlementGrant, type SettlementInput, type SettlementScope } from "../../game-core/contracts";
import { airpPhaseIndex } from "../../game-core/session";
import type { D5Fact, D5GameRecord } from "../versions/d5-contracts";
import { sameHead } from "../transaction";
import type { DirectorJob } from "../airp-director/contracts";
import { SettlementRuntimeError, type SettlementLedger, type SettlementMaterials } from "./contracts";
import { cloneSettlement, createSettlementFrame } from "./context";
import { recordMemoryContext } from "../airp-memory/d5";

const deny = (message: string): never => { throw new SettlementRuntimeError("invalid-state", message); };
const phase = (f: D5Fact) => airpPhaseIndex(f.worldTime.day, f.worldTime.phase);
/**
 * Read-only adapter for records returned by a VALIDATED D5 application.open/replay.
 * It never installs CL-B in content19 or promotes arbitrary serialized records to trusted evidence.
 */
export function projectD5SettlementBoundary(options: {
  record: D5GameRecord; ledger: SettlementLedger;
  boundary: { kind: "action" | "event" | "run"; factId: string; eventId: string | null };
  grants: SettlementGrant[];
  cards: SettlementMaterials["cards"]; world?: SettlementMaterials["world"];
}): { input: SettlementInput; materials: SettlementMaterials } {
  const { record, ledger, boundary } = options, director = record.airpDirector;
  if (!sameHead(record.head, ledger.state.head)) deny("Capture settlement at the committed gameplay head, not a stale record");
  const effective = record.facts.filter(f => !record.retractedFactIds.includes(f.id) && f.origin !== "memory" && f.source.saveId === record.head.saveId && f.source.epoch === record.head.epoch && f.source.revision <= record.head.revision
    && record.commits.some(c => sameHead(c.ref, f.source) && c.factIds.includes(f.id)));
  const fact = effective.find(f => f.id === boundary.factId) ?? deny("Boundary is not an effective committed fact");
  const event = boundary.eventId === null ? null : director?.events.find(e => e.id === boundary.eventId) ?? deny("Unknown event identity");
  let actionId: string | null = null, runId: string | null = null, currentScene: DirectorJob | null = null;
  if (boundary.kind === "run") {
    if (fact.kind !== "progression" || fact.payload.type !== "expedition-settled" || fact.origin !== "adventure") return deny("Run settlement needs the actual adventure terminal fact");
    runId = fact.payload.finalRun.run.id;
    if (event && !event.evidenceIds.includes(fact.id)) deny("Run terminal is not linked to this event");
  } else {
    if (!event || fact.kind !== "airp-director") return deny("Event/action settlement needs its committed Director fact");
    const command = fact.payload.command;
    if (command.type === "airp-director-read") {
      currentScene = director!.jobs.find(j => j.id === command.jobId && j.scene?.eventId === event.id) ?? deny("Read belongs to another event");
      if (!currentScene.text || !currentScene.scene || command.cursor !== currentScene.text.lines.length - 1 || !event.readSceneIds.includes(currentScene.id)) deny("Boundary requires the complete read scene; unread tails are not admitted");
      if (boundary.kind === "event") {
        const declined = (currentScene.lowContextVersion ?? 0) >= 11 && currentScene.scene!.role === "declined" && currentScene.lowPhase?.complete && event.status === "closed" && event.closeReason === "declined";
        if (!declined && (!["result", "followup"].includes(currentScene.scene!.role) || event.status !== "resolved")) deny("A feedback scene/run end is not event closure");
      } else {
        if (currentScene.scene!.role !== "feedback") deny("Only actual action feedback is an action read boundary");
        actionId = `action:${sha256(canonicalJson([event.id, currentScene.scene!.actionIndex, currentScene.scene!.occurrence]))}`;
      }
    } else if (command.type === "airp-director-choose" && boundary.kind === "action") {
      if (command.eventId !== event.id || !event.selected.some(s => s.sourceId === fact.id && s.id === command.choiceId)) deny("Choice is not the player's actual selected branch");
      actionId = `choice:${fact.id}`;
    } else if (command.type === "airp-director-decline" && boundary.kind === "event") {
      if (command.eventId !== event.id || event.status !== "closed" || event.closeReason !== "declined") deny("Event was not actually declined");
    } else return deny("This command is not a settlement checkpoint");
    // A scene's historical run evidence remains history. Closure does not pretend the run is active.
    runId = fact.runRef?.kind === "expedition" ? fact.runRef.id : null;
  }
  const scope: SettlementScope = { kind: boundary.kind, boundaryId: fact.id, eventId: event?.id ?? null, actionId, runId };
  const evidence: SettlementEvidence[] = [], text: SettlementMaterials["evidence"] = [];
  const add = (source: SettlementEvidence, value: string) => { evidence.push(source); text.push({ sourceId: source.id, text: value, digest: sha256(value) }); };
  const base = (source: D5Fact, current: boolean, knownBy: string[]) => ({
    id: source.id, head: source.source, phase: phase(source), eventId: scope.eventId,
    actionId: current ? scope.actionId : null, runId: current ? scope.runId : source.runRef?.kind === "expedition" ? source.runRef.id : null,
    role: current ? "current" as const : "history" as const, knownBy,
  });
  // Structured boundary description contains no RNG, future rooms, hidden loot or model planning.
  function programText(source: D5Fact): { text: string; knownBy: string[] } | null {
    if (source.kind === "progression" && source.payload.type === "expedition-settled") {
      const p = source.payload;
      return { text: canonicalJson({ kind: "run-ended", runId: p.finalRun.run.id, routeId: p.terminal.routeId,
        outcome: p.terminal.outcome, deepestLayer: p.terminal.deepestLayer, partyIds: p.terminal.partyIds, eventClosed: false }), knownBy: [...new Set(["kael", ...p.finalRun.run.party.map(a => a.id)])].filter(id => ledger.policy.observerIds.includes(id)) };
    }
    if (source.kind !== "airp-director") return null;
    const cmd = source.payload.command;
    if (cmd.type === "airp-director-respond") {
      const job = director!.jobs.find(j => j.id === cmd.jobId && j.scene?.eventId === event?.id && j.lowResponse?.sourceId === source.id);
      const attitude = job && director!.memories.find(m => m.id === `attitude:${source.id}`);
      return attitude ? { text: attitude.text, knownBy: attitude.knownBy } : null;
    }
    if (cmd.type === "airp-director-deliver" && cmd.eventId === event?.id && event.delivery?.confirmedFactId === source.id) return { text: canonicalJson({ kind: "task-objective-delivered", eventId: event.id, runId: event.delivery.runId, returnFactId: event.delivery.returnFactId, ordinaryLootUnchanged: true }), knownBy: ["kael", event.card.giverId] };
    if ((cmd.type === "airp-director-choose" || cmd.type === "airp-director-decline") && cmd.eventId === event?.id) {
      const decision = director!.memories.find(m => m.id === `decision:${source.id}` && m.evidenceIds.includes(source.id));
      const action = director!.memories.find(m => m.id === `action:${source.id}` && m.evidenceIds.includes(source.id));
      return decision ? { text: action ? `${decision.text}\n${action.text}` : decision.text,
        knownBy: action ? decision.knownBy.filter(id => action.knownBy.includes(id)) : decision.knownBy } : null;
    }
    if (source.id === fact.id && currentScene?.scene) {
      return { text: canonicalJson({ kind: boundary.kind === "event" ? "event-closed" : "action-feedback-read", eventId: event!.id, sceneId: currentScene.id,
        role: currentScene.scene.role, eventStatus: event!.status, note: boundary.kind === "event" ? "已读结果并依法收尾，不附加资产。" : "本步骤反馈已读，不自动结案。",
        ...([22, 24, 26, 28].includes(record.contentRef.contentVersion) ? { delivery: event!.delivery ?? null, actualLoot: (record.snapshot.campaign.loot ?? []).map(item => ({ instanceId: item.instanceId, resultId: item.resultId })), lootAuthority: "already-owned-by-program; no additional narrative award" } : {}) }), knownBy: ["kael", ...currentScene.scene.actorIds] };
    }
    return null;
  }
  const relevantRuns = new Set([...(runId ? [runId] : []), ...(event?.delivery ? [event.delivery.runId] : []), ...ledger.openThreads.flatMap(t => t.scope.runId ? [t.scope.runId] : [])]);
  const endedRuns = effective.filter(f => f.source.revision <= fact.source.revision && f.kind === "progression" && f.payload.type === "expedition-settled" && relevantRuns.has(f.payload.terminal.runId));
  const selectedSources = effective.filter(f => f.source.revision <= fact.source.revision && (f.id === fact.id || event?.selected.some(s => s.sourceId === f.id) || director?.jobs.some(j => j.scene?.eventId === event?.id && j.lowResponse?.sourceId === f.id) || event?.delivery?.confirmedFactId === f.id || endedRuns.includes(f)));
  for (const source of selectedSources) {
    const p = programText(source);
    if (p) add({ ...base(source, source.id === fact.id, p.knownBy), kind: "program-fact", factId: source.id, authority: "fact", speakerId: null }, p.text);
  }
  if (!evidence.some(e => e.id === fact.id)) deny("No program fact describes this boundary");
  // Use actual read commands, not generated text, cursors alone, or creationRecord/ICOT.
  for (const read of effective) {
    if (read.source.revision > fact.source.revision || read.kind !== "airp-director" || read.payload.command.type !== "airp-director-read") continue;
    const cmd = read.payload.command, job = director?.jobs.find(j => j.id === cmd.jobId && j.scene?.eventId === scope.eventId);
    const line = job?.text?.lines[cmd.cursor];
    if (!job?.scene || !line) continue;
    const current = job.id === currentScene?.id;
    const spoken = ledger.policy.observerIds.includes(line.speaker);
    const knownBy = spoken ? ["kael", ...job.scene.actorIds] : ["kael"];
    add({ ...base(read, current, [...new Set(knownBy)]), id: `read:${read.id}`, kind: "read-paragraph", authority: spoken ? "claim" : "fact", speakerId: spoken ? line.speaker : null,
      archive: { sceneId: job.id, paragraphId: `line:${cmd.cursor}`, digest: sha256(line.text) }, readAtRevision: read.source.revision }, line.text);
  }
  // Returned expedition prose is history for home accounting, not just its summary.
  // Take the admitted current originals from already-applied node frames; preserve
  // exact text, claim attribution and audience, including player-only narration.
  const seen = new Set(evidence.map(e => e.id));
  for (const prior of ledger.jobs) {
    const frame = prior.frames.at(-1);
    if (prior.status !== "applied" || !frame?.input.scope.runId || !relevantRuns.has(frame.input.scope.runId)) continue;
    for (const source of frame.input.evidence) {
      if (source.kind !== "read-paragraph" || source.role !== "current" || source.readAtRevision > fact.source.revision || seen.has(source.id)) continue;
      const original = frame.materials.evidence.find(s => s.sourceId === source.id) ?? deny("Applied node lost its original read text");
      add({ ...cloneSettlement(source), role: "history" }, original.text); seen.add(source.id);
    }
  }
  const actorLocks: SettlementInput["actorLocks"] = [];
  if (record.snapshot.run?.kind === "expedition") {
    for (const member of record.snapshot.run.state.run.party.filter(member => ledger.policy.actorIds.includes(member.id))) actorLocks.push({ actorId: member.id, fields: ["location", "activity"] });
  }
  const input: SettlementInput = { state: cloneSettlement(ledger.state), policy: cloneSettlement(ledger.policy), scope, evidence, grants: cloneSettlement(options.grants),
    fullActorCards: options.cards.map(c => ({ actorId: c.actorId, digest: c.digest })), openThreads: cloneSettlement(ledger.openThreads), priorReceipts: cloneSettlement(ledger.receipts), actorLocks,
    lifecycle: [
      ...endedRuns.flatMap(f => f.kind === "progression" && f.payload.type === "expedition-settled" ? [{ kind: "run" as const, id: f.payload.terminal.runId, basisIds: [f.id] }] : []),
      ...(event && boundary.kind === "event" ? [{ kind: "event" as const, id: event.id, basisIds: [fact.id] }] : []),
    ] };
  const materials: SettlementMaterials = { cards: cloneSettlement(options.cards), evidence: text, world: cloneSettlement(options.world ?? []),
    checkpoint: { kind: boundary.kind, trackedTasks: event ? [{ eventId: event.id, title: event.card.title, status: event.status }] : [] } };
  const memoryView = recordMemoryContext(record);
  if (memoryView) materials.memoryView = memoryView;
  createSettlementFrame(input, materials); // Reject unknown actors, missing complete cards and bad read refs now.
  return { input, materials };
}
