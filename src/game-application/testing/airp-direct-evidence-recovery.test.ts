import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { expect, it } from "vitest";
import { parseTestConfig } from "../../game-infrastructure/airp-direct/test-config";
import { poolTestRuntime } from "./airp-pool-playthrough";
import { hash } from "../airp-generation/contracts";
import { inspectDirectAttempt } from "../airp-direct-gameplay/inspection";
import type { D5GameRecord } from "../index";

const evidence = process.env.ABYSSA_AIRP_P2_RECOVER_EVIDENCE;
/** Opt-in local recovery only. A diagnostic is NOT generally restorable: every
 * restored endpoint must be exactly the old one and pass the original hashes. */
it.skipIf(!evidence)("recovers only redacted endpoint metadata, then validates the entire actual paid record", async () => {
  const config = parseTestConfig(readFileSync(resolve("config/airp-test.local.json"), "utf8"));
  const record = JSON.parse(readFileSync(evidence!, "utf8")) as D5GameRecord;
  let replaced = 0;
  const restoreMetadata = (raw: unknown) => {
    if (!raw || typeof raw !== "object") return;
    const value = raw as Record<string, unknown>;
    if (value.baseUrl === "[configured-endpoint]") {
      const models = Object.values(config.models).filter(m => m.model === value.model);
      if (models.length !== 1) throw Error("Ambiguous original model endpoint; refusing recovery");
      value.baseUrl = models[0].baseUrl; replaced++;
    }
    Object.values(value).forEach(restoreMetadata);
  };
  restoreMetadata(record); expect(replaced).toBeGreaterThan(0);
  for (const [digest, material] of Object.entries(record.airpDirect!.materials)) expect(hash(material)).toBe(digest);
  const archive = JSON.stringify({archiveVersion: 4, record});
  expect(Object.values(config.keys).every(key => !key || !archive.includes(key))).toBe(true);
  const f = poolTestRuntime(undefined, record.head.saveId);
  expect((await f.runtime.application.restoreSave({archive, clientRequestId: "recover-real-evidence"})).ok).toBe(true);
  expect(hash(await f.read())).toBe(hash(record));
  for (const task of record.airpDirect!.tasks) for (const attempt of task.attempts)
    expect(inspectDirectAttempt(record, task.sceneId, attempt.id).inputHash).toBe(attempt.inputHash);
  const folder = resolve("dist/reports/airp-p2/private"); mkdirSync(folder, {recursive: true});
  const filename = `cleared-${record.head.saveId}.archive.local.json`;
  writeFileSync(resolve(folder, filename), archive, {mode: 0o600, flag: "wx"});
  writeFileSync(resolve(folder, "../evidence-recovery.json"), JSON.stringify({originalEvidence: evidence, archive: filename,
    recoveredEndpointFields: replaced, materialHashesVerified: true, fullReplayVerified: true, allInputHashesVerified: true, changedStoryOrOutputs: false}, null, 2));
}, 120000);
