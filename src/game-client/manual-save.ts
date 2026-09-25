import type { AnyGameRecord } from "../game-application";
import { sameHead } from "../game-runtime/views";
import { gameErrorText } from "./game-errors";
import type { ClientRuntime } from "./session";
import type { SaveLocator } from "./navigation";
import type { prepareManualSave } from "../game-runtime/prepare-manual-save";
type PreparedSave = Awaited<ReturnType<typeof prepareManualSave>>;

/** A manual save is a new validated local copy, not an export or a rewrite of
 * the live campaign. Keep this attempt around on failure to retry the same receipt. */
export function createManualSaveAttempt(runtime: ClientRuntime, source: AnyGameRecord) {
  let request: { protocolVersion: number; saveId: string; epoch: string; clientRequestId: string; format: "application"; archive: string } | null = null;
  let flight: Promise<SaveLocator> | null = null;
  let saved: SaveLocator | null = null;
  let prepared: Promise<PreparedSave> | null = null;
  async function prepareRequest() {
    if (request) return request;
    const exported = await runtime.application.exportSave(source.head.saveId);
    if (!exported.ok) throw new Error(gameErrorText(exported.error.code));
    const archive = JSON.parse(exported.archive) as { record: AnyGameRecord };
    if (!sameHead(archive.record.head, source.head)) throw new Error(gameErrorText("conflict"));
    request = { protocolVersion: source.schemaVersion, saveId: runtime.newId(), epoch: runtime.newId(),
      clientRequestId: runtime.newId(), format: "application", archive: exported.archive };
    return request;
  }
  return {
    source,
    fork() { return createManualSaveAttempt(runtime, source); },
    get completed() { return saved !== null; },
    prepare(): Promise<PreparedSave> {
      if (!prepared) {
        prepared = (async () => {
          const input = await prepareRequest();
          const {prepareManualSave} = await import("../game-runtime/prepare-manual-save");
          return prepareManualSave(input);
        })();
        void prepared.catch(() => { prepared = null; });
      }
      return prepared;
    },
    save(): Promise<SaveLocator> {
      if (saved) return Promise.resolve(saved);
      if (flight) return flight;
      flight = (async () => {
        await prepareRequest();
        const result = await runtime.application.importSave(request);
        if (!result.ok) throw new Error(gameErrorText(result.error.code));
        saved = { saveId: request!.saveId, epoch: request!.epoch };
        return saved;
      })();
      void flight.finally(() => { flight = null; }).catch(() => {});
      return flight;
    },
  };
}
export type ManualSaveAttempt = ReturnType<typeof createManualSaveAttempt>;
