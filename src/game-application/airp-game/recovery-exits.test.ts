import { expect, it } from "vitest";
import { formalAirpFixture, formalNodeText, formalRead } from "../testing/airp-game-fixture";
import { airpGameView } from "../../game-runtime/airp-game-runtime";
import { nextD5PlayCommand } from "../testing/d5-playthrough";
import { AIRP_GAME_CATALOG } from "../../game-runtime/airp-game-context";
import { emptyUsage } from "../airp-generation/contracts";
import { readD5Archive } from "../versions/d5-validate";
import { D5_RUN_READERS } from "../../game-core/session";

async function started(program = false) {
  const f = await formalAirpFixture(), planId = await f.prepare(false, program), permit = await f.flow.gm.departurePermit(planId);
  await f.send({ type: "start-expedition", ...permit.departure }); await f.flow.sync();
  return { ...f, nodeId: airpGameView(f.raw())!.node!.id };
}
async function readable(f: Awaited<ReturnType<typeof started>>) { await formalNodeText(f, f.nodeId); await formalRead(f, f.nodeId); }
async function checkArchive(f: Awaited<ReturnType<typeof started>>) {
  const exported = await f.runtime.application.exportSave("formal-airp"); if (!exported.ok) throw Error("export failed");
  expect(readD5Archive(exported.archive, AIRP_GAME_CATALOG, D5_RUN_READERS)).toEqual(f.raw());
}
it("real wipe closes the action wait without inventing success, then permits the next expedition", async () => {
  const f = await started(true); await readable(f);
  let count = 0;
  while (count++ < 160) {
    const run = f.raw().snapshot.run; if (!run || run.kind !== "expedition" || run.state.node === "finished") break;
    await f.send(nextD5PlayCommand(AIRP_GAME_CATALOG, f.raw(), true)); await f.flow.sync();
    if (count % 8 === 0) await new Promise(resolve => setTimeout(resolve, 0));
  }
  const s = await f.flow.nodes.read();
  expect(s.program.terminal).toBe("wipe"); expect(s.program.actions).toHaveLength(0);
  expect(airpGameView(f.raw())).toMatchObject({ node: { id: f.nodeId }, boundary: true });
  expect((await f.flow.nodes.settlementInput(f.nodeId)).materials.evidence.some(e => e.text.includes('"actualOutcome":"wipe"'))).toBe(true);
  await f.flow.useProgramFacts(f.nodeId); await f.flow.sync();
  await f.send(nextD5PlayCommand(AIRP_GAME_CATALOG, f.raw())); await f.flow.sync();
  expect(f.raw().snapshot.run).toBeNull();
  f.departure.runId = "formal-run:2"; await f.prepare(); await checkArchive(f);
}, 120000);

it("explicit connection change preserves originals and authorizes only the failed stage", async () => {
  const f = await started(); await f.flow.nodes.open(f.nodeId);
  await f.flow.nodes.begin(f.nodeId, { id: "old", stage: "writing", model: "wrong-id", connectionHash: "1".repeat(64), at: 1 });
  await expect(f.flow.nodes.changeConnection(f.nodeId, "writing", "2".repeat(64))).rejects.toThrow();
  await f.flow.nodes.interrupt(f.nodeId, "old", 2);
  const next = { id: "new", stage: "writing" as const, model: "fixed-id", connectionHash: "2".repeat(64), at: 3 };
  await expect(f.flow.nodes.begin(f.nodeId, next)).rejects.toThrow(/silently/);
  await f.flow.nodes.changeConnection(f.nodeId, "writing", next.connectionHash);
  await f.flow.nodes.begin(f.nodeId, next);
  expect((await f.flow.nodes.read()).ledger.jobs[0].attempts[0]).toMatchObject({ model: "wrong-id", status: "interrupted", connectionHash: "1".repeat(64) });
  await checkArchive(f);
}, 20000);

it("facts-only recovery retains failed assessment, makes no effects, replays and is idempotent", async () => {
  const f = await started(); await readable(f); const id = await f.flow.settle(f.nodeId);
  await f.flow.settlement.begin(id, { id: "failed", model: "mock", connectionHash: "3".repeat(64), at: 5 });
  await expect(f.flow.useProgramFacts(f.nodeId)).rejects.toThrow();
  await f.flow.settlement.result({ jobId: id, attemptId: "failed", output: "invalid raw response", usage: emptyUsage(), at: 6 });
  await expect(f.send(nextD5PlayCommand(AIRP_GAME_CATALOG, f.raw()))).rejects.toThrow(/结算/);
  await f.flow.useProgramFacts(f.nodeId);
  const saved = f.raw(), job = saved.airpGame!.settlement.jobs[0];
  expect(job).toMatchObject({ mode: "program-only", status: "applied", fallback: { reason: "player-facts-only" } });
  expect(job.attempts[0].output).toBe("invalid raw response");
  expect(saved.airpGame!.settlement.receipts[0].effects).toEqual([]);
  expect(job.frames[0].input.evidence.some(s => s.kind === "read-paragraph")).toBe(true);
  await f.flow.settlement.useProgramFacts(id); await f.flow.settlement.apply(id); await f.flow.nodes.complete(f.nodeId);
  await f.flow.useProgramFacts(f.nodeId);
  expect(f.raw()).toEqual(saved); await checkArchive(f);
  await f.send(nextD5PlayCommand(AIRP_GAME_CATALOG, f.raw()));
}, 25000);

it("resumes an applied settlement whose node completion was interrupted without enqueuing another input", async () => {
  const f = await started(); await readable(f); const id = await f.flow.settle(f.nodeId);
  await f.flow.settlement.useProgramFacts(id); await f.flow.settlement.apply(id);
  expect((await f.flow.nodes.read()).ledger.jobs[0].status).toBe("open");
  const saved = f.raw().airpGame!.settlement;
  expect(await f.flow.settle(f.nodeId)).toBe(id);
  expect(f.raw().airpGame!.settlement).toEqual(saved);
  await f.flow.nodes.complete(f.nodeId); await f.flow.sync();
  expect((await f.flow.nodes.read()).ledger.jobs[0].status).toBe("completed");
  expect(f.raw().airpGame!.settlement.receipts).toHaveLength(1);
  await checkArchive(f); await f.send(nextD5PlayCommand(AIRP_GAME_CATALOG, f.raw()));
}, 25000);
