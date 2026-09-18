import * as v from "../../game-core/contracts";
import type { D5RunReaders } from "../../game-core/session";
import type { D5GameRecord, D5Receipt, D5Store } from "./d5-contracts";
import { validateD5Receipt } from "./d5-validate";

/** Exact-identity recovery only. Copy/upgrade is a separate, stricter operation. */
export async function restoreD5Archive(record: D5GameRecord, requestId: string, catalog: v.ValidatedD5Catalog, store: D5Store, readers: D5RunReaders) {
  if (!catalog.data.airp) v.invalid("restore", "Only AIRP archives support identity-preserving recovery", "content-unavailable");
  const { saveId, epoch } = record.head;
  const fingerprint = v.sha256(v.canonicalJson({ operation: "restore", record }));
  const prior = await store.receipt(saveId, epoch, requestId);
  if (prior && prior.fingerprint !== fingerprint) v.invalid("clientRequestId", "Request ID reused", "request-id-reused");
  const current = await store.read(saveId);
  if (current) {
    if (v.canonicalJson(current) !== v.canonicalJson(record)) v.invalid("archive", "A different or newer save already exists; nothing was overwritten", "conflict");
    return { ok: true as const, head: record.head, replayed: true };
  }
  if (prior) v.invalid("restore", "Receipt without its save; use a new recovery request", "conflict");
  if (record.commits.some(c => c.requestId === requestId)) v.invalid("clientRequestId", "Recovery request collides with archived gameplay", "request-id-reused");
  const receipt: D5Receipt = { version: 4, contentRef: catalog.ref, saveId, epoch, requestId, fingerprint,
    status: "committed", before: null, after: record.head, error: null, events: [], factIds: [], archiveOperation: "restore" };
  const result = await store.commit({ saveId, epoch, requestId, fingerprint, expectedHead: null, candidate: record, receipt: validateD5Receipt(receipt, catalog, readers) });
  const checked = validateD5Receipt(result.receipt, catalog, readers);
  return checked.status === "committed" ? { ok: true as const, head: record.head, replayed: result.replayed } : { ok: false as const, error: checked.error! };
}
