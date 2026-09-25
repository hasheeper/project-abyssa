import { expect, it } from "vitest";
import { nodeFixture, mockNodeText, readAndChooseNode, mockNodeSettlement } from "../testing/airp-node-fixture";

it("carries every actual pre-departure read original into node writing, with its original audience", async () => {
  const f = await nodeFixture({ commission: true }), s = await f.nodes.read();
  const originals = s.plan.frames.at(-1)!.context.sources.filter(source => source.kind === "read");
  expect(originals.length).toBeGreaterThan(0);
  const id = s.ledger.jobs[0].id; await mockNodeText(f, id);
  const frame = f.raw().nodes.jobs[0].frame!, history = JSON.parse(frame.scene.userInput);
  const current = JSON.parse(frame.scene.currentTurn!.split("\n").at(-1)!).currentProgram;
  expect(current.objectiveProgress).toEqual(s.program.objectiveProgress);
  expect(current.objectiveProgress).toEqual([expect.objectContaining({ conditionMet: false, evidenceId: null, returned: false, noAdditionalReward: true })]);
  expect(history.beforeDepartureRead).toEqual(originals.map(({ id, text, phase, knownBy }) => ({ sourceId: id, text, phase, knownBy })));
  for (const original of originals) expect(frame.messages.some(m => m.content.includes(JSON.stringify(original.text).slice(1, -1)))).toBe(true);
  expect(history.beforeDepartureRead.some((r: { knownBy: string[] }) => r.knownBy.includes("elora"))).toBe(true);
  expect(history).not.toHaveProperty("gmProposal");
  await readAndChooseNode(f, id); await mockNodeSettlement(f, id);
  const saved = f.raw(); f.restore(saved);
  expect((await f.nodes.read()).ledger.jobs[0].status).toBe("completed");
  expect(f.raw().nodes.jobs[0].frame).toEqual(frame);
}, 30000);
