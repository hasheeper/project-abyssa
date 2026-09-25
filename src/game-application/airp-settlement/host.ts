import type { SettlementItemRef } from "../../game-core/contracts";
import type { GameStorePort, HeadRef, StoredReceipt, StoredRecord } from "../contracts";
import { sameHead } from "../transaction";
import { cloneSettlement, settlementHash } from "./context";
import { SettlementRuntimeError, type SettlementHostCommit, type SettlementHostPort, type SettlementHostSnapshot, type SettlementLedger } from "./contracts";
import { validateSettlementSnapshot } from "./service";

type Projection = Omit<SettlementHostSnapshot, "head">;
/**
 * Glue for a NEW version-specific owning aggregate. It uses the existing transactional store.
 * No old reader is widened here. The installer and asset reducer are synchronous pure operations.
 */
export function createSettlementHostPort<R extends StoredRecord, C extends StoredReceipt>(options: {
  saveId: string; store: GameStorePort<R, C>;
  validate(record: R): void;
  project(record: R): Projection;
  install(record: R, value: { head: HeadRef; worldHead: HeadRef; ledger: SettlementLedger; requestId: string; kind: SettlementHostCommit["kind"] }): R;
  receipt(record: R, value: { before: HeadRef; requestId: string; fingerprint: string }): C;
  /** Must verify operation hashes/conditions and update assets + their own receipts on the clone. */
  applyItems?: (record: R, operations: SettlementItemRef[]) => R;
}): SettlementHostPort {
  async function root() {
    const r = await options.store.read(options.saveId);
    if (!r) throw new SettlementRuntimeError("invalid-state", "Owning save is missing");
    options.validate(r); return r;
  }
  function snapshot(record: R) {
    const s = { head: record.head, ...options.project(record) };
    validateSettlementSnapshot(s); return cloneSettlement(s);
  }
  return {
    async read() { return snapshot(await root()); },
    async commit(command) {
      const record = await root(), before = snapshot(record);
      if (!sameHead(before.head, command.expectedHead) || !sameHead(before.worldHead, command.expectedWorldHead)) throw new SettlementRuntimeError("conflict", "Owning save changed before settlement commit");
      if (command.kind === "metadata" && command.effects.length) throw new SettlementRuntimeError("invalid-state", "Bookkeeping cannot apply effects");
      const operations = command.effects.flatMap(e => e.kind === "item" ? [e.operation] : []);
      let candidate = cloneSettlement(record);
      if (operations.length) {
        if (!options.applyItems) throw new SettlementRuntimeError("asset-pending", "Asset adapter is not installed; settlement remains pending");
        try { candidate = options.applyItems(candidate, cloneSettlement(operations)); }
        catch { throw new SettlementRuntimeError("asset-pending", "Asset definition, condition or operation validation did not pass"); }
        const applied = options.project(candidate).appliedItemOperations;
        if (operations.some(op => !applied.some(a => settlementHash(a) === settlementHash(op)))) throw new SettlementRuntimeError("asset-pending", "Asset reducer did not record every exact operation");
      }
      const head = { ...record.head, revision: record.head.revision + 1 };
      const worldHead = command.kind === "settlement" ? head : before.worldHead;
      if (!sameHead(command.next.state.head, worldHead)) throw new SettlementRuntimeError("invalid-state", "Proposed world revision mismatch");
      const fingerprint = settlementHash(command), requestId = `cl-b:${fingerprint}`;
      candidate = options.install(candidate, { head, worldHead, ledger: cloneSettlement(command.next), requestId, kind: command.kind });
      options.validate(candidate);
      const installed = snapshot(candidate);
      if (!sameHead(installed.head, head) || !sameHead(installed.worldHead, worldHead) || settlementHash(installed.ledger) !== settlementHash(command.next)) throw new SettlementRuntimeError("invalid-state", "Host installer changed the settlement transaction");
      const receipt = options.receipt(candidate, { before: record.head, requestId, fingerprint });
      const result = await options.store.commit({ saveId: head.saveId, epoch: head.epoch, requestId, fingerprint, expectedHead: record.head, candidate, receipt });
      if (result.receipt.status !== "committed") throw new SettlementRuntimeError("conflict", "Atomic root CAS rejected settlement; no effects committed");
      return snapshot(await root());
    },
  };
}
