import { describe, expect, it } from "vitest";
import { performance } from "node:perf_hooks";
import { directMaterial, directReturnGate, prepareDirect, simulateDirectStage } from "./airp-direct-playthrough";
import { poolTestRuntime, readPoolConversation } from "./airp-pool-playthrough";
import { compileDirectInput, directOutput } from "../airp-direct-gameplay/compile";
import { hash } from "../airp-generation/contracts";
import { parseAirpDirectCommand, parseDirectMaterial } from "../airp-direct-gameplay/parse";
import { parseUpdateProposal, updaterInput, type ReadText } from "../airp-direct-gameplay/updater";
import type { D5GameRecord } from "../index";
import { inspectDirectAttempt } from "../airp-direct-gameplay/inspection";
import { writingEnvelope } from "./airp-writing-fixture";

const dialogue = "「よければ、私が見ましょうか。（如果您愿意，我可以替您看看。）」";
const prose = `箱子停在桌边。\n${dialogue}`;
const formatted = JSON.stringify({creationRecord: "逐段保留原文。", lines: [{speaker: "narrator", emotion: "neutral", text: "箱子停在桌边。"}, {speaker: "elora", emotion: "confident", text: dialogue}]});
const followupDialogue = "「道のことは、次も気をつけて見てくださいね。（路线的事，下次也请多留意些。）」";
const followupProse = `艾洛拉望向旁边的空位。\n${followupDialogue}`;
const followupFormatted = JSON.stringify({creationRecord: "逐段保留原文。", lines: [{speaker: "narrator", emotion: "neutral", text: "艾洛拉望向旁边的空位。"}, {speaker: "elora", emotion: "serious", text: followupDialogue}]});
async function reject(f: ReturnType<typeof poolTestRuntime>, command: unknown) {
  const before = await f.read();
  const result = await f.runtime.application.dispatch({protocolVersion: 4, saveId: before.head.saveId, expectedHead: before.head, clientRequestId: `reject:${hash([before.head, command]).slice(0, 32)}`, command});
  expect(result.ok).toBe(false); expect(await f.read()).toEqual(before); return result;
}
async function restore(record: D5GameRecord) {
  const f = poolTestRuntime();
  const result = await f.runtime.application.restoreSave({archive: JSON.stringify({archiveVersion: 4, record}), clientRequestId: "restore"});
  expect(result).toMatchObject({ok: true}); expect(await f.read()).toEqual(record);
  // A newly opened client must allocate fresh request IDs, not restart the fixture's counter at zero.
  return poolTestRuntime(await f.read());
}

