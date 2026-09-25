import { expect, it } from "vitest";
import { canonicalJson } from "../../game-core/contracts";
import { nodeFixture, mockNodeText, readAndChooseNode } from "../testing/airp-node-fixture";
import { createSettlementFrame, emptySettlementProposal } from "../airp-settlement/context";
import { emptyUsage } from "../airp-generation/contracts";
import { cloneLow } from "../airp-low/native";
import { nodeTextDigest } from "./context";
import { createNodeService } from "./service";
import { sameNodeSettlementSources } from "./settlement-compat";

it("resumes an old applied-but-open node without new settlement or changed saved evidence", async () => {
  const f = await nodeFixture(), id = f.raw().nodes.jobs[0].id;
  const legacyNodes = createNodeService({ ...f.nodePort, async read() {
    const s = await f.nodePort.read();
    for (const source of s.program.sources) {
      const value = JSON.parse(source.text); delete value.objectiveProgress; source.text = canonicalJson(value);
    }
    return s;
  } });
  const legacy = { ...f, nodes: legacyNodes };
  await mockNodeText(legacy, id); await readAndChooseNode(legacy, id);
  const packet = await legacyNodes.settlementInput(id); delete packet.materials.checkpoint;
  const task = await f.settlement.enqueue(packet.input, packet.materials);
  // Reproduce the previous frame version with the exact same frozen request.
  const old = f.raw(); old.settlement.jobs[0].frames[0].promptVersion = "cl-b-settlement-4"; f.restore(old);
  await f.settlement.begin(task, { id: "legacy-response", model: "mock", connectionHash: "3".repeat(64), at: 5 });
  await f.settlement.result({ jobId: task, attemptId: "legacy-response", output: JSON.stringify(emptySettlementProposal(packet.input)), usage: emptyUsage(), at: 6 });
  await f.settlement.apply(task);
  const saved = f.raw(); expect(saved.nodes.jobs[0].status).toBe("open"); f.restore(saved);
  await f.nodes.complete(id);
  expect(f.raw().nodes.jobs[0].status).toBe("completed");
  expect(f.raw().settlement.jobs).toEqual(saved.settlement.jobs);
  expect(f.raw().settlement.receipts).toEqual(saved.settlement.receipts);
  expect(f.raw().nodes.jobs[0].frame).toEqual(saved.nodes.jobs[0].frame);
}, 25000);

it("only tolerates the two known additions on old frames, never altered evidence or sources", async () => {
  const f = await nodeFixture(), id = f.raw().nodes.jobs[0].id;
  await mockNodeText(f, id); await readAndChooseNode(f, id);
  const packet = await f.nodes.settlementInput(id), frame = createSettlementFrame(packet.input, packet.materials);
  expect(sameNodeSettlementSources(frame, packet)).toBe(true);
  const old = cloneLow(frame); old.promptVersion = "cl-b-settlement-4"; delete old.materials.checkpoint;
  const fact = old.materials.evidence.find(e => e.sourceId.startsWith("program:state:"))!;
  const value = JSON.parse(fact.text); delete value.objectiveProgress; fact.text = canonicalJson(value); fact.digest = nodeTextDigest(fact.text);
  expect(sameNodeSettlementSources(old, packet)).toBe(true);
  for (const change of [
    (x: typeof old) => { x.promptVersion = frame.promptVersion; },
    (x: typeof old) => { x.materials.cards[0].text += "changed card"; },
    (x: typeof old) => { x.materials.evidence.find(e => e.sourceId.startsWith("read:"))!.text += "changed dialogue"; },
    (x: typeof old) => { x.input.evidence[0].head.revision++; },
    (x: typeof old) => { const m = x.materials.evidence[0], data = JSON.parse(m.text); data.layer = 9; m.text = canonicalJson(data); m.digest = nodeTextDigest(m.text); },
    (x: typeof old) => { x.materials.evidence.pop(); },
  ]) { const bad = cloneLow(old); change(bad); expect(sameNodeSettlementSources(bad, packet)).toBe(false); }
}, 20000);
