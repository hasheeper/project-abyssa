import { expect, it } from "vitest";
import { formalAirpFixture } from "../testing/airp-game-fixture";
import { compileNodeFrame } from "../airp-expedition-play/context";
import { admitMemoryCorrections, effectiveMemory, memoryTargets } from "./effective";
import type { MemoryContext } from "./contracts";
import type { SettlementMemory, SettlementThread } from "../../game-core/contracts";

it("node prose reads corrected summaries/threads, not the raw ledger duplicate channels", async () => {
  const f = await formalAirpFixture(); await f.flow.sync();
  const id = await f.prepare(), permit = await f.flow.gm.departurePermit(id);
  await f.send({type: "start-expedition", ...permit.departure}); await f.flow.sync();
  const s = structuredClone(await f.flow.nodes.read()), j = s.ledger.jobs[0];
  const scope = {kind: "run" as const, boundaryId: "mock-memory", eventId: null, actionId: null, runId: s.program.runId};
  const point = {kind: "fact" as const, text: "模拟旧错误记忆", speakerId: null, knownBy: ["kael", ...j.node.actorIds], basisIds: ["mock:fact"]};
  const thread: SettlementThread = {...point, id: "mock:thread", scope, until: "resolved", topicKey: "confirmed"};
  const memory: SettlementMemory = {id: "mock:memory", phase: s.program.phase, scope, points: [point], opened: [thread], closed: [], effectIds: [], priorReceiptIds: [], sources: []};
  // Pure source-projection fixture. It is not written to the valid owning save.
  s.settlement.memories.push(memory); s.settlement.openThreads.push(thread);
  const targets = memoryTargets([memory], [thread]);
  const context: MemoryContext = {...effectiveMemory(targets, []), sourceHead: s.head, evidence: [{id: "mock:fact", head: s.head, knownBy: point.knownBy}]};
  const records = admitMemoryCorrections({memoryCorrections: [{reason: "模拟更正", basisIds: ["mock:fact"], changes: [
    {kind: "replace-summary", targetId: targets[0].id, expectedHash: targets[0].hash, text: "模拟有效记忆"},
    {kind: "close-thread", targetId: targets[1].id, expectedHash: targets[1].hash},
  ]}]}, context, {jobId: "mock:gm", attemptId: "mock:attempt", recordedHead: s.head});
  s.memoryView = effectiveMemory(targets, records);
  const frame = compileNodeFrame(s, j), scenario = JSON.parse(frame.scene.scenario).scene;
  expect(scenario.memories[0].points[0].text).toBe("模拟有效记忆"); expect(scenario.openThreads).toEqual([]);
  expect(frame.messages.map(m => m.content).join("\n")).not.toContain("模拟旧错误记忆");
  expect(s.settlement.memories[0].points[0].text).toBe("模拟旧错误记忆"); expect(f.raw().airpGame!.settlement.memories).toEqual([]);
}, 30000);
