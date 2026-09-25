import type { ValidatedD5Catalog } from "../../game-core/contracts";
import type { D5Command, D5GameRecord, D5Receipt, D5Store } from "../versions/d5-contracts";
import { createD5Application } from "../versions/d5-service";
import { check } from "../airp-generation/contracts";
import { sameHead } from "../transaction";
import { cloneLow } from "../airp-low/native";

/** Compute on a transient candidate; caller commits it with node state on the ONE owning root. */
export async function computeD5NodeCommand(catalog: ValidatedD5Catalog, original: D5GameRecord, command: D5Command, requestId: string): Promise<{ record: D5GameRecord; receipt: D5Receipt }> {
  return createD5NodeCalculator(catalog)(original, command, requestId);
}
/** Reuse the legacy reader's verified prefix for a session, never a second persisted save. */
export function createD5NodeCalculator(catalog: ValidatedD5Catalog) {
  let candidate: D5GameRecord | null = null, receipt: D5Receipt | null = null, busy = false;
  const store: D5Store = { async read() { return candidate && cloneLow(candidate); }, async listSaveIds() { return candidate ? [candidate.head.saveId] : []; }, async receipt() { return null; }, async commit(p) {
    check(candidate && p.candidate && p.receipt.status === "committed" && sameHead(candidate.head, p.expectedHead!), "Legacy calculation rejected"); candidate = cloneLow(p.candidate); receipt = cloneLow(p.receipt); return { receipt: p.receipt, replayed: false };
  } };
  const app = createD5Application(catalog, store);
  return async (original: D5GameRecord, command: D5Command, requestId: string): Promise<{ record: D5GameRecord; receipt: D5Receipt }> => {
  check(!busy, "Concurrent transient calculation; retry the owning transaction");
  check(catalog.ref.contentVersion === 19, "Final dungeon/drop-table adapter is deliberately deferred");
  check(["start-expedition", "battle-command", "advance-room", "choose-event", "choose-exit", "resume-run", "use-item", "settle-expedition"].includes(command.type), "Command is outside this CL-D gameplay slice");
  check(command.type !== "battle-command" || command.command.type !== "undo", "Undo across narrative evidence is not installed");
  busy = true; candidate = cloneLow(original); receipt = null;
  try {
    const request = { protocolVersion: 4, saveId: original.head.saveId, expectedHead: original.head, clientRequestId: requestId, command };
    const result = await (command.type === "resume-run" ? app.resumeRun(request) : app.dispatch(request));
    check(result.ok && receipt, "Actual D5 command did not commit"); return { record: candidate, receipt };
  } finally { busy = false; candidate = null; receipt = null; }
  };
}
