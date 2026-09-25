import { canonicalJson } from "../../game-core/contracts";
import type { SettlementFrame } from "../airp-settlement/contracts";
import { cloneLow, lowHash } from "../airp-low/native";
import { nodeTextDigest } from "./context";
import type { nodeSettlement } from "./settlement";

/** Compare with the projection the saved node actually received, without rewriting it.
 * Before checkpoint metadata, current-room facts did not include objectiveProgress.
 * Only these additive fields may be absent; prose/cards/world/evidence stay exact.
 */
export function sameNodeSettlementSources(frame: SettlementFrame, packet: ReturnType<typeof nodeSettlement>) {
  if (lowHash(frame.input.scope) !== lowHash(packet.input.scope) || lowHash(frame.input.evidence) !== lowHash(packet.input.evidence)) return false;
  const expected = cloneLow(packet.materials);
  // Validate old evidence against its frozen view, including after its own commit.
  if (frame.materials.memoryView) expected.memoryView = frame.materials.memoryView;
  else delete expected.memoryView;
  if (!frame.materials.checkpoint && /^cl-b-settlement-[1-4]$/.test(frame.promptVersion)) {
    delete expected.checkpoint;
    for (const material of expected.evidence) {
      if (!packet.input.evidence.some(e => e.id === material.sourceId && e.kind === "program-fact")) continue;
      const original = frame.materials.evidence.find(e => e.sourceId === material.sourceId);
      if (!original || original.text === material.text) continue;
      try {
        const current = JSON.parse(material.text), saved = JSON.parse(original.text);
        if (current.kind !== "actual-current-room" || saved.kind !== current.kind || Object.hasOwn(saved, "objectiveProgress")) continue;
        delete current.objectiveProgress;
        material.text = canonicalJson(current); material.digest = nodeTextDigest(material.text);
      } catch { /* Non-JSON evidence must still match byte for byte. */ }
    }
  }
  return lowHash(frame.materials) === lowHash(expected);
}
