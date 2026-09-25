import { expect, it } from "vitest";
import { nodeFixture, mockNodeWriting } from "../testing/airp-node-fixture";
import { emptyUsage } from "../airp-generation/contracts";
import { lowHash } from "../airp-low/native";
import { readLowWriting } from "../airp-low/output";
import { nodeStage } from "./service";

it("explicitly recovers a saved wrapper mismatch offline, only formats, and preserves the failed attempt", async () => {
  const f = await nodeFixture(), id = f.raw().nodes.jobs[0].id; await f.nodes.open(id);
  const old = f.raw(), frame = old.nodes.jobs[0].frame!; frame.readerVersion = 2;
  const { requestHash: _hash, ...body } = frame; frame.requestHash = lowHash(body); f.restore(old);
  const raw = mockNodeWriting().replace(/^(<planning>[\s\S]*?<\/planning>)<Interleaving>/, "<Interleaving>$1");
  await f.nodes.begin(id, { id: "old-writer", stage: "writing", model: "mock", connectionHash: "2".repeat(64), at: 1 });
  await expect(f.nodes.revalidateWriting(id)).rejects.toThrow();
  await f.nodes.result(id, "old-writer", raw, { inputTokens: 10, outputTokens: 20, totalTokens: 30 }, 2);
  const failed = f.raw().nodes.jobs[0]; expect(failed.attempts[0].status).toBe("failed");
  await f.nodes.revalidateWriting(id); const reread = f.raw().nodes.jobs[0];
  expect(nodeStage(reread)).toBe("formatting"); expect(reread.frame).toEqual(failed.frame); expect(reread.attempts).toEqual(failed.attempts);
  expect(reread.writingWarnings).toContain("performance-plan-inside-wrapper");
  const saved = f.raw(); f.restore(saved); await f.nodes.revalidateWriting(id); expect(f.raw()).toEqual(saved);
  const expected = readLowWriting(raw, frame, 3).text;
  await f.nodes.begin(id, { id: "format", stage: "formatting", model: "mock", connectionHash: "2".repeat(64), at: 3 });
  await f.nodes.result(id, "format", JSON.stringify(expected), emptyUsage(), 4);
  expect(f.raw().nodes.jobs[0].text).toEqual(expected);
  expect(f.raw().nodes.jobs[0].attempts.map(a => [a.stage, a.status])).toEqual([["writing", "failed"], ["formatting", "succeeded"]]);
  f.restore(f.raw());
}, 20000);
