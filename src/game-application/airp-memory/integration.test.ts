import { expect, it } from "vitest";
import { formalAirpFixture } from "../testing/airp-game-fixture";
import { directorPlan, directorOutput } from "../testing/airp-director-playthrough";
import { directorTestMaterial } from "../testing/airp-director-fixture";
import { lowR8Source } from "../../content/presentation/airp/low-r8-source";
import { emptyUsage } from "../airp-generation/contracts";
import { emptySettlementProposal, compileSettlementRequest } from "../airp-settlement/context";
import { recordMemoryContext } from "./d5";
import { effectiveThreads, memoryHash } from "./effective";
import { compileDirectorJob } from "../airp-director/jobs";
import { clcProposal } from "../testing/airp-expedition-gm-fixture";
import { readD5Archive } from "../versions/d5-validate";
import { AIRP_GAME_CATALOG } from "../../game-runtime/airp-game-context";
import { D5_RUN_READERS } from "../../game-core/session";
import { pendingHomeBoundary } from "../airp-game/home";
import type { MemoryChange, MemoryContext } from "./contracts";
import { directorCallLog, serializeCallLog } from "../../game-runtime/airp-call-log";
import { createDirectorDriver, type DirectorDriverPort } from "../../game-runtime/airp-director-driver";

/** Incorrect memory is an explicit mock settlement, not a claimed real-model incident. */
async function setup() {
  const f = await formalAirpFixture(); await f.flow.sync();
  const material = directorTestMaterial(), wf = {read: async () => f.raw(), send: f.send};
  await f.send({type: "airp-director-configure", material, lowMaterial: lowR8Source, lowReadVersion: 5, lowContextVersion: 10});
  await directorPlan(wf, {kind: "fixed", definitionId: "ripple.kororo.quiet-cup"});
  await f.send({type: "advance-phase"}); await f.send({type: "advance-phase"});
  const eventId = f.raw().airpDirector!.events[0].id;
  async function legacyScene() {
    await f.send({type: "airp-director-open", eventId});
    let job = f.raw().airpDirector!.jobs.at(-1)!;
    const lines = [{speaker: "kororo", emotion: "neutral", text: "这次就这样吧。"}];
    job = await directorOutput(wf, job, "writing", "柯萝萝：这次就这样吧。");
    job = await directorOutput(wf, job, "formatting", JSON.stringify({lines, choices: ["认真听", "轻松回应", "保留意见"]}));
    await f.send({type: "airp-director-show", jobId: job.id});
    await f.send({type: "airp-director-respond", jobId: job.id, index: 0});
    await f.send({type: "airp-director-read", jobId: job.id, cursor: 0});
  }
  await legacyScene(); await f.send({type: "airp-director-choose", eventId, choiceId: "participate"}); await legacyScene(); await f.flow.sync();
  const id = await f.flow.settleHome(), job = (await f.flow.settlement.read()).ledger.jobs.find(j => j.id === id)!;
  const p = emptySettlementProposal(job.frames[0].input), basis = job.frames[0].input.evidence.find(e => e.role === "current" && e.kind === "program-fact")!;
  const point = {kind: "fact" as const, text: "模拟错误：小景尚未结束。", speakerId: null, knownBy: ["kael"], basisIds: [basis.id]};
  p.memory.points = [point, {...point}, {...point, text: "模拟：尚待本次答复。"}];
  p.memory.open = [{...point, text: "模拟重复待办：等待小景收尾。", key: "close-vignette", until: "resolved"}, {...point, text: "模拟：确认后续答复。", key: "later-answer", until: "resolved"}];
  await f.flow.settlement.begin(id, {id: "mock-bad-memory", model: "mock", connectionHash: "3".repeat(64), at: 1});
  await f.flow.settlement.result({jobId: id, attemptId: "mock-bad-memory", output: JSON.stringify(p), usage: emptyUsage(), at: 2});
  await f.flow.settlement.apply(id);
  const originalLedger = f.raw().airpGame!.settlement;
  await f.send({type: "airp-director-pause"});
  await f.send({type: "airp-director-configure", material, lowMaterial: lowR8Source, lowReadVersion: 6, lowContextVersion: 19});
  return {...f, wf, material, eventId, originalLedger};
}
const change = (context: MemoryContext, kind: MemoryChange["kind"], id: string, text?: string): MemoryChange => ({kind, targetId: id, expectedHash: context.targets.find(t => t.id === id)!.hash, ...(text ? {text} : {})});

