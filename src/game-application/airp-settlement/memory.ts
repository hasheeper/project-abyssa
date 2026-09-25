import * as v from "../../game-core/contracts";
import type { SettlementFrame } from "./contracts";
import type { MemoryView } from "../airp-memory/contracts";
import { memoryHash } from "../airp-memory/effective";

/** Bookkeeping head/evidence growth alone does not invalidate a frozen memory view. */
export const memoryViewHash = (view?: MemoryView) => memoryHash(view ? {targets: view.targets, closed: view.closed, diagnostics: view.diagnostics} : null);

/** Identity/provenance guard, not an AI audit. Live preparation and replay use
 * this same adapter; original response, input and historical receipts stay intact. */
export function normalizeSettlementMemory(frame: SettlementFrame, raw: unknown): unknown {
  const view = frame.materials.memoryView;
  if (!view) return raw;
  const proposal = v.parseSettlementProposal(raw), input = frame.input;
  const closedIds = new Set(view.closed.map(c => c.target.id));
  proposal.memory.close = proposal.memory.close.filter(c => !closedIds.has(c.id));
  proposal.memory.open = proposal.memory.open.flatMap(open => {
    const matches = view.closed.filter(c => {
      const t = c.target.value as v.SettlementThread;
      const sameOwner = t.scope.eventId ? t.scope.eventId === input.scope.eventId : t.scope.runId ? t.scope.runId === input.scope.runId : t.scope.boundaryId === input.scope.boundaryId;
      return sameOwner && t.speakerId === open.speakerId && (t.topicKey === open.key || t.text === open.text || open.basisIds.some(id => t.basisIds.includes(id)));
    });
    if (!matches.length) return [open];
    const cutoff = Math.max(...matches.map(c => c.effectiveHead.revision));
    const fresh = input.evidence.filter(e => open.basisIds.includes(e.id) && e.role === "current" && e.head.revision > cutoff);
    if (!fresh.length) return [];
    // Disambiguate a new promise from a closed stable ID in the immutable raw ledger.
    return [{...open, key: `renewed:${memoryHash([open.key, fresh.map(e => e.id)]).slice(0, 40)}`}];
  });
  return proposal;
}
