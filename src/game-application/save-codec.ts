import type { StoredRecord } from "./contracts";
import { isPooledJson, poolSaveJson, unpoolSaveJson } from "../game-core/contracts";

export const encodeStoredRecord = (record: StoredRecord): unknown => record.schemaVersion === 4 ? poolSaveJson(record) : record;
export const decodeStoredRecord = <R extends StoredRecord>(value: unknown): R | null =>
  (isPooledJson(value) ? unpoolSaveJson(value) : value ?? null) as R | null;
