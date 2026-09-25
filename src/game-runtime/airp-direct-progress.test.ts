import { beforeAll, describe, expect, it } from "vitest";
import { directReturnGate, prepareDirect } from "../game-application/testing/airp-direct-playthrough";
import type { PoolRecord } from "../game-application/testing/airp-pool-playthrough";
import { directConnectionIssue, directProgressFacts } from "./airp-direct-progress";
import { createAiConfiguration } from "./airp-configuration";

let record: PoolRecord;
beforeAll(async () => {const f = await directReturnGate("extracted"); await prepareDirect(f); record = await f.read();}, 120000);
describe("read-only direct recovery eligibility", () => {
  it("uses frozen endpoints and does not mistake changed model settings for a new task", () => {
    const task = record.airpDirect!.tasks[0], material = record.airpDirect!.materials[task.materialHash!];
    const config = createAiConfiguration();
    expect(directConnectionIssue(record, task, config.getSnapshot())).toContain("Key");
    config.patch({baseUrl: material.models.planning.baseUrl, commonKey: "fake-only-key"});
    expect(directConnectionIssue(record, task, config.getSnapshot())).toBeNull();
    config.patch({baseUrl: "https://changed.invalid/v1"});
    expect(directConnectionIssue(record, task, config.getSnapshot())).toContain("冻结端点");
  });
  it("matches the existing 24-attempt and two-format-attempt limits", () => {
    const task = record.airpDirect!.tasks[0];
    const base = {id: "test", stage: "planning" as const, ordinal: 1, inputHash: "h", startedAt: 1, endedAt: 2, status: "failed" as const, output: null, usage: {inputTokens: null, outputTokens: null, totalTokens: null}, error: "provider-error" as const, outcomeUnknown: false};
    expect(directProgressFacts(record, {...task, attempts: Array.from({length: 24}, () => base)}).capacityReached).toBe(true);
    const upstream = [base, {...base, stage: "writing" as const}].map(a => ({...a, status: "succeeded" as const, output: "ok", error: null}));
    expect(directProgressFacts(record, {...task, attempts: [...upstream, {...base, stage: "formatting"}]}).capacityReached).toBe(false);
    expect(directProgressFacts(record, {...task, attempts: [...upstream, {...base, stage: "formatting"}, {...base, stage: "formatting"}]}).capacityReached).toBe(true);
  });
  it("does not offer generation for an inactive or already read scene", () => {
    const task = record.airpDirect!.tasks[0];
    expect(directProgressFacts(record, task).canGenerate).toBe(true);
    expect(directProgressFacts(record, {...task, sceneId: "other"}).canGenerate).toBe(false);
    expect(directProgressFacts(record, {...task, source: "browser-direct"}).canUpdate).toBe(false);
  });
});