it("S3 day correction → scene read activation → next scene → expedition GM → original save replay", async () => {
  const f = await setup();
  while (f.raw().snapshot.campaign.clock.day < 2) await f.send({type: "advance-phase"});
  await f.send({type: "airp-director-prepare-day"});
  let day = f.raw().airpDirector!.jobs.at(-1)!;
  const m = day.gmContext!.memoryContext!, summaries = m.targets.filter(t => t.kind === "summary"), threads = m.targets.filter(t => t.kind === "thread");
  expect(summaries).toHaveLength(3); expect(threads).toHaveLength(2);
  const proposal = {version: 1, day: 2, reason: "模拟日度", focus: {kind: "new", id: "entry"}, entries: [{id: "entry", fromPhase: 6, throughPhase: 7, basisIds: [day.planning!.world.sourceIds[0]], source: {kind: "fixed", definitionId: "ripple.elora.old-medicine-case"}}], memoryCorrections: [
    {reason: "实际小景已经结束", basisIds: [`resolved:${f.eventId}`], changes: [change(m, "replace-summary", summaries[0].id, "已确认：小景已经结束。"),
      {...change(m, "merge-summary", summaries[1].id), duplicateOf: {targetId: summaries[0].id, expectedHash: summaries[0].hash}}, change(m, "close-thread", threads[0].id)]},
    {reason: "无效更正不能卡住日度", basisIds: ["invented"], changes: [change(m, "close-thread", threads[1].id)]},
  ]};
  day = await directorOutput(f.wf, day, "director", JSON.stringify(proposal));
  expect(day.memoryCorrections?.map(c => c.error)).toEqual([null, expect.any(String)]);
  await f.send({type: "airp-director-accept-day", jobId: day.id});
  const view = recordMemoryContext(f.raw())!;
  expect(view.targets.map(t => t.value.text)).not.toContain(summaries[0].value.text);
  expect(effectiveThreads(view)).toHaveLength(1);
  expect(f.raw().airpGame!.settlement.memories).toEqual(f.originalLedger.memories);
  expect(f.raw().airpGame!.settlement.receipts).toEqual(f.originalLedger.receipts);
  await f.send({type: "advance-phase"}); await f.send({type: "advance-phase"});
  const eventId = f.raw().airpDirector!.events.find(e => e.card.giverId === "elora")!.id;
  await f.send({type: "airp-director-open", eventId});
  let scene = f.raw().airpDirector!.jobs.at(-1)!;
  expect(scene.gmContext!.memoryContext!.targets).toEqual(view.targets);
  const lines = [{speaker: "elora", emotion: "neutral", text: "这件事我已经答复过了。"}, {speaker: "elora", emotion: "neutral", text: "现在听听你的意思。"}];
  scene = await directorOutput(f.wf, scene, "writing", lines.map(l => `艾洛拉：${l.text}`).join("\n"));
  scene = await directorOutput(f.wf, scene, "formatting", JSON.stringify({lines, choices: ["认真倾听", "轻松回应", "有所保留"]}));
  const context = scene.gmContext!.memoryContext!;
  const evaluation = {complete: false, reason: "等待真实表态", unresolved: ["回应"], next: {pacing: "brief", suggestedWords: 80, focus: "回应新表态", alreadyCovered: [], stopWhen: "回应完毕", reason: "简短回应"}, memoryCorrections: [
    {reason: "当前当面答复", basisIds: [`current:${scene.id}:0`], changes: [change(context, "replace-summary", summaries[2].id, "已收到当面答复。"), change(context, "close-thread", threads[1].id)]},
  ]};
  scene = await directorOutput(f.wf, scene, "scene-evaluate", JSON.stringify(evaluation));
  const pendingId = scene.memoryCorrections![0].id;
  expect(recordMemoryContext(f.raw())!.diagnostics.find(d => d.id === pendingId)?.status).toBe("pending");
  expect(serializeCallLog(directorCallLog(scene, f.material, recordMemoryContext(f.raw())!.diagnostics))).toContain('"status": "pending"');
  const unread = await f.runtime.application.exportSave("formal-airp"); if (!unread.ok) throw Error("export");
  f.database.records.set("formal-airp", readD5Archive(unread.archive, AIRP_GAME_CATALOG, D5_RUN_READERS));
  expect(recordMemoryContext(f.raw())!.diagnostics.find(d => d.id === pendingId)?.status).toBe("pending");
  await f.send({type: "airp-director-show", jobId: scene.id});
  await f.send({type: "airp-director-read", jobId: scene.id, cursor: 0});
  expect(effectiveThreads(recordMemoryContext(f.raw())!)).toHaveLength(1);
  const half = await f.runtime.application.exportSave("formal-airp"); if (!half.ok) throw Error("export");
  expect(readD5Archive(half.archive, AIRP_GAME_CATALOG, D5_RUN_READERS)).toEqual(f.raw());
  f.database.records.set("formal-airp", readD5Archive(half.archive, AIRP_GAME_CATALOG, D5_RUN_READERS));
  expect(effectiveThreads(recordMemoryContext(f.raw())!)).toHaveLength(1);
  await f.send({type: "airp-director-respond", jobId: scene.id, index: 0});
  await f.send({type: "airp-director-read", jobId: scene.id, cursor: 1});
  const next = f.raw().airpDirector!.jobs.at(-1)!;
  expect(next.id).not.toBe(scene.id);
  expect(effectiveThreads(next.gmContext!.memoryContext!)).toEqual([]);
  expect(next.gmContext!.memoryContext!.targets.find(t => t.id === summaries[2].id)?.value.text).toBe("已收到当面答复。");
  expect(next.gmContext!.memoryContext!.targets.find(t => t.id === summaries[2].id)?.value).toMatchObject({kind: "record", claims: [{speakerId: "elora", sourceId: `current:${scene.id}:0`}]});
  expect(serializeCallLog(directorCallLog(scene, f.material, recordMemoryContext(f.raw())!.diagnostics))).toContain('"status": "applied"');
  expect(compileDirectorJob(f.material, next).messages.map(m => m.content).join("\n")).not.toContain("模拟错误：小景尚未结束");
  await f.send({type: "airp-director-pause"});
  const planId = await f.flow.prepare(f.departure), expedition = await f.flow.gm.read(), p = clcProposal(expedition);
  expect(expedition.context.gmContext!.memoryContext!.targets).toEqual(recordMemoryContext(f.raw())!.targets);
  expect(expedition.context.memories.flatMap(m => m.points).map(p => p.text)).not.toContain("模拟错误：小景尚未结束。");
  expect(expedition.context.openThreads).toEqual([]);
  const target = expedition.context.gmContext!.memoryContext!.targets[0];
  const output = {...p, memoryCorrections: [{reason: "副本前补清摘要", basisIds: [`resolved:${f.eventId}`], changes: [change(expedition.context.gmContext!.memoryContext!, "replace-summary", target.id, "该小景已结束，不需要再次收尾。")]}]};
  await f.flow.gm.begin(planId, {id: "s3-expedition", stage: "plan", model: "mock", connectionHash: "4".repeat(64), at: 3});
  await f.flow.gm.result(planId, "s3-expedition", JSON.stringify(output), emptyUsage(), 4);
  const before = memoryHash(f.raw()); await f.flow.gm.read(); expect(memoryHash(f.raw())).toBe(before);
  expect(recordMemoryContext(f.raw())!.targets[0].value.text).toBe("该小景已结束，不需要再次收尾。");
  await f.flow.gm.refresh(planId);
  const refreshed = (await f.flow.gm.read()).ledger.jobs.find(j => j.id === planId)!;
  expect(refreshed.frames).toHaveLength(2);
  expect(refreshed.frames[1].context.gmContext!.memoryContext!.targets[0].value.text).toBe("该小景已结束，不需要再次收尾。");
  expect(refreshed.memoryCorrections).toHaveLength(1);
  await f.flow.gm.cancel(planId);
  expect(recordMemoryContext(f.raw())!.targets[0].value.text).toBe("该小景已结束，不需要再次收尾。");
  const exported = await f.runtime.application.exportSave("formal-airp"); if (!exported.ok) throw Error("export");
  expect(readD5Archive(exported.archive, AIRP_GAME_CATALOG, D5_RUN_READERS)).toEqual(f.raw());
  expect(f.raw().airpGame!.settlement.memories).toEqual(f.originalLedger.memories);
  expect(f.raw().airpGame!.settlement.receipts).toEqual(f.originalLedger.receipts);
}, 120000);

