import type { StoredRecord, StoredReceipt, HeadRef } from "../../game-application/contracts";
import { requestKey, sameHead } from "../../game-application/transaction";
import { GAME_DATABASE, openGameDatabase } from "./game-database";
import { decodeStoredRecord, encodeStoredRecord } from "../../game-application/save-codec";
import { IndexedDbSaveSlotStore, SaveSlotConflict, validateSlotIndex, type SaveSlotIndex } from "./save-slot-index";

export type PreparedSave = { record: StoredRecord; receipt: StoredReceipt };
/** A detached exact read, captured before the player confirms. Never rendered. */
export type ArchiveTarget = { saveId: string; serialized: string; head?: HeadRef };
export type ArchiveChange = {
  index: SaveSlotIndex;
  target?: ArchiveTarget;
  replacement?: { position: number; savedAt: string; save: PreparedSave };
  protectedSaveId?: string;
};

export class ArchiveConflict extends Error {
  constructor() { super("档案已在另一页面改变，请刷新后重新确认。"); }
}

export class IndexedDbArchiveStore {
  constructor(private factory: IDBFactory = indexedDB, private name = GAME_DATABASE) {}
  async inspect(saveId: string, expectedHead?: HeadRef): Promise<ArchiveTarget> {
    if (!saveId) throw new Error("请选择要删除的档案。");
    const db = await openGameDatabase(this.factory, this.name);
    return new Promise((resolve, reject) => {
      const tx = db.transaction("saves", "readonly"), read = tx.objectStore("saves").get(saveId);
      tx.oncomplete = () => {
        db.close();
        const record = read.result;
        let head: HeadRef | undefined;
        try { head = decodeStoredRecord(record)?.head; } catch { /* Corrupt archives must remain deletable by exact captured bytes. */ }
        if (expectedHead && !sameHead(head ?? null, expectedHead)) { reject(new ArchiveConflict()); return; }
        resolve({ saveId, serialized: JSON.stringify(record ?? null), ...(head ? {head} : {}) });
      };
      tx.onabort = () => { db.close(); reject(tx.error); };
    });
  }
  async change(raw: ArchiveChange): Promise<SaveSlotIndex> {
    const input = structuredClone(raw), { target, replacement } = input;
    const replacementRecord = replacement ? encodeStoredRecord(replacement.save.record) : null;
    validateSlotIndex(input.index);
    if (target && target.saveId === input.protectedSaveId) throw new Error("此档案正在用于当前旅程，请返回标题后再删除或覆盖。");
    if (!target && !replacement) throw new Error("缺少档案操作目标。");
    if (replacement && (!Number.isInteger(replacement.position) || replacement.position < 0 || replacement.position >= 30 || !Number.isFinite(Date.parse(replacement.savedAt)))) throw new Error("无效的存档位置。");
    const slots = new IndexedDbSaveSlotStore(this.factory, this.name), fallback = await slots.read();
    const db = await openGameDatabase(this.factory, this.name);
    const next = await new Promise<SaveSlotIndex>((resolve, reject) => {
      const tx = db.transaction(["saves", "receipts", "archive"], "readwrite");
      const saves = tx.objectStore("saves"), receipts = tx.objectStore("receipts"), meta = tx.objectStore("archive");
      const indexRead = meta.get("manual"), targetRead = target ? saves.get(target.saveId) : null;
      const newRead = replacement ? saves.get(replacement.save.record.head.saveId) : null;
      let left = 1 + Number(!!targetRead) + Number(!!newRead), result: SaveSlotIndex, failure: unknown;
      const abort = (error: unknown) => { failure = error; tx.abort(); };
      const decide = () => {
        if (--left) return;
        try {
          const prior = indexRead.result === undefined ? fallback : validateSlotIndex(indexRead.result);
          // A lost acknowledgement may retry an already committed operation.
          // Only the exact frozen replacement, with its old target gone, counts.
          const installed = replacement && prior?.slots[replacement.position];
          if (prior && prior.revision > input.index.revision && (!target || !targetRead!.result) &&
              !prior.slots.some(slot => target && slot?.saveId === target.saveId) &&
              (replacement ? installed?.saveId === replacement.save.record.head.saveId && installed.savedAt === replacement.savedAt &&
                JSON.stringify(newRead!.result) === JSON.stringify(replacementRecord) : !!target)) {
            result = prior; return;
          }
          if ((prior?.revision ?? 0) !== input.index.revision) throw new SaveSlotConflict();
          if (target && JSON.stringify(targetRead!.result ?? null) !== target.serialized) throw new ArchiveConflict();
          const current = prior ?? input.index;
          if (replacement) {
            const old = current.slots[replacement.position];
            if ((old?.saveId ?? null) !== (target?.saveId ?? null)) throw new SaveSlotConflict();
            const {record, receipt} = replacement.save;
            if (newRead!.result || record.head.saveId === target?.saveId || receipt.status !== "committed" || receipt.saveId !== record.head.saveId || receipt.epoch !== record.head.epoch || !sameHead(receipt.after, record.head)) throw new ArchiveConflict();
            saves.add(replacementRecord, record.head.saveId);
            receipts.add(receipt, requestKey(receipt.saveId, receipt.epoch, receipt.requestId));
          }
          result = { ...current, revision: current.revision + 1, slots: current.slots.map((slot, position) =>
            replacement && position === replacement.position ? { saveId: replacement.save.record.head.saveId, epoch: replacement.save.record.head.epoch, savedAt: replacement.savedAt }
              : slot?.saveId === target?.saveId && target ? null : slot) };
          meta.put(result, "manual");
          if (target) {
            saves.delete(target.saveId);
            // Receipts can include failed commands and older epochs, not just
            // the current record's commits. Remove all receipts owned by this ID.
            const cursor = receipts.openCursor();
            cursor.onsuccess = () => {
              const item = cursor.result;
              if (!item) return;
              if (item.value?.saveId === target.saveId) item.delete();
              item.continue();
            };
          }
        } catch (error) { abort(error); }
      };
      indexRead.onsuccess = decide;
      if (targetRead) targetRead.onsuccess = decide;
      if (newRead) newRead.onsuccess = decide;
      tx.oncomplete = () => { db.close(); resolve(result); };
      tx.onerror = () => {};
      tx.onabort = () => { db.close(); reject(failure ?? tx.error ?? new Error("档案操作未完成，原档未改变。")); };
    });
    // This is only a retired index, never the authoritative save. A failure here
    // must not report a successfully committed destructive action as failed.
    await slots.clearLegacy().catch(() => {});
    return next;
  }
}
