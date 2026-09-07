import { parseCommandRequest, type CommandRequest } from "../game-runtime/views";
import type { SaveLocator } from "./navigation";
export type RequestStorage = Pick<Storage, "getItem" | "setItem" | "removeItem">;
const key = (locator: SaveLocator) => `abyssa:pending:v1:${locator.saveId}:${locator.epoch}`;
export function readPending(storage: RequestStorage, locator: SaveLocator): CommandRequest | null {
  const raw = storage.getItem(key(locator));
  if (!raw) return null;
  try {
    if (raw.length > 64_000) throw new Error("Oversized request");
    const value = JSON.parse(raw);
    const request = parseCommandRequest(value, value?.command?.type === "resume-enemy-turn");
    if (request.saveId !== locator.saveId || request.expectedHead.epoch !== locator.epoch) throw new Error("Wrong identity");
    return request;
  } catch {
    storage.removeItem(key(locator));
    return null;
  }
}
export function writePending(storage: RequestStorage, request: CommandRequest) {
  const encoded = JSON.stringify(request);
  if (encoded.length > 64_000) throw new Error("Request too large");
  storage.setItem(key({ saveId: request.saveId, epoch: request.expectedHead.epoch }), encoded);
}
export function clearPending(storage: RequestStorage, locator: SaveLocator) { storage.removeItem(key(locator)); }