describe("content18 browser-direct application rules (simulated model output)", () => {
  it.each(["extracted", "cleared"] as const)("runs %s actual patrol → persisted stages → read/turn-in → memory → followup → safe copy", async outcome => {
    let f = await directReturnGate(outcome);
    const gate = await f.read(), task = gate.airpDirect!.tasks[0], sceneId = task.sceneId, instanceId = task.instanceId;
    expect(gate.snapshot.campaign.manor.takeover).toBeNull();
    await reject(f, {type: "airp-read", instanceId, sceneId, nodeId: gate.narrative.scenes.find(s => s.id === sceneId)!.body.nodes[0].id});
    // Both assembly revisions must retain identical stage/restore guarantees.
    const frozenMaterial = {...directMaterial(), version: outcome === "extracted" ? 1 as const : 2 as const};
    await prepareDirect(f, frozenMaterial);
    let r = await f.read(), frozen = r.airpDirect!.tasks[0];
    expect(frozen.context).toMatchObject({sourceKind: "gameplay", task: "return", phase: 1, playerName: "林恩", proof: {outcome}});
    expect(frozen.context!.proof.sourceFactIds.every(id => r.facts.some(f => f.id === id))).toBe(true);
    const material = r.airpDirect!.materials[frozen.materialHash!], input = compileDirectInput(material, frozen.context!, frozen, "planning");
    for (const source of material.resources.sources) expect(input.messages.some(m => m.content.includes(source.text))).toBe(true);
    expect(JSON.stringify(input.messages)).not.toContain("作者试读样例");
    await simulateDirectStage(f, "planning", "第一段，第二段，第三段：模拟规划。");
    const planned = await f.read();
    f = await restore(planned);
    expect(directOutput((await f.read()).airpDirect!.tasks[0], "planning")).not.toBe("");
    await reject(f, {type: "airp-direct-begin", sceneId, stage: "planning", attemptId: "duplicate-stage", at: 10000});
    await simulateDirectStage(f, "writing", prose);
    const written = (await f.read()).airpDirect!.tasks[0];
    expect(directOutput(written, "writing")).toBe(writingEnvelope(prose));
    expect(JSON.parse(compileDirectInput(material, written.context!, written, "formatting").messages[1].content).draft).toBe(prose);
    await simulateDirectStage(f, "formatting", "invalid JSON");
    expect((await f.read()).airpDirect!.tasks[0].attempts.at(-1)).toMatchObject({status: "failed", error: "invalid-output", output: "invalid JSON"});
    r = await simulateDirectStage(f, "formatting", formatted);
    expect(r.narrative.scenes.find(s => s.id === sceneId)?.source).toBe("browser-direct");
    expect(r.snapshot).toEqual(gate.snapshot);
    expect(r.airpDirect!.memories).toEqual([]);
    const unreadView = f.runtime.queries.narrative(r);
    expect(unreadView?.version === 2 && unreadView.entries.flatMap(e => e.history).find(s => s.id === sceneId)?.transcript).toEqual([]);
    await reject(f, {type: "airp-direct-begin", sceneId, stage: "updater", attemptId: "unread", at: 10000});
    const scene = r.narrative.scenes.find(s => s.id === sceneId)!;
    expect(JSON.stringify(scene.body)).not.toContain("EDITORIAL_ONLY");
    await f.send({type: "airp-read", instanceId, sceneId, nodeId: scene.body.nodes[0].id});
    f = await restore(await f.read());
    expect((await f.read()).narrative.reading?.node).toBe(1);
    expect((await f.read()).airpDirect!.memories).toEqual([]);
    await readPoolConversation(f);
    await reject(f, {type: "airp-direct-begin", sceneId, stage: "updater", attemptId: "not-delivered", at: 10000});
    await f.send({type: "airp-turn-in", instanceId});
    const delivered = await f.read();
    expect(delivered.narrative.memories).toHaveLength(1);
    await simulateDirectStage(f, "updater", JSON.stringify({summary: "无证据", supports: ["foreign-line"], flags: []}));
    expect((await f.read()).snapshot).toEqual(delivered.snapshot);
    expect((await f.read()).airpDirect!.memories).toEqual([]);
    await reject(f, {type: "airp-direct-followup", instanceId});
    r = await simulateDirectStage(f, "updater", JSON.stringify({summary: "艾洛拉提出检查的邀请，尚待回应。", supports: [scene.body.nodes[1].id], flags: [{key: "careOffered", value: true, supports: [scene.body.nodes[1].id]}]}));
    expect(r.airpDirect!.memories).toHaveLength(1);
    expect(r.airpDirect!.flags[instanceId]).toEqual({careOffered: true, routeCautionMentioned: false});
    expect(r.snapshot).toEqual(delivered.snapshot);
    await f.send({type: "airp-direct-followup", instanceId});
    await prepareDirect(f, frozenMaterial); r = await f.read(); frozen = r.airpDirect!.tasks[1];
    expect(Object.keys(r.airpDirect!.materials)).toHaveLength(1);
    expect(frozen.context!.parent).toMatchObject({prose, sceneId, memoryId: r.airpDirect!.memories[0].id});
    expect(JSON.stringify(compileDirectInput(material, frozen.context!, frozen, "planning"))).not.toContain("EDITORIAL_ONLY");
    expect(frozen.context!.proof.outcome).toBe(outcome);
    expect(frozen.context!.gameMemories).toHaveLength(1);
    await simulateDirectStage(f, "planning", "三段式后续模拟规划。");
    await simulateDirectStage(f, "writing", followupProse);
    await simulateDirectStage(f, "formatting", followupFormatted);
    await readPoolConversation(f); r = await f.read();
    const followup = r.narrative.scenes.find(s => s.id === frozen.sceneId)!;
    await simulateDirectStage(f, "updater", JSON.stringify({summary: "艾洛拉提醒下次继续留意路线，不断言全线状态。", supports: [followup.body.nodes[1].id], flags: [{key: "routeCautionMentioned", value: true, supports: [followup.body.nodes[1].id]}]}));
    r = await f.read();
    expect(r.airpDirect!.memories).toHaveLength(2); expect(r.narrative.memories).toHaveLength(1);
    expect(r.airpDirect!.flags[instanceId]).toEqual({careOffered: true, routeCautionMentioned: true});
    for (const task of r.airpDirect!.tasks) for (const attempt of task.attempts) {
      const inspected = inspectDirectAttempt(r, task.sceneId, attempt.id);
      expect(inspected.inputHash).toBe(attempt.inputHash);
      expect(JSON.stringify(inspected.input)).not.toContain("EDITORIAL_ONLY");
    }
    expect(JSON.stringify(r.airpDirect!.memories)).not.toContain("EDITORIAL_ONLY");
    await reject(f, {type: "airp-direct-followup", instanceId});
    await reject(f, {type: "airp-direct-begin", sceneId: frozen.sceneId, stage: "updater", attemptId: "repeat-update", at: 100000});
    const before = performance.now(); f = await restore(r);
    const replayMs = performance.now() - before;
    // Explicitly decline other offers; do not erase them to make copying pass.
    for (let i = 0; i < 12; i++) {
      const other = (await f.read()).narrative.instances.find(i => i.status === "pending" || i.status === "offered");
      if (!other) break;
      await f.send({type: "airp-open", instanceId: other.id}); await f.send({type: "airp-decline", instanceId: other.id}); await readPoolConversation(f);
    }
    const archive = await f.runtime.application.exportSave("pool"); if (!archive.ok) throw Error("export");
    expect(await f.runtime.application.importSave({saveId: "copy", epoch: "copy-epoch", clientRequestId: "safe-copy", archive: archive.archive})).toMatchObject({ok: true});
    const copy = await f.runtime.application.open("copy");
    if (!copy.ok || copy.record.schemaVersion !== 4) throw Error("copy");
    expect(copy.record.airpDirect).toEqual((await f.read()).airpDirect);
    expect(copy.record.airpDirect!.memories[0].source.saveId).toBe("pool");
    const archiveBytes = Buffer.byteLength(archive.archive), copyBytes = Buffer.byteLength(JSON.stringify(copy.record));
    expect(archiveBytes).toBeLessThan(8 * 1024 * 1024); expect(copyBytes).toBeLessThan(8 * 1024 * 1024);
    console.info(`P2 offline ${outcome}: archive=${archiveBytes} bytes, copy=${copyBytes} bytes, full replay=${Math.round(replayMs)}ms`);
  }, 240000);

  it("restores frozen resource-3 plain writing without applying the new envelope reader", async () => {
    const f = await directReturnGate("extracted"), material = directMaterial(); material.resources.version = 3;
    await prepareDirect(f, material);
    await simulateDirectStage(f, "planning", "旧三段大纲");
    await simulateDirectStage(f, "writing", prose);
    const record = await simulateDirectStage(f, "formatting", formatted);
    expect(directOutput(record.airpDirect!.tasks[0], "writing")).toBe(prose);
    expect(record.airpDirect!.tasks[0].source).toBe("browser-direct");
    await restore(record);
  }, 120000);

  it("keeps material/schema and updater whitelist strict", () => {
    const material = directMaterial();
    expect(parseDirectMaterial({...material, version: 1}).version).toBe(1);
    expect(parseDirectMaterial(material).version).toBe(2);
    expect(() => parseDirectMaterial({...material, version: 3})).toThrow();
    expect(() => parseDirectMaterial({...material, apiKey: "never-persist"})).toThrow();
    expect(() => parseDirectMaterial({...material, models: {...material.models, planning: {...material.models.planning, baseUrl: "https://example.invalid/v1?key=secret"}}})).toThrow();
    expect(() => parseAirpDirectCommand({type: "airp-direct-prepare", sceneId: "s", materialHash: hash(material), material, proof: {sourceKind: "sample"}})).toThrow();
    const input: ReadText = {lines: [{id: "line-1", speaker: "elora", text: "可要看看？"}], facts: [], memories: [], flags: {careOffered: false, routeCautionMentioned: false}};
    expect(JSON.stringify(updaterInput(input))).not.toContain("冬马和纱");
    for (const patch of [
      {summary: "检查邀请", supports: ["line-1"], flags: [], gold: 1},
      {summary: "检查邀请", supports: ["foreign"], flags: []},
      {summary: "检查邀请", supports: ["line-1"], flags: [{key: "health", value: true, supports: ["line-1"]}]},
    ]) expect(() => parseUpdateProposal(JSON.stringify(patch), input)).toThrow();
  });
});