it("S3 settlement host exposes effective memory without changing old request/ledger", async () => {
  const f = await setup(), record = f.raw();
  const snapshot = await f.flow.settlement.read();
  expect(snapshot.memoryView!.targets).toEqual(recordMemoryContext(record)!.targets);
  expect(snapshot.ledger.openThreads).toEqual(record.airpGame!.settlement.openThreads);
  expect(pendingHomeBoundary(record)).toBeNull();
  const original = f.originalLedger.jobs[0].frames[0];
  expect(compileSettlementRequest(original, 0).messages.map(m => m.content).join("\n")).not.toContain("memoryView");
}, 60000);

it.each([false, true])("S4 GM corrections survive result save failure (committed=%s), retry without a model and replay once", async after => {
  const f = await setup();
  while (f.raw().snapshot.campaign.clock.day < 2) await f.send({type: "advance-phase"});
  await f.send({type: "airp-director-prepare-day"});
  const day = f.raw().airpDirector!.jobs.at(-1)!, context = day.gmContext!.memoryContext!;
  const target = context.targets.find(t => t.kind === "summary")!, thread = context.targets.find(t => t.kind === "thread")!;
  const output = JSON.stringify({version: 1, day: 2, reason: "模拟恢复验收", focus: {kind: "new", id: "entry"}, entries: [{id: "entry", fromPhase: 6, throughPhase: 7,
    basisIds: [day.planning!.world.sourceIds[0]], source: {kind: "fixed", definitionId: "ripple.elora.old-medicine-case"}}], memoryCorrections: [
    {reason: "已结束的小景不再待办", basisIds: [`resolved:${f.eventId}`], changes: [change(context, "replace-summary", target.id, "小景已经结束。"), change(context, "close-thread", thread.id)]},
  ]});
  let failed = false, calls = 0;
  const port: DirectorDriverPort = {read: async () => ({head: f.raw().head, ...f.raw().airpDirector!}), async commit(command) {
    if (command.type === "airp-director-result" && !failed) {
      failed = true;
      if (after) await f.send(command);
      throw Error("simulated storage failure");
    }
    await f.send(command); return this.read();
  }};
  const driver = createDirectorDriver({lock: async (_k, _s, op) => op(), provider: async () => {calls++; return {text: output, usage: emptyUsage(), finishReason: "stop"};}});
  const connection = {models: f.material.models, keys: {planning: "test-only-secret", writing: "test-only-secret", updater: "test-only-secret"}};
  await driver.run(port, day.id, connection);
  expect(driver.getSnapshot().pendingResult).toBe(true);
  expect(JSON.parse(driver.exportPending()).pending.command.output).toBe(output);
  const savedJob = () => f.raw().airpDirector!.jobs.find(j => j.id === day.id)!;
  expect(savedJob().memoryCorrections?.length ?? 0).toBe(after ? 1 : 0);
  expect(effectiveThreads(recordMemoryContext(f.raw())!)).toHaveLength(after ? 1 : 2);
  await driver.retryCommit(port); await driver.retryCommit(port); await driver.run(port, day.id, connection);
  expect(calls).toBe(1); expect(driver.getSnapshot()).toMatchObject({phase: "saved", pendingResult: false, error: null});
  expect(savedJob().attempts).toHaveLength(1); expect(savedJob().memoryCorrections).toHaveLength(1);
  expect(savedJob().gmContext).toEqual(day.gmContext);
  expect(effectiveThreads(recordMemoryContext(f.raw())!)).toHaveLength(1);
  const exported = await f.runtime.application.exportSave("formal-airp"); if (!exported.ok) throw Error("export");
  f.database.records.set("formal-airp", readD5Archive(exported.archive, AIRP_GAME_CATALOG, D5_RUN_READERS));
  expect(recordMemoryContext(f.raw())!.targets.find(t => t.id === target.id)?.value.text).toBe("小景已经结束。");
  expect(f.raw().airpGame!.settlement.memories).toEqual(f.originalLedger.memories);
  expect(f.raw().airpGame!.settlement.receipts).toEqual(f.originalLedger.receipts);
}, 60000);
