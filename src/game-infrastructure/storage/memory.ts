import { decideCommit, requestKey } from "../../game-application/transaction";
import type {
  GameStorePort,
  GameRecord,
  CommandReceipt,
  CommitProposal,
  StoredRecord,
  StoredReceipt,
} from "../../game-application/contracts";

/** Sharing this database object models independent connections to the same local store. */
export class MemoryGameDatabase<
  R extends StoredRecord = GameRecord,
  C extends StoredReceipt = CommandReceipt,
> {
  readonly records = new Map<string, R>();
  readonly receipts = new Map<string, C>();
}
export class MemoryGameStore<
  R extends StoredRecord = GameRecord,
  C extends StoredReceipt = CommandReceipt,
> implements GameStorePort<R, C> {
  constructor(private readonly database = new MemoryGameDatabase<R, C>()) {}
  async read(saveId: string) {
    return structuredClone(this.database.records.get(saveId) ?? null);
  }
  async listSaveIds(): Promise<string[]> {
    return [...this.database.records.keys()].sort();
  }
  async receipt(saveId: string, epoch: string, requestId: string) {
    return structuredClone(
      this.database.receipts.get(requestKey(saveId, epoch, requestId)) ?? null,
    );
  }
  async commit(proposal: CommitProposal<R, C>) {
    const key = requestKey(proposal.saveId, proposal.epoch, proposal.requestId);
    // No await between compare and both writes. Clone everything before changing either map.
    const decision = decideCommit(
      this.database.records.get(proposal.saveId) ?? null,
      this.database.receipts.get(key) ?? null,
      proposal,
    );
    const receipt = structuredClone(decision.result.receipt);
    if (decision.write) {
      if (decision.record)
        this.database.records.set(proposal.saveId, decision.record);
      this.database.receipts.set(key, receipt);
    }
    return decision.result;
  }
}
