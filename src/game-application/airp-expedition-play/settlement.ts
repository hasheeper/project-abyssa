import type { SettlementEvidence, SettlementInput } from "../../game-core/contracts";
import { check } from "../airp-generation/contracts";
import type { SettlementMaterials } from "../airp-settlement/contracts";
import { cloneLow, lowHash } from "../airp-low/native";
import type { NodeJob, NodeSnapshot } from "./contracts";
import { nodeAction, nodeBoundaryReady, nodeTextDigest } from "./context";

/** Complete read originals + real action provenance. Choices not selected and Plan never enter evidence. */
export function nodeSettlement(s: NodeSnapshot, j: NodeJob): { input: SettlementInput; materials: SettlementMaterials } {
  check(nodeBoundaryReady(s, j), "Node still awaits reading/response/real action");
  const link = j.node.link;
  const scope = { kind: "action" as const, boundaryId: j.id, eventId: link?.kind === "commission" ? link.eventId : link?.kind === "new-event" ? s.plan.prepared!.events.find(e => e.key === link.eventKey)!.id : null, actionId: j.node.id, runId: s.program.runId };
  const knownBy = ["kael", ...Object.keys(j.frame!.scene.actors)], evidence: SettlementEvidence[] = [], materials: SettlementMaterials = { cards: [], evidence: [], world: [] };
  const add = (e: SettlementEvidence, text: string) => { evidence.push(e); materials.evidence.push({ sourceId: e.id, text, digest: nodeTextDigest(text) }); };
  const common = { eventId: scope.eventId, actionId: scope.actionId, runId: scope.runId, role: "current" as const, phase: s.program.phase };
  // Current program truth is explicit, not inferred from the dialogue. Old trigger
  // state remains history when an action has changed it in the meantime.
  const currentIds = new Set(s.program.sources.map(source => source.id));
  for (const source of [...j.triggerSources.filter(source => !currentIds.has(source.id)), ...s.program.sources]) {
    add({ ...common, id: `program:${source.id}`, kind: "program-fact", factId: source.id, head: source.head, phase: source.phase, role: currentIds.has(source.id) ? "current" : "history", authority: "fact", speakerId: null, knownBy: source.knownBy }, source.text);
  }
  for (const [i, line] of j.text!.lines.entries()) {
    const text = `${line.speaker}：${line.text}`, id = `read:${j.id}:${i}`;
    add({ ...common, id, head: j.reads[i], kind: "read-paragraph", readAtRevision: j.reads[i].revision, archive: { sceneId: j.id, paragraphId: `paragraph:${i}`, digest: nodeTextDigest(text) }, authority: line.speaker === "narrator" ? "fact" : "claim", speakerId: line.speaker === "narrator" ? null : line.speaker, knownBy: line.speaker === "narrator" ? ["kael"] : knownBy }, text);
  }
  const selectedId = `choice:${j.id}`;
  add({ ...common, id: selectedId, kind: "program-fact", factId: selectedId, head: j.selected!.head, authority: "fact", speakerId: null, knownBy: ["kael"] }, `玩家实际选择的态度：${j.selected!.text}。这是态度输入，不代表执行玩法动作、交付或获取物品。`);
  const action = nodeAction(s, j);
  if (action) add({ ...common, id: action.id, kind: "program-fact", factId: action.id, head: action.head, authority: "fact", speakerId: null, knownBy: action.knownBy }, action.text);
  materials.checkpoint = { kind: action ? "action" : "scene", trackedTasks: s.plan.frames.at(-1)!.context.rules.commissions.map(c => ({ eventId: c.eventId, title: c.title, status: "program-tracked; return and explicit delivery still required" })) };
  if (s.memoryView) materials.memoryView = s.memoryView;
  for (const source of j.frame!.sources.filter(source => source.kind === "character")) materials.cards.push({ actorId: source.id, text: source.text, digest: source.sha256 });
  materials.world = j.frame!.sources.filter(source => source.kind === "world" || source.kind === "player").map(source => ({ id: source.id, text: source.text, digest: source.sha256, triggerIds: [evidence[0].id] }));
  const input: SettlementInput = { state: s.settlement.state, policy: s.settlement.policy, scope, evidence, grants: s.grants[j.node.id] ?? [], fullActorCards: materials.cards.map(c => ({ actorId: c.actorId, digest: c.digest })), openThreads: s.settlement.openThreads, priorReceipts: s.settlement.receipts,
    actorLocks: Object.keys(j.frame!.scene.actors).map(actorId => ({ actorId, fields: ["location"] })),
    lifecycle: s.program.terminal ? [{ kind: "run", id: s.program.runId, basisIds: s.program.sources.map(source => `program:${source.id}`) }] : [] };
  check(!input.grants.some(g => g.kind === "item"), "CL-D asset integration deferred; item grants need the final asset adapter");
  check(lowHash(input.state) === lowHash(s.settlement.state), "Settlement state changed"); return cloneLow({ input, materials });
}
