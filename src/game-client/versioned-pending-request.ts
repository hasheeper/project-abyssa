import { parseVersionedRequest } from "../game-runtime/versioned-views";
import type {
  AnyGameRecord,
  CommandRequest,
  DemoRequest,
  D5Request,
} from "../game-application";
import type { RequestStorage } from "./pending-request";

const key = (record: Pick<AnyGameRecord, "schemaVersion" | "head">) =>
  `abyssa:pending:v${record.schemaVersion}:${record.head.saveId}:${record.head.epoch}`;
/** D2/D3 consumers bind pending commands to a validated save version, epoch and active run. */
export function readVersionedPending(
  storage: RequestStorage,
  record: AnyGameRecord,
): CommandRequest | DemoRequest | D5Request | null {
  const raw = storage.getItem(key(record));
  if (!raw) return null;
  try {
    if (raw.length > 64_000) throw new Error("Oversized pending request");
    const input = JSON.parse(raw),
      request = parseVersionedRequest(
        input,
        ["resume-run", "resume-enemy-turn"].includes(input?.command?.type),
      );
    if (
      request.protocolVersion !== record.schemaVersion ||
      request.saveId !== record.head.saveId ||
      request.expectedHead.epoch !== record.head.epoch ||
      request.expectedHead.revision > record.head.revision
    )
      throw new Error("Pending identity mismatch");
    const command = request.command;
    if (
      request.protocolVersion !== 1 &&
      record.schemaVersion !== 1 &&
      "runRef" in command &&
      !(command.runRef.kind === record.snapshot.campaign.activeRunRef?.kind && command.runRef.id === record.snapshot.campaign.activeRunRef.id && (command.runRef.kind !== "memory" || record.snapshot.campaign.activeRunRef.kind === "memory" && command.runRef.attempt === record.snapshot.campaign.activeRunRef.attempt)) &&
      !(command.type === "retry-memory" && record.schemaVersion === 4 && record.snapshot.campaign.memory?.node === "left" && record.snapshot.campaign.memory.id === command.runRef.id && record.snapshot.campaign.memory.attempt === command.runRef.attempt) &&
      !record.commits.some(c => c.requestId === request.clientRequestId) &&
      !(command.type === "settle-expedition" && record.snapshot.campaign.settlements.some(s => s.runId === command.runRef.id && s.id === command.terminalRef))
    )
      throw new Error("Stale run");
    return request;
  } catch {
    storage.removeItem(key(record));
    return null;
  }
}
export function writeVersionedPending(
  storage: RequestStorage,
  request: CommandRequest | DemoRequest | D5Request,
) {
  parseVersionedRequest(
    request,
    ["resume-run", "resume-enemy-turn"].includes(request.command.type),
  );
  const raw = JSON.stringify(request);
  if (raw.length > 64_000) throw new Error("Oversized pending request");
  storage.setItem(
    key({ schemaVersion: request.protocolVersion, head: request.expectedHead }),
    raw,
  );
}
export function clearVersionedPending(
  storage: RequestStorage,
  record: AnyGameRecord,
) {
  storage.removeItem(key(record));
}
