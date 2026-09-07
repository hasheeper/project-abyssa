import { decideCommit, requestKey } from "../../game-application/transaction";
import { GameStorageError } from "../../game-application/contracts";
import type {
  GameStorePort,
  GameRecord,
  CommandReceipt,
  CommitProposal,
  CommitResult,
  StoredRecord,
  StoredReceipt,
} from "../../game-application/contracts";

function storageError(error: unknown): GameStorageError {
  const name = error instanceof DOMException ? error.name : "";
  return new GameStorageError(
    name === "QuotaExceededError"
      ? "storage-quota"
      : ["AbortError", "TransactionInactiveError"].includes(name)
        ? "storage-aborted"
        : "storage-unavailable",
    error instanceof Error ? error.message : "IndexedDB unavailable",
  );
}
/** No rules execute inside a transaction. Resolution happens only after transaction completion. */
export class IndexedDbGameStore<
  R extends StoredRecord = GameRecord,
  C extends StoredReceipt = CommandReceipt,
> implements GameStorePort<R, C> {
  private connection: Promise<IDBDatabase> | null = null;
  constructor(
    private readonly name = "abyssa-game-v1",
    private readonly factory: IDBFactory = indexedDB,
  ) {}
  close() {
    const current = this.connection;
    this.connection = null;
    void current?.then(
      (db) => db.close(),
      () => {},
    );
  }
  private connect(): Promise<IDBDatabase> {
    if (this.connection) return this.connection;
    const pending = new Promise<IDBDatabase>((resolve, reject) => {
      let rejected = false;
      const request = this.factory.open(this.name, 1);
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains("saves"))
          db.createObjectStore("saves");
        if (!db.objectStoreNames.contains("receipts"))
          db.createObjectStore("receipts");
      };
      request.onblocked = () => {
        rejected = true;
        reject(
          new GameStorageError(
            "storage-blocked",
            "Database upgrade blocked by another connection",
          ),
        );
      };
      request.onerror = () => reject(storageError(request.error));
      request.onsuccess = () => {
        const db = request.result;
        if (rejected) {
          db.close();
          return;
        }
        db.onversionchange = () => {
          db.close();
          this.connection = null;
        };
        db.onclose = () => {
          this.connection = null;
        };
        resolve(db);
      };
    });
    this.connection = pending;
    void pending.catch(() => {
      if (this.connection === pending) this.connection = null;
    });
    return pending;
  }
  private async readValue<T>(
    store: string,
    key?: IDBValidKey,
    keys = false,
  ): Promise<T> {
    try {
      const db = await this.connect();
      return await new Promise<T>((resolve, reject) => {
        const tx = db.transaction(store, "readonly");
        let value: T;
        const request =
          key === undefined
            ? keys
              ? tx.objectStore(store).getAllKeys()
              : tx.objectStore(store).getAll()
            : tx.objectStore(store).get(key);
        request.onsuccess = () => {
          value = request.result;
        };
        tx.oncomplete = () => resolve(value);
        tx.onabort = () =>
          reject(
            storageError(
              tx.error ?? new DOMException("Read aborted", "AbortError"),
            ),
          );
        tx.onerror = () => {};
      });
    } catch (error) {
      if (error instanceof GameStorageError) throw error;
      throw storageError(error);
    }
  }
  async read(saveId: string) {
    return (await this.readValue<R | undefined>("saves", saveId)) ?? null;
  }
  async receipt(saveId: string, epoch: string, requestId: string) {
    return (
      (await this.readValue<C | undefined>(
        "receipts",
        requestKey(saveId, epoch, requestId),
      )) ?? null
    );
  }
  async listSaveIds(): Promise<string[]> {
    return (await this.readValue<IDBValidKey[]>("saves", undefined, true))
      .map(String)
      .sort();
  }
  async commit(proposal: CommitProposal<R, C>): Promise<CommitResult<C>> {
    try {
      // Detach the caller's mutable proposal before any asynchronous operation.
      const input = structuredClone(proposal),
        db = await this.connect();
      return await new Promise<CommitResult<C>>((resolve, reject) => {
        const tx = db.transaction(["saves", "receipts"], "readwrite"),
          saves = tx.objectStore("saves"),
          receipts = tx.objectStore("receipts");
        const key = requestKey(input.saveId, input.epoch, input.requestId),
          readSave = saves.get(input.saveId),
          readReceipt = receipts.get(key);
        let completedReads = 0,
          result: CommitResult<C>,
          error: unknown;
        const decide = () => {
          if (++completedReads !== 2) return;
          try {
            const decision = decideCommit(
              readSave.result ?? null,
              readReceipt.result ?? null,
              input,
            );
            result = decision.result;
            if (decision.write) {
              if (decision.record) saves.put(decision.record, input.saveId);
              receipts.put(result.receipt, key);
            }
          } catch (caught) {
            error = caught;
            try {
              tx.abort();
            } catch {
              /* Already aborted by the platform. */
            }
          }
        };
        readSave.onsuccess = decide;
        readReceipt.onsuccess = decide;
        tx.oncomplete = () => resolve(result);
        tx.onerror = () => {};
        tx.onabort = () =>
          reject(
            storageError(
              error ??
                tx.error ??
                new DOMException("Commit aborted", "AbortError"),
            ),
          );
      });
    } catch (error) {
      if (error instanceof GameStorageError) throw error;
      throw storageError(error);
    }
  }
}
