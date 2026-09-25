import { canonicalJson, sha256, type ExpeditionSlot } from "../../game-core/contracts";
import { projectSettlementActorState } from "../../game-core/session";
import { check } from "../airp-generation/contracts";
import { sameHead } from "../transaction";
import { compileLowFrame, lowHash } from "../airp-low/native";
import type { NodeJob, NodeSnapshot } from "./contracts";
import { nodeCurrentProgram, NODE_CURRENT_HANDOFF } from "./handoff";
import { effectiveSettlementMemories, effectiveThreads } from "../airp-memory/effective";

export const nodePosition = (s: Pick<ExpeditionSlot, "layer" | "roomIndex" | "timing">) => s.layer * 10000 + s.roomIndex * 10 + (s.timing === "arrive" ? 0 : s.timing === "cleared" ? 1 : 2);
export const nodeJobId = (planId: string, nodeId: string) => `scene:${lowHash([planId, nodeId])}`;
export function nodeGate(s: NodeSnapshot, j: NodeJob): "ready" | "future" | "passed" | "terminal" | "blocked" {
  if (j.status !== "waiting") return "blocked";
  const slot = s.plan.frames.at(-1)!.context.rules.slots.find(slot => slot.id === j.node.slotId)!;
  if (s.program.terminal) return "terminal";
  if (s.program.position > nodePosition(slot)) return "passed";
  if (!s.program.slotIds.includes(slot.id)) return "future";
  if (j.node.actorIds.some(id => !s.program.actorIds.includes(id))) return "blocked";
  if (j.node.prerequisites.some(p => !s.ledger.jobs.some(prior => prior.planId === j.planId && prior.node.id === p.nodeId && prior.status === p.outcome))) return "blocked";
  if (s.ledger.jobs.some(job => job.status === "open") || s.settlement.jobs.some(job => job.status !== "applied")) return "blocked";
  const link = j.node.link;
  if (link?.kind === "new-event") {
    const event = s.plan.prepared!.events.find(e => e.key === link.eventKey)!;
    const status = s.program.events.find(e => e.id === event.id)?.status;
    if (["offer", "scene"].includes(link.step) ? status !== "offered" : status !== "accepted") return "blocked";
  }
  return "ready";
}
export function assertStartedNodePlan(s: NodeSnapshot) {
  const j = s.plan, frame = j.frames.at(-1)!, start = s.program.start;
  check(j.status === "started" && j.prepared && j.startFactId === start.factId && j.departureTicket && sameHead(j.departureTicket.expectedHead, start.beforeHead) && frame.context.rules.departure.commandHash === start.commandHash, "No matching CL-C started plan/proof");
  check(j.departureTicket.proposalHash === j.prepared.proposalHash && j.departureTicket.commandHash === start.commandHash && start.beforeHead.saveId === s.head.saveId && start.beforeHead.epoch === s.head.epoch && start.beforeHead.revision < s.worldHead.revision, "Foreign/stale departure identity");
  check(frame.departure.runId === s.program.runId && frame.departure.routeId === s.program.routeId, "Program run/route differs from plan");
}
export function compileNodeFrame(s: NodeSnapshot, j: NodeJob) {
  check(nodeGate(s, j) === "ready", "Node not actually reachable");
  const slot = s.plan.frames.at(-1)!.context.rules.slots.find(slot => slot.id === j.node.slotId)!;
  const names = Object.fromEntries(s.plan.frames.at(-1)!.documents.filter(d => d.kind === "character").map(d => [d.id, d.id]));
  // Presentation names are explicit material metadata, not guessed from a model response.
  for (const source of s.material.sources) if (source.kind === "character") names[source.id] = source.id;
  const actorNames: Record<string, string> = { elora: "艾洛拉", eustice: "尤斯缇丝", norma: "诺玛", kororo: "柯萝萝" };
  const actors = Object.fromEntries(j.node.actorIds.filter(id => id !== "kael").map(id => [id, actorNames[id] ?? names[id] ?? id]));
  const observers = ["kael", ...Object.keys(actors)], shared = (knownBy: string[]) => observers.every(id => knownBy.includes(id));
  const facts = s.program.sources.filter(source => shared(source.knownBy));
  check(facts.length, "No shared actual source for current scene");
  const previous = s.ledger.jobs.filter(prior => prior.planId === j.planId && prior.frame && prior.reads.length && observers.every(id => ["kael", ...Object.keys(prior.frame!.scene.actors)].includes(id))).map(prior => ({ sceneId: prior.id,
    lines: prior.text!.lines.slice(0, prior.reads.length).map((line, i) => ({ ...line, sourceId: `read:${prior.id}:${i}`, readHead: prior.reads[i], knownBy: line.speaker === "narrator" ? ["kael"] : ["kael", ...Object.keys(prior.frame!.scene.actors)] })), selected: prior.selected ? { text: prior.selected.text, head: prior.selected.head, knownBy: ["kael"] } : null }));
  const memories = (s.memoryView ? effectiveSettlementMemories(s.settlement.memories, s.memoryView) : s.settlement.memories).map(m => ({ id: m.id, scope: m.scope, points: m.points.filter(p => shared(p.knownBy)) })).filter(m => m.points.length);
  const openThreads = s.memoryView ? effectiveThreads(s.memoryView) : s.settlement.openThreads;
  // GM already received these actually-read originals. Its intent is not a
  // substitute for them at the writing stage. Keep attribution: a private
  // conversation is context for the author, not automatically shared knowledge.
  const beforeDepartureRead = s.plan.frames.at(-1)!.context.sources.filter(source => source.kind === "read")
    .map(({ id, text, phase, knownBy }) => ({ sourceId: id, text, phase, knownBy }));
  const scene = { location: j.node.slotId, intent: j.node.intent, stop: j.node.stop, allowedProgramActions: slot.actionIds,
    facts, actualActors: s.settlement.state.actors.filter(a => Object.hasOwn(actors, a.actorId)).map(a => ({ ...projectSettlementActorState(a, s.program.phase), locationId: s.program.routeId })), memories, openThreads: openThreads.filter(t => shared(t.knownBy)),
    event: j.node.link?.kind === "commission" ? { eventId: j.node.link.eventId, stepId: j.node.link.stepId, returnStillRequired: true } : null };
  return compileLowFrame(s.material, { id: j.id, actors, player: { id: "kael", name: s.plan.frames.at(-1)!.context.playerName }, scenario: canonicalJson({ scene }),
    userInput: canonicalJson({ beforeDepartureRead, previousRead: previous }),
    currentTurn: `${NODE_CURRENT_HANDOFF}\n${canonicalJson({ currentProgram: nodeCurrentProgram(s, j, slot), intent: j.node.intent })}` }, true, 5);
}
export function nodeWriting(j: NodeJob) { return j.attempts.find(a => a.stage === "writing" && (a.status === "succeeded" || a.id === j.writingRevalidation?.attemptId))?.output ?? ""; }
export function nodeAction(s: NodeSnapshot, j: NodeJob) {
  if (!j.selected) return null;
  // GM predicts a direction, it cannot prohibit an engine-legal alternative.
  return s.program.actions.find(a => a.slotId === j.node.slotId && a.head.revision > j.selected!.head.revision) ?? null;
}
export function nodeBoundaryReady(s: NodeSnapshot, j: NodeJob) {
  return !!(j.status === "open" && j.text && j.reads.length === j.text.lines.length && j.selected && (s.program.terminal || j.node.stop === "scene-end" || !j.node.actionIds.length || nodeAction(s, j)));
}
export const nodeTextDigest = (text: string) => sha256(text);
