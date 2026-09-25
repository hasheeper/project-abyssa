import { assertJson, parseJson, record, choice } from "../../game-core/contracts";
import { isPooledJson, poolSaveJson, unpoolSaveJson } from "../../game-core/contracts";

/** Only the archive representation changes; the restored D5 record still passes
 * the same full domain replay, original hashes and source-text verification. */
export function serializeD5Archive(value: unknown): string {
  const archive = { archiveVersion: 4, record: poolSaveJson(value) };
  assertJson(archive);
  return JSON.stringify(archive);
}
export function parseD5Archive(serialized: string): unknown {
  const archive = record(parseJson(serialized), "archive", ["archiveVersion", "record"]);
  choice(archive.archiveVersion, [4], "archiveVersion");
  return isPooledJson(archive.record) ? unpoolSaveJson(archive.record) : archive.record;
}
