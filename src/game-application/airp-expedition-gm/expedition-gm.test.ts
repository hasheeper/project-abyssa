import { describe, expect, it } from "vitest";
import { canonicalJson, sha256 } from "../../game-core/contracts";
import { expeditionPlanHash, validateExpeditionPlan } from "../../game-core/session";
import { emptyUsage } from "../airp-generation/contracts";
import { clcFreeProposal, clcHost, clcPacket, clcProposal } from "../testing/airp-expedition-gm-fixture";
import { cloneExpedition, compileExpeditionRequest, freezeExpeditionFrame } from "./context";
import { createExpeditionGMService, validateExpeditionGMSnapshot } from "./service";

const check = (p = clcProposal(), packet = clcPacket(), review?: unknown) => validateExpeditionPlan(packet.context.rules, p, freezeExpeditionFrame(packet.context, packet.documents, packet.departure).inputHash, review);
const begin = (f: ReturnType<typeof clcHost>, id: string, stage: "plan" | "review" = "plan", n = 1) => f.service.begin(id, { id: `attempt:${n}`, stage, model: "test-gm", connectionHash: "1".repeat(64), at: n * 10 });
async function prepared(free = false) {
  const f = clcHost(), id = await f.service.enqueue(), p = free ? clcFreeProposal(f.packet) : clcProposal(f.packet);
  await begin(f, id); await f.service.result(id, "attempt:1", JSON.stringify(p), emptyUsage(), 11);
  return { ...f, id, p };
}
describe("CL-C isolated pre-departure contract and lifecycle", () => {
  it("keeps full cards and source text, excludes seed/credentials/literary preset", () => {
    const packet = clcPacket(), f = freezeExpeditionFrame(packet.context, packet.documents, packet.departure), request = compileExpeditionRequest(f, 0), body = JSON.parse(request.messages[1].content);
    expect(body.documents[0].text).toBe(packet.documents[0].text); expect(body.context.sources).toEqual(packet.context.sources);
    expect(request.messages[1].content).not.toContain('"seed"'); expect(request.messages[1].content).not.toContain('"preset"');
    expect(body.outputSchema.properties.nodes.items.properties.slotId.enum).toEqual(["slot:1", "slot:2"]);
    expect(request.messages[0].content).toContain("不规定台词、情绪曲线");
  });
  it("shares source-ID constraints while retaining the exact frozen v1 request", () => {
    const packet = clcPacket(), frame = freezeExpeditionFrame(packet.context, packet.documents, packet.departure);
    expect(frame.promptVersion).toBe("cl-c-gm-2");
    const payload = JSON.parse(compileExpeditionRequest(frame, 0).messages[1].content), schema = payload.outputSchema;
    const holders = [schema.properties.focus.properties, ...["nodes", "events", "endings"].map(k => schema.properties[k].items.properties)];
    expect(schema.$defs.sourceBasis).toEqual({ type: "array", items: { enum: packet.context.rules.sourceIds }, maxItems: 64, minItems: 1, uniqueItems: true });
    for (const holder of holders) { expect(holder.basisIds).toEqual({ $ref: "#/$defs/sourceBasis" }); holder.basisIds = cloneExpedition(schema.$defs.sourceBasis); }
    delete schema.$defs;
    const old = cloneExpedition(frame); old.promptVersion = "cl-c-gm-1"; old.outputSchema = schema;
    const messages = [{ role: "system", content: old.instruction }, { role: "user", content: canonicalJson(payload) }];
    old.requestHash = expeditionPlanHash(messages);
    const frozen = canonicalJson(old);
    expect(compileExpeditionRequest(old, 0).messages).toEqual(messages);
    expect(canonicalJson(old)).toBe(frozen);
    schema.properties.focus.properties.basisIds.items.enum.push("invented");
    expect(() => compileExpeditionRequest(old, 0)).toThrow(/Frozen expedition request changed/);
    const future = cloneExpedition(frame); future.promptVersion = "cl-c-gm-999";
    expect(() => compileExpeditionRequest(future, 0)).toThrow(/Frozen expedition request changed/);
  });
  it("rejects missing/changed documents, pending settlement and capacity overflow without trimming", () => {
    const p = clcPacket(); p.documents[0].text = "summary";
    expect(() => freezeExpeditionFrame(p.context, p.documents, p.departure)).toThrow(/full, intact/);
    const missing = clcPacket(); missing.documents.shift(); expect(() => freezeExpeditionFrame(missing.context, missing.documents, missing.departure)).toThrow(/complete actor/);
    const pending = clcPacket(); pending.context.pendingSettlementIds = ["settlement:waiting"]; expect(() => freezeExpeditionFrame(pending.context, pending.documents, pending.departure)).toThrow(/Pending settlement/);
    const large = clcPacket(); large.documents[0].text = "字".repeat(750000); large.documents[0].digest = sha256(large.documents[0].text);
    expect(() => freezeExpeditionFrame(large.context, large.documents, large.departure)).toThrow(/no author source was truncated/);
  });
  it("requires the original commission ID, step, objective slot and return obligations in every ending", () => {
    const packet = clcPacket(true), p = clcProposal(packet); expect(check(p, packet).reservations).toEqual([]);
    const noObjective = cloneExpedition(p); noObjective.nodes[0].link = null; expect(() => check(noObjective, packet)).toThrow(/omitted/);
    const wrong = cloneExpedition(p); wrong.nodes[0].slotId = "slot:2"; expect(() => check(wrong, packet)).toThrow(/moved the author's objective/);
    const closure = cloneExpedition(p); closure.endings[0].returnEventIds = []; expect(() => check(closure, packet)).toThrow(/return\/delivery/);
  });
  it("supports no commission without inventing one, and allows no new event or item", () => {
    const p = clcProposal(); expect(check(p).events).toEqual([]); expect(check(p).itemDefinitions).toEqual([]);
    p.focus = { ...p.focus, kind: "commission", id: "invented" }; expect(() => check(p)).toThrow(/focus/);
  });
  it.each(["actor", "action", "cycle", "foreign-input", "effect-field"])("rejects an invalid %s", type => {
    const p = clcProposal();
    if (type === "actor") p.nodes[0].actorIds.push("absent-npc");
    if (type === "action") p.nodes[0].actionIds.push("spawn-reward");
    if (type === "cycle") p.nodes[0].prerequisites = [{ nodeId: "node:1", outcome: "completed" }];
    if (type === "foreign-input") p.inputHash = "0".repeat(64);
    if (type === "effect-field") Object.assign(p, { affinity: [{ delta: 10 }] });
    expect(() => check(p)).toThrow();
  });
  it("uses the same day ledger, including daily reservations and existing focus", () => {
    const packet = clcPacket(), p = clcFreeProposal(packet);
    packet.context.rules.schedule.reservations = [{ id: "day-light", ownerId: "day-gm", day: 1, load: "light", themeKey: "other", themeDescription: "已有小景", objectIds: [] }];
    p.inputHash = freezeExpeditionFrame(packet.context, packet.documents, packet.departure).inputHash;
    expect(() => check(p, packet)).toThrow(/capacity/);
    packet.context.rules.schedule.reservations = []; packet.context.rules.schedule.budget = { day: 1, publishedIds: ["done"], lightIds: ["done"], focusIds: [] };
    p.inputHash = freezeExpeditionFrame(packet.context, packet.documents, packet.departure).inputHash; expect(() => check(p, packet)).toThrow(/capacity/);
  });
  it("blocks active/cooling themes and uncertain or stale semantic reviews", () => {
    const packet = clcPacket(), p = clcFreeProposal(packet);
    packet.context.rules.schedule.themes.push({ key: "new-theme", description: "同题", objectIds: [], sourceId: "old-event", untilPhase: 258 }); p.inputHash = freezeExpeditionFrame(packet.context, packet.documents, packet.departure).inputHash;
    expect(() => check(p, packet)).toThrow(/cooling/);
    const free = clcFreeProposal(), review = { protocol: 1, proposalHash: expeditionPlanHash(free), decisions: [{ eventKey: "aside", verdict: "uncertain", matchedSourceIds: [], reason: "同题不确定" }] };
    expect(() => check(free, clcPacket(), review)).toThrow(/uncertain/);
    review.decisions[0].verdict = "new"; review.proposalHash = "0".repeat(64); expect(() => check(free, clcPacket(), review)).toThrow(/review/);
  });
  it("cannot call a multi-step task light; new tasks stop at a real choice", () => {
    const p = clcFreeProposal(); if (p.events[0].source.kind !== "free") throw Error();
    p.events[0].source.body.needsReturn = true; expect(() => check(p)).toThrow(/light/);
    p.events[0].source.body.needsReturn = false; p.nodes[0].stop = "scene-end"; expect(() => check(p)).toThrow(/player's choice/);
  });
  it("freezes fixed definitions verbatim and validates asset fields without inventing an inventory", () => {
    const packet = clcPacket(), p = clcFreeProposal(packet), body = p.events[0].source.kind === "free" ? p.events[0].source.body : (() => { throw Error(); })();
    packet.context.rules.fixedEvents = [{ id: "fixed-aside", body, digest: expeditionPlanHash(body), sourceId: "fact:current" }];
    p.events[0].source = { kind: "fixed", definitionId: "fixed-aside" }; p.inputHash = freezeExpeditionFrame(packet.context, packet.documents, packet.departure).inputHash;
    expect(check(p, packet).events[0].body).toEqual(body);
    p.itemDefinitions = [{ key: "note", templateId: "test-template", fields: { name: "开发验证物" } }]; p.nodes[0].itemKeys = ["note"];
    const result = check(p, packet); expect(result.itemDefinitions[0].digest).toMatch(/^[a-f0-9]{64}$/); expect(result).not.toHaveProperty("inventory");
    p.itemDefinitions[0].fields = { price: "999" }; expect(() => check(p, packet)).toThrow(/Asset fields/);
  });
  it("persists model output before adoption; accepted planning does not move actors, spend supplies or award items", async () => {
    const f = await prepared(), before = canonicalJson(f.raw().program);
    expect(f.raw().ledger.jobs[0].status).toBe("ready"); await f.service.accept(f.id);
    expect(canonicalJson(f.raw().program)).toBe(before); expect(f.raw().activeRunId).toBeNull();
    const permit = await f.service.departurePermit(f.id); expect(permit.departure).toEqual(f.packet.departure);
    await f.service.accept(f.id); expect(f.raw().ledger.jobs).toHaveLength(1);
  });
  it("requires a separately recorded review, reserves once and releases only its own unstarted events", async () => {
    const f = await prepared(true); expect(f.raw().ledger.jobs[0].status).toBe("review"); await expect(f.service.accept(f.id)).rejects.toThrow();
    await begin(f, f.id, "review", 2); await f.service.result(f.id, "attempt:2", JSON.stringify({ protocol: 1, proposalHash: expeditionPlanHash(f.p), decisions: [{ eventKey: "aside", verdict: "new", matchedSourceIds: [], reason: "不同事情" }] }), emptyUsage(), 21);
    await f.service.accept(f.id); expect(f.raw().context.rules.schedule.reservations).toHaveLength(1); expect(f.raw().context.rules.schedule.budget.publishedIds).toEqual([]);
    await f.service.accept(f.id); await f.service.departurePermit(f.id); expect(await f.service.enqueue()).toBe(f.id);
    await f.service.cancel(f.id); expect(f.raw().context.rules.schedule.reservations).toEqual([]); expect(f.raw().program.rewardCount).toBe(0);
  });
  it("keeps all plans/definitions unadopted when the asset adapter is unavailable", async () => {
    const f = clcHost(), id = await f.service.enqueue(), p = clcProposal(); p.itemDefinitions = [{ key: "item", templateId: "test-template", fields: { name: "测试" } }]; p.nodes[0].itemKeys = ["item"];
    await begin(f, id); await f.service.result(id, "attempt:1", JSON.stringify(p), emptyUsage(), 11); f.adapterReady(false);
    await expect(f.service.accept(id)).rejects.toThrow(); expect(f.raw().itemDefinitions).toEqual([]); expect(f.raw().ledger.jobs[0].status).toBe("ready");
    f.adapterReady(true); await f.service.accept(id); expect(f.raw().itemDefinitions).toHaveLength(1); expect(f.raw().program.rewardCount).toBe(0);
  });
  it.each([false, true])("recovers adoption commit failure/lost reply (committed=%s)", async after => {
    const f = await prepared(); f.failOnce(r => r.ledger.jobs[0].status === "accepted", after);
    await expect(f.service.accept(f.id)).rejects.toThrow(); await createExpeditionGMService(f.port).accept(f.id);
    expect(f.raw().ledger.jobs[0].status).toBe("accepted"); expect(f.raw().program.supplies).toBe(3);
  });
  it("metadata is not a new world, but route/party/world changes block late results and preserve old frames", async () => {
    const f = clcHost(), id = await f.service.enqueue(), p = clcProposal(); await begin(f, id);
    expect(f.raw().head.revision).toBeGreaterThan(f.raw().context.rules.head.revision);
    f.mutate(r => { r.context.rules.head.revision = ++r.head.revision; r.context.rules.phase++; r.context.actors[0].locationId = "garden"; });
    await f.service.result(id, "attempt:1", JSON.stringify(p), emptyUsage(), 11); expect(f.raw().ledger.jobs[0].status).toBe("stale");
    await f.service.refresh(id); expect(f.raw().ledger.jobs[0].frames).toHaveLength(2); expect(f.raw().ledger.jobs[0].attempts[0].output).toBe(JSON.stringify(p));
    f.mutate(r => { r.departure.runId = "another-run"; r.context.rules.departure.runId = r.departure.runId; r.context.rules.departure.commandHash = expeditionPlanHash(r.departure); });
    await expect(f.service.refresh(id)).rejects.toThrow(/run identity/);
  });
  it("cancelled in-flight results remain evidence without reviving the plan", async () => {
    const f = clcHost(), id = await f.service.enqueue(); await begin(f, id); await f.service.cancel(id);
    await f.service.result(id, "attempt:1", JSON.stringify(clcProposal()), emptyUsage(), 11);
    expect(f.raw().ledger.jobs[0].status).toBe("cancelled"); expect(f.raw().ledger.jobs[0].attempts[0].output).not.toBeNull();
  });
  it("root CAS admits one of two simultaneous starts and malformed output never becomes an empty plan", async () => {
    const f = clcHost(), id = await f.service.enqueue(), starts = await Promise.allSettled([begin(f, id), begin(f, id, "plan", 2)]);
    expect(starts.filter(r => r.status === "fulfilled")).toHaveLength(1);
    const a = f.raw().ledger.jobs[0].attempts[0]; await f.service.result(id, a.id, "not-json", emptyUsage(), a.at + 1);
    expect(f.raw().ledger.jobs[0]).toMatchObject({ status: "failed", prepared: null, problem: "invalid-output" }); await expect(f.service.departurePermit(id)).rejects.toThrow();
  });
  it("needs actual run proof, recovers binding after a lost response and cannot rewrite a started plan", async () => {
    const f = await prepared(); await f.service.accept(f.id); await expect(f.service.recordStarted(f.id)).rejects.toThrow(/proof/);
    const permit = await f.service.departurePermit(f.id);
    f.mutate(r => { r.activeRunId = r.departure.runId; r.startProofs.push({ runId: r.departure.runId, commandHash: expeditionPlanHash(r.departure), factId: "real-start-proof", beforeHead: permit.expectedHead }); });
    await f.service.recordStarted(f.id); await f.service.recordStarted(f.id); expect(f.raw().ledger.jobs[0].startFactId).toBe("real-start-proof");
    await expect(f.service.cancel(f.id)).rejects.toThrow(/Started/); await expect(f.service.refresh(f.id)).rejects.toThrow();
  });
  it("rejects corrupted saved plans and author text rather than reinterpreting them", async () => {
    const f = await prepared(), s = await f.service.read(); s.ledger.jobs[0].prepared!.proposal.nodes[0].intent = "changed";
    expect(() => validateExpeditionGMSnapshot(s)).toThrow(/original model output/);
    const t = await f.service.read(); t.ledger.jobs[0].frames[0].documents[0].text += "changed"; expect(() => validateExpeditionGMSnapshot(t)).toThrow();
  });
  it("requires a fresh theme review after another scheduler changes even a differently named theme", async () => {
    const f = await prepared(true);
    f.mutate(r => { r.context.rules.schedule.themes.push({ key: "similar-new-title", description: "可能近义，旧复核未见", objectIds: [], sourceId: "newly-planned", untilPhase: null }); });
    await expect(begin(f, f.id, "review", 2)).rejects.toThrow(/changed/); expect(f.raw().ledger.jobs[0].status).toBe("stale");
  });
  it("rejects an unpermitted startup after an intervening root commit", async () => {
    const f = await prepared(); await f.service.accept(f.id); const permit = await f.service.departurePermit(f.id);
    f.mutate(r => { r.activeRunId = r.departure.runId; r.startProofs.push({ runId: r.departure.runId, commandHash: expeditionPlanHash(r.departure), factId: "bypassed-gate", beforeHead: { ...permit.expectedHead, revision: permit.expectedHead.revision + 1 } }); });
    await expect(f.service.recordStarted(f.id)).rejects.toThrow(/ticket revision/);
  });
  it("rejects transitive branch contradictions, while allowing a real skipped-node branch", () => {
    const p = clcProposal(), one = p.nodes[0];
    p.nodes.push({ ...cloneExpedition(one), id: "node:2", prerequisites: [{ nodeId: "node:1", outcome: "skipped" }] });
    expect(check(p).proposal.nodes).toHaveLength(2);
    p.nodes.push({ ...cloneExpedition(one), id: "node:3", prerequisites: [{ nodeId: "node:1", outcome: "completed" }, { nodeId: "node:2", outcome: "completed" }] });
    expect(() => check(p)).toThrow(/contradictory/);
  });
});
