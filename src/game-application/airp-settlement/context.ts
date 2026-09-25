import * as v from "../../game-core/contracts";
import { prepareAirpSettlement, settlementTaskIdentity } from "../../game-core/session";
import type { Message } from "../airp-generation/contracts";
import { SETTLEMENT_CAPACITY, type SettlementFrame, type SettlementMaterials, type SettlementModelRequest } from "./contracts";
import { SETTLEMENT_INSTRUCTION, LEGACY_SETTLEMENT_OUTPUT_SCHEMA, settlementOutputSchema, SETTLEMENT_PROMPT_VERSION } from "./prompt";
import { effectiveThreads } from "../airp-memory/effective";
import { SETTLEMENT_MEMORY_INSTRUCTION } from "../airp-memory/prompt";

export const settlementHash = (value: unknown) => v.sha256(v.canonicalJson(value));
export const cloneSettlement = <T>(value: T): T => JSON.parse(v.canonicalJson(value)) as T;
export function emptySettlementProposal(input: v.SettlementInput): v.SettlementProposal {
  return { protocol: 1, ...settlementTaskIdentity(input), affinity: [], items: [], actors: [], memory: { points: [], open: [], close: [], priorReceiptIds: [] } };
}
export function validateSettlementMaterials(input: v.SettlementInput, materials: SettlementMaterials): void {
  v.assertJson(materials);
  v.record(materials, "settlement.materials", ["cards", "evidence", "world"], ["checkpoint", "memoryView"]);
  if (materials.memoryView) {
    if (materials.memoryView.version !== 1) v.invalid("memoryView", "Unknown effective memory version");
    for (const t of materials.memoryView.targets) if (t.hash !== settlementHash(t.value)) v.invalid("memoryView", "Effective target hash changed");
  }
  if (materials.checkpoint) {
    const c = v.record(materials.checkpoint, "materials.checkpoint", ["kind", "trackedTasks"]);
    v.choice(c.kind, ["scene", "action", "event", "run"], "checkpoint.kind");
    for (const task of v.list(c.trackedTasks, "checkpoint.trackedTasks", 96)) {
      const t = v.record(task, "checkpoint.task", ["eventId", "title", "status"]);
      v.id(t.eventId, "task.eventId"); v.text(t.title, "task.title", 1000); v.text(t.status, "task.status", 100);
    }
  }
  const unique = (ids: string[]) => { if (new Set(ids).size !== ids.length) v.invalid("materials", "Duplicate material identity"); };
  unique(materials.cards.map(c => c.actorId)); unique(materials.evidence.map(s => s.sourceId)); unique(materials.world.map(s => s.id));
  for (const card of materials.cards) {
    v.record(card, "materials.card", ["actorId", "text", "digest"]);
    const ref = input.fullActorCards.find(c => c.actorId === card.actorId);
    if (!ref || !card.text.trim() || v.sha256(card.text) !== ref.digest || card.digest !== ref.digest) v.invalid("materials.card", "Missing/changed complete actor card");
  }
  if (materials.cards.length !== input.fullActorCards.length) v.invalid("materials.cards", "All full actor cards must be loaded, not replaced with summaries");
  for (const item of materials.evidence) {
    v.record(item, "materials.evidence", ["sourceId", "text", "digest"]);
    const source = input.evidence.find(s => s.id === item.sourceId);
    if (!source || !item.text.trim() || item.digest !== v.sha256(item.text) || (source.kind === "read-paragraph" && item.digest !== source.archive.digest)) v.invalid("materials.evidence", "Missing/changed source text");
  }
  if (materials.evidence.length !== input.evidence.length) v.invalid("materials.evidence", "Every admitted source needs its exact text");
  for (const entry of materials.world) {
    v.record(entry, "materials.world", ["id", "text", "digest", "triggerIds"]);
    v.id(entry.id, "world.id"); v.ids(entry.triggerIds, "world.triggerIds");
    if (!entry.text.trim() || v.sha256(entry.text) !== entry.digest || !entry.triggerIds.length || entry.triggerIds.some(id => !input.evidence.some(s => s.id === id) && !input.fullActorCards.some(c => c.actorId === id))) v.invalid("world", "World entry must be intact and explicitly triggered");
  }
}
function messages(frame: SettlementFrame): Message[] {
  return [{ role: "system", content: frame.instruction }, { role: "user", content: v.canonicalJson({
    ...settlementTaskIdentity(frame.input), protocol: 1, input: frame.materials.memoryView ? {...frame.input, openThreads: effectiveThreads(frame.materials.memoryView)} : frame.input, materials: frame.materials,
    outputSchema: frame.outputSchema ?? LEGACY_SETTLEMENT_OUTPUT_SCHEMA,
  }) }];
}
export function createSettlementFrame(input: v.SettlementInput, materials: SettlementMaterials): SettlementFrame {
  // Exercise semantic CL-A validation before saving or sending anything, even for an empty response.
  prepareAirpSettlement(input, emptySettlementProposal(input), { head: input.state.head, receipts: input.priorReceipts, appliedItemOperations: [] });
  validateSettlementMaterials(input, materials);
  const frame = cloneSettlement({ input, materials, promptVersion: SETTLEMENT_PROMPT_VERSION, instruction: SETTLEMENT_INSTRUCTION, requestHash: "", outputSchema: settlementOutputSchema(materials.memoryView ? {...input, openThreads: effectiveThreads(materials.memoryView)} : input) });
  if (materials.memoryView) { frame.promptVersion = "cl-b-settlement-memory-19"; frame.instruction += `\n${SETTLEMENT_MEMORY_INSTRUCTION}`; }
  const request = messages(frame);
  if (v.utf8Size(JSON.stringify(request)) > SETTLEMENT_CAPACITY.inputBytes) v.invalid("settlement.context", "Context capacity exceeded; complete materials were NOT truncated");
  frame.requestHash = settlementHash(request);
  return frame;
}
export function compileSettlementRequest(frame: SettlementFrame, index: number): SettlementModelRequest {
  validateSettlementMaterials(frame.input, frame.materials);
  if (!["cl-b-settlement-1", "cl-b-settlement-2", "cl-b-settlement-3", "cl-b-settlement-4", "cl-b-settlement-5", "cl-b-settlement-6", "cl-b-settlement-7", SETTLEMENT_PROMPT_VERSION, "cl-b-settlement-memory-19"].includes(frame.promptVersion)) v.invalid("settlement.prompt", "Unsupported frozen prompt version");
  const compiled = messages(frame);
  if (settlementHash(compiled) !== frame.requestHash) v.invalid("settlement.request", "Frozen request changed");
  return { taskId: settlementTaskIdentity(frame.input).taskId, frame: index, requestHash: frame.requestHash, messages: compiled };
}
/** No judgment calls: only explicit program facts, and never when there are variable grants/read prose. */
export function mechanicalSettlement(frame: SettlementFrame): v.SettlementProposal {
  if (frame.input.grants.length || frame.input.evidence.some(s => s.role === "current" && s.kind !== "program-fact")) v.invalid("settlement.mechanical", "Narrative or variable assessment requires the settlement model");
  return programOnlySettlement(frame);
}
/** Explicit fallback, NOT a successful model assessment. No variable/asset effects or inferred claims. */
export function programOnlySettlement(frame: SettlementFrame): v.SettlementProposal {
  const result = emptySettlementProposal(frame.input);
  result.memory.points = frame.input.evidence.filter(s => s.role === "current" && s.kind === "program-fact" && s.authority === "fact").map(source => ({ kind: "fact", speakerId: null,
    text: frame.materials.evidence.find(m => m.sourceId === source.id)!.text, knownBy: source.knownBy, basisIds: [source.id] }));
  return v.parseSettlementProposal(result);
}
