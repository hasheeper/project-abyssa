import { readFileSync, readdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { performance } from "node:perf_hooks";
import { expect, it } from "vitest";
import { poolTestRuntime } from "./airp-pool-playthrough";
import { hash } from "../airp-generation/contracts";
import { inspectDirectAttempt } from "../airp-direct-gameplay/inspection";
import type { D5GameRecord } from "../index";
import { parseD5Archive } from "../versions/d5-archive";

const directory = process.env.ABYSSA_AIRP_P2_PRIVATE_ARCHIVES;
it.skipIf(!directory)("restores actual live archives, re-exports them and reconstructs all paid inputs without network", async () => {
  const files = readdirSync(directory!).filter(f => f.endsWith(".archive.local.json")).sort();
  expect(files.some(f => f.startsWith("extracted-"))).toBe(true);
  expect(files.some(f => f.startsWith("cleared-"))).toBe(true);
  const report: object[] = [];
  for (const name of files) {
    const archive = readFileSync(resolve(directory!, name), "utf8"), raw = JSON.parse(archive);
    const record = raw.record as D5GameRecord;
    const f = poolTestRuntime(undefined, record.head.saveId), started = performance.now();
    const restored = await f.runtime.application.restoreSave({archive, clientRequestId: "live-restore"});
    // Assert booleans/hashes, never dump private endpoints on a failed assertion.
    expect(restored.ok).toBe(true);
    expect(hash(await f.read())).toBe(hash(record));
    const restoreMs = Math.round(performance.now() - started);
    const exported = await f.runtime.application.exportSave(record.head.saveId);
    expect(exported.ok).toBe(true);
    if (!exported.ok) throw Error("Live export failed");
    expect(hash(parseD5Archive(exported.archive))).toBe(hash(record));
    let attempts = 0;
    for (const task of record.airpDirect!.tasks) for (const attempt of task.attempts) {
      expect(inspectDirectAttempt(record, task.sceneId, attempt.id).inputHash).toBe(attempt.inputHash);
      attempts++;
    }
    report.push({archive: name, bytes: Buffer.byteLength(archive), restoreMs, attempts, memories: record.airpDirect!.memories.length, exactRoundTrip: true});
  }
  writeFileSync(resolve(directory!, "../restore-validation.json"), JSON.stringify(report, null, 2));
  console.info(JSON.stringify({event: "P2-real-archive-restore", results: report}));
}, 180000);
