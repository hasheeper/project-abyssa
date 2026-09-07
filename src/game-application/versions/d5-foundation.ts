import * as v from "../../game-core/contracts";
import type { ValidatedD5Catalog } from "../../game-core/contracts";
import { initialD5Projection } from "../../game-core/session";
import type { D5RunReaders } from "../../game-core/session";
import { applicationError } from "../service";
import { sameHead } from "../transaction";
import type { ReceiptError } from "../contracts";
import type { D5GameRecord, D5Receipt, D5Store } from "./d5-contracts";
import { parseD5Request } from "./d5-parse";
import { d5FactId, validateD5Receipt, validateD5Record } from "./d5-validate";

type Result = { ok: true; receipt: D5Receipt; replayed: boolean } | { ok: false; error: ReceiptError; receipt?: D5Receipt };
const result = (receipt: D5Receipt, replayed: boolean): Result => receipt.status === "committed" ? { ok: true, receipt, replayed } : { ok: false, error: receipt.error!, receipt };

/** B's durable version boundary. No partial gameplay handler is exposed as a successful command. */
export function createD5FoundationApplication(catalog: ValidatedD5Catalog, store: D5Store, readers: D5RunReaders = {}) {
  async function read(saveId: string) {
    const raw = await store.read(v.id(saveId, "saveId"));
    if (!raw) v.invalid("saveId", "Save not found", "not-found");
    const record = validateD5Record(raw, catalog, readers);
    if (record.head.saveId !== saveId) v.invalid("head", "Stored key differs");
    return record;
  }
  return {
    async create(raw: unknown): Promise<Result> {
      try {
        v.assertJson(raw);
        const r = v.record(raw, "request", ["protocolVersion", "saveId", "epoch", "clientRequestId", "profileId"]);
        v.choice(r.protocolVersion, [4], "protocolVersion");
        const saveId = v.id(r.saveId, "saveId"), epoch = v.id(r.epoch, "epoch"), requestId = v.id(r.clientRequestId, "clientRequestId"), profileId = v.id(r.profileId, "profileId");
        if (profileId !== catalog.data.journey!.defaultProfileId) v.invalid("profileId", "Unknown D5 profile");
        const fingerprint = v.sha256(v.canonicalJson(raw));
        const old = await store.receipt(saveId, epoch, requestId);
        if (old) {
          const receipt = validateD5Receipt(old, catalog);
          if (receipt.saveId !== saveId || receipt.epoch !== epoch || receipt.requestId !== requestId) v.invalid("receipt", "Stored receipt identity differs");
          if (receipt.fingerprint !== fingerprint) v.invalid("clientRequestId", "Request ID reused", "request-id-reused");
          return result(receipt, true);
        }
        const head = { saveId, epoch, revision: 0 }, factId = d5FactId(saveId, epoch, 0, 0), campaign = initialD5Projection(catalog);
        const record: D5GameRecord = {
          schemaVersion: 4, head, contentRef: catalog.ref, profileId,
          snapshot: { campaign, run: null },
          commits: [{ ref: head, previous: null, requestId, kind: "create", factIds: [factId] }],
          facts: [{ version: 4, id: factId, source: head, origin: "present", runRef: null, originRef: null, worldTime: campaign.clock, visibility: "party", kind: "save-created", payload: { profileId } }],
          retractedFactIds: [], undoAnchors: [], originRef: null,
        };
        const receipt: D5Receipt = { version: 4, contentRef: catalog.ref, saveId, epoch, requestId, fingerprint, status: "committed", before: null, after: head, error: null, events: [], factIds: [factId] };
        const committed = await store.commit({ saveId, epoch, requestId, fingerprint, expectedHead: null, candidate: validateD5Record(record, catalog), receipt: validateD5Receipt(receipt, catalog) });
        return result(validateD5Receipt(committed.receipt, catalog), committed.replayed);
      } catch (error) { return { ok: false, error: applicationError(error) }; }
    },
    async open(saveId: string) {
      try { return { ok: true as const, record: await read(saveId) }; }
      catch (error) { return { ok: false as const, error: applicationError(error) }; }
    },
    async exportSave(saveId: string) {
      try { return { ok: true as const, archive: JSON.stringify({ archiveVersion: 4, record: await read(saveId) }) }; }
      catch (error) { return { ok: false as const, error: applicationError(error) }; }
    },
    async dispatch(raw: unknown): Promise<Result> {
      try {
        const request = parseD5Request(raw), record = await read(request.saveId);
        if (!sameHead(record.head, request.expectedHead)) v.invalid("expectedHead", "Stored head differs", "conflict");
        v.invalid("command", "D5 gameplay commands are not installed in the foundation service", "content-unavailable");
      } catch (error) { return { ok: false, error: applicationError(error) }; }
    },
  };
}
