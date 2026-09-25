import { describe, expect, it } from "vitest";
import { canonicalJson, sha256 } from "../../game-core/contracts";
import { emptyUsage } from "../airp-generation/contracts";
import { clbHost, clbInput, clbProposal, CLB_CARD } from "../testing/airp-settlement-fixture";
import { cloneSettlement, compileSettlementRequest, createSettlementFrame, emptySettlementProposal, settlementHash } from "./context";
import { createSettlementService, validateSettlementSnapshot } from "./service";
import { LEGACY_SETTLEMENT_OUTPUT_SCHEMA } from "./prompt";

const begin = (f: ReturnType<typeof clbHost>, id: string, n = 1) => f.service.begin(id, { id: `attempt:${n}`, model: "test-only", connectionHash: "1".repeat(64), at: n * 10 });
async function ready(items = false) {
  const { input, materials } = clbInput(), f = clbHost(input), id = await f.service.enqueue(input, materials);
  await begin(f, id); await f.service.result({ jobId: id, attemptId: "attempt:1", output: JSON.stringify(clbProposal(input, items)), usage: emptyUsage(), at: 11 });
  return { ...f, id, materials };
}
async function mixedMemory(legacyFailure = false) {
  const { input, materials } = clbInput();
  input.evidence[1].authority = "claim"; input.evidence[1].speakerId = "npc-a";
  const text = "她说：等你准备好了再出发。";
  materials.evidence[1] = { sourceId: "read:1", text, digest: sha256(text) };
  if (input.evidence[1].kind === "read-paragraph") input.evidence[1].archive.digest = sha256(text);
  const f = clbHost(input), id = await f.service.enqueue(input, materials), p = clbProposal(input, true);
  p.memory.points[0].basisIds.push("read:1");
  p.memory.open = [{ ...p.memory.points[0], key: "departure" }];
  await begin(f, id);
  const output = JSON.stringify(p), usage = { inputTokens: 20, outputTokens: 3, totalTokens: 23 };
  await f.service.result({ jobId: id, attemptId: "attempt:1", output, usage, at: 11 });
  if (legacyFailure) {
    // Reconstruct the old admission result in this isolated fixture, not a player save.
    const old = f.raw(), job = old.ledger.jobs[0];
    job.status = "failed"; job.prepared = null; job.problem = "invalid-output";
    job.attempts[0].status = "failed"; job.attempts[0].error = "invalid-output";
    f.database.records.set(old.head.saveId, old);
  }
  return { ...f, id, materials, output, usage };
}
describe("CL-B settlement application and atomic host adapter", () => {
  it("v8 freezes checkpoint purpose and only advertises actor fields authorized by the grant and locks", () => {
    const { input, materials } = clbInput();
    materials.checkpoint = { kind: "scene", trackedTasks: [{ eventId: "event:1", title: "已由程序跟踪的委托", status: "accepted" }] };
    input.actorLocks = [{ actorId: "npc-a", fields: ["location"] }];
    const frame = createSettlementFrame(input, materials), schema = frame.outputSchema as any;
    expect(frame.promptVersion).toBe("cl-b-settlement-8");
    expect(JSON.parse(compileSettlementRequest(frame, 0).messages[1].content).materials.checkpoint).toEqual(materials.checkpoint);
    const cases = schema.properties.actors.items.oneOf;
    expect(cases.every((c: any) => !Object.hasOwn(c.properties, "locationId"))).toBe(true);
    expect(schema.$defs.actualBasis.allOf[0].contains.enum).toContain("fact:choice");
    expect(frame.instruction).toContain("不按说话者轮流摘抄提醒");
    expect(frame.instruction).toContain("不补写未发生的反面行动");
    expect(frame.instruction).toContain("已无后续作用的临时提醒和操作细节留在原文");
    expect(frame.instruction).toContain("支持完整理由的来源");
    expect(frame.materials.cards).toEqual(materials.cards); expect(frame.materials.evidence).toEqual(materials.evidence);
  });
  it("commits mixed scene records with authorized effects and gives the next GM attributed sources", async () => {
    const f = await mixedMemory();
    expect((await f.service.read()).ledger.jobs[0].status).toBe("ready");
    await f.service.apply(f.id);
    const context = await f.service.contextForNextGm();
    expect(context.pending).toEqual([]); expect(context.receipts).toHaveLength(1);
    expect(context.memories[0].points[0]).toMatchObject({ kind: "record", claims: [{ sourceId: "read:1", speakerId: "npc-a" }] });
    expect(context.openThreads[0].kind).toBe("record"); expect(f.raw().itemCount).toBe(1);
    const input = { ...cloneSettlement(f.input), state: context.state, openThreads: context.openThreads, priorReceipts: context.receipts };
    input.scope.boundaryId = "next-scene";
    const request = compileSettlementRequest(createSettlementFrame(input, f.materials), 0);
    expect(JSON.parse(request.messages[1].content).input.openThreads).toEqual(context.openThreads);
  });
  it.each([false, true])("revalidates preserved failures offline and survives commit retry (lost acknowledgement=%s)", async after => {
    const f = await mixedMemory(true), attempts = f.raw().ledger.jobs[0].attempts;
    await expect(f.service.contextForNextGm()).rejects.toThrow(/must wait/);
    f.failOnce(r => r.ledger.jobs[0].status === "ready", after);
    await expect(f.service.revalidate(f.id)).rejects.toThrow();
    await f.service.revalidate(f.id);
    const replayed = (await f.service.read()).ledger.jobs[0];
    expect(replayed).toMatchObject({ status: "ready", revalidatedAttemptId: "attempt:1" });
    expect(replayed.attempts).toEqual(attempts); // Includes original failure, output, usage and timestamps.
    await f.service.apply(f.id); await createSettlementService(f.port).revalidate(f.id); await f.service.apply(f.id);
    expect(f.raw().itemCount).toBe(1); expect(f.raw().ledger.receipts).toHaveLength(1);
    expect(f.raw().ledger.jobs[0].attempts).toEqual(attempts);
    expect((await f.service.contextForNextGm()).pending).toEqual([]);
  });
  it("does not use offline revalidation to admit stale state, broken JSON or missing authority", async () => {
    const stale = await mixedMemory(true); stale.advanceWorld();
    await expect(stale.service.revalidate(stale.id)).rejects.toThrow(/World changed/);
    expect(stale.raw().ledger.receipts).toEqual([]);
    for (const output of ["not-json", "unauthorized"]) {
      const { input, materials } = clbInput(), f = clbHost(input), id = await f.service.enqueue(input, materials);
      const p = clbProposal(input, true); p.items[0].grantId = "invented";
      await begin(f, id); await f.service.result({ jobId: id, attemptId: "attempt:1", output: output === "not-json" ? output : JSON.stringify(p), usage: emptyUsage(), at: 11 });
      const before = canonicalJson(f.raw());
      await expect(f.service.revalidate(id)).rejects.toThrow();
      expect(canonicalJson(f.raw())).toBe(before);
    }
  });
  it("assembles exact complete cards, read paragraphs and triggered world entries, not the literary preset", () => {
    const { input, materials } = clbInput(), frame = createSettlementFrame(input, materials), request = compileSettlementRequest(frame, 0);
    const payload = JSON.parse(request.messages[1].content);
    expect(payload.materials.cards[0].text).toBe(CLB_CARD);
    expect(payload.materials.evidence[1].text).toBe(materials.evidence[1].text);
    expect(payload.materials.world[0].text).toBe("测试设定全文。");
    expect(payload).not.toHaveProperty("preset"); expect(payload).not.toHaveProperty("models");
    expect(request.messages[0].content).toContain("截止相位untilPhase");
    const changed = cloneSettlement(materials); changed.cards[0].text = "摘要";
    expect(() => createSettlementFrame(input, changed)).toThrow(/complete/);
    changed.cards = []; expect(() => createSettlementFrame(input, changed)).toThrow(/full actor/);
  });
  it("rejects changed read text and untriggered data; oversized material is refused, never truncated", () => {
    const { input, materials } = clbInput(); materials.evidence[1].text += "未读尾段";
    expect(() => createSettlementFrame(input, materials)).toThrow(/source text/);
    const other = clbInput(); other.materials.world[0].triggerIds = ["unrelated"];
    expect(() => createSettlementFrame(other.input, other.materials)).toThrow(/triggered/);
    const huge = clbInput(), text = "x".repeat(2 * 1024 * 1024);
    huge.materials.cards[0].text = text; huge.materials.cards[0].digest = sha256(text); huge.input.fullActorCards[0].digest = sha256(text);
    expect(() => createSettlementFrame(huge.input, huge.materials)).toThrow(/NOT truncated/);
  });
  it("summarizes purely mechanical facts without a model call or forced variables", async () => {
    const { input, materials } = clbInput(); input.grants = []; input.evidence = input.evidence.slice(0, 1); materials.evidence = materials.evidence.slice(0, 1);
    const f = clbHost(input), id = await f.service.enqueue(input, materials);
    expect((await f.service.read()).ledger.jobs[0]).toMatchObject({ mode: "mechanical", status: "ready", attempts: [] });
    await f.service.apply(id);
    const saved = await f.service.read(); expect(saved.ledger.state.affinity).toEqual([]); expect(saved.ledger.memories[0].points[0].text).toBe(materials.evidence[0].text);
    expect(saved.ledger.receipts).toHaveLength(1);
  });
  it("saves proposal before applying, then atomically commits affinity, actor state, assets, memory and receipt", async () => {
    const f = await ready(true), saved = await f.service.read();
    expect(saved.ledger.state.affinity).toEqual([]); expect(saved.ledger.memories).toEqual([]); expect(f.raw().itemCount).toBe(0);
    await f.service.apply(f.id);
    const after = await f.service.read(); expect(after.ledger.state.affinity).toEqual([{ actorId: "npc-a", value: 2 }]);
    expect(after.ledger.state.actors[0].locationId).toBe("garden"); expect(f.raw().itemCount).toBe(1);
    expect(after.ledger.memories).toHaveLength(1); expect(after.ledger.receipts).toHaveLength(1);
    expect(after.ledger.memories[0].effectIds).toEqual(after.ledger.receipts[0].effects.map(e => e.id));
    expect(after.worldHead).toEqual(after.ledger.state.head);
    await f.service.apply(f.id); expect(f.raw().itemCount).toBe(1);
  });
  it("keeps all variable/memory effects pending when the asset system is unavailable", async () => {
    const f = await ready(true); f.assetsReady(false);
    await expect(f.service.apply(f.id)).rejects.toThrow(/Asset/);
    const s = await f.service.read(); expect(s.ledger.jobs[0]).toMatchObject({ status: "ready", problem: "asset-pending" });
    expect(s.ledger.state.affinity).toEqual([]); expect(s.ledger.memories).toEqual([]); expect(f.raw().itemCount).toBe(0);
    expect(f.raw().committedProgramText).toContain("already committed");
    f.assetsReady(true); await f.service.apply(f.id); expect(f.raw().itemCount).toBe(1);
    expect((await f.service.read()).ledger.jobs[0].attempts).toHaveLength(1);
  });
  it.each([false, true])("recovers apply save failure/lost response (after commit=%s) without duplicate effects", async after => {
    const f = await ready(true); f.failOnce(r => r.ledger.jobs[0].status === "applied", after);
    await expect(f.service.apply(f.id)).rejects.toThrow();
    expect(f.raw().itemCount).toBe(after ? 1 : 0);
    await createSettlementService(f.port).apply(f.id);
    expect(f.raw().itemCount).toBe(1); expect(f.raw().ledger.receipts).toHaveLength(1); expect(f.raw().ledger.memories).toHaveLength(1);
  });
  it("preserves malformed output/usage and blocks dependent GM instead of claiming no changes", async () => {
    const { input, materials } = clbInput(), f = clbHost(input), id = await f.service.enqueue(input, materials);
    await begin(f, id);
    await f.service.result({ jobId: id, attemptId: "attempt:1", output: "not-json", usage: { inputTokens: 20, outputTokens: 3, totalTokens: 23 }, at: 11 });
    const job = (await f.service.read()).ledger.jobs[0]; expect(job.status).toBe("failed"); expect(job.attempts[0].output).toBe("not-json"); expect(job.attempts[0].usage.totalTokens).toBe(23);
    await expect(f.service.contextForNextGm()).rejects.toThrow(/must wait/);
    expect((await f.service.contextForNextGm(true)).pending).toHaveLength(1);
    expect(f.raw().ledger.memories).toEqual([]);
  });
  it("late results preserve output but do not touch a newer world; refresh is explicit and retains history", async () => {
    const { input, materials } = clbInput(), f = clbHost(input), id = await f.service.enqueue(input, materials);
    await begin(f, id); f.advanceWorld();
    await f.service.result({ jobId: id, attemptId: "attempt:1", output: JSON.stringify(clbProposal(input)), usage: emptyUsage(), at: 11 });
    expect((await f.service.read()).ledger.jobs[0].status).toBe("stale"); expect(f.raw().ledger.state.affinity).toEqual([]);
    const newInput = cloneSettlement(input); newInput.state = (await f.service.read()).ledger.state;
    await f.service.refresh(id, newInput, materials); await begin(f, id, 2);
    await f.service.result({ jobId: id, attemptId: "attempt:2", output: JSON.stringify(clbProposal(newInput)), usage: emptyUsage(), at: 21 }); await f.service.apply(id);
    const job = (await f.service.read()).ledger.jobs[0]; expect(job.frames).toHaveLength(2); expect(job.attempts).toHaveLength(2); expect(job.attempts[0].output).not.toBeNull();
  });
  it("bookkeeping does not falsely stale its own frozen world, but real changes stale a prepared batch", async () => {
    const f = await ready();
    expect((await f.service.read()).head.revision).toBeGreaterThan(f.input.state.head.revision);
    expect((await f.service.read()).worldHead).toEqual(f.input.state.head);
    f.advanceWorld(); await expect(f.service.apply(f.id)).rejects.toThrow(/World changed/);
    expect((await f.service.read()).ledger.jobs[0].status).toBe("stale"); expect(f.raw().ledger.memories).toEqual([]);
  });
  it("uses root CAS for two tabs starting or applying the same job", async () => {
    const { input, materials } = clbInput(), f = clbHost(input), id = await f.service.enqueue(input, materials);
    const attempts = await Promise.allSettled([begin(f, id), begin(f, id, 2)]);
    expect(attempts.filter(r => r.status === "fulfilled")).toHaveLength(1);
    const a = (await f.service.read()).ledger.jobs[0].attempts[0];
    await f.service.result({ jobId: id, attemptId: a.id, output: JSON.stringify(clbProposal(input, true)), usage: emptyUsage(), at: a.startedAt + 1 });
    await Promise.allSettled([f.service.apply(id), createSettlementService(f.port).apply(id)]);
    expect(f.raw().itemCount).toBe(1); expect(f.raw().ledger.receipts).toHaveLength(1);
  });
  it("restores running and ready work without sending anything, and detects inconsistent receipts", async () => {
    const f = await ready(), reopened = createSettlementService(f.port), before = canonicalJson(f.raw());
    await reopened.read(); expect(canonicalJson(f.raw())).toBe(before);
    await reopened.apply(f.id);
    const snapshot = await reopened.read(); snapshot.ledger.receipts[0].effects[0].basisIds = ["invented"];
    expect(() => validateSettlementSnapshot(snapshot)).toThrow(/mismatch/);
  });
  it("replays raw output when checking a saved batch and rejects counterfeit memory/state", async () => {
    const f = await ready(); await f.service.apply(f.id);
    const original = await f.service.read(), changed = cloneSettlement(original);
    const a = changed.ledger.jobs[0].prepared!.effects[0], b = changed.ledger.receipts[0].effects[0];
    if (a.kind !== "affinity" || b.kind !== "affinity") throw new Error("Fixture");
    a.after = 9; b.after = 9;
    expect(() => validateSettlementSnapshot(changed)).toThrow(/original validated response/);
    const state = cloneSettlement(original); state.ledger.state.affinity[0].value = 9;
    expect(() => validateSettlementSnapshot(state)).toThrow(/State differs/);
    const threads = cloneSettlement(original); threads.ledger.openThreads.push({ ...threads.ledger.memories[0].points[0], id: "fake-thread", scope: f.input.scope });
    expect(() => validateSettlementSnapshot(threads)).toThrow(/Unresolved/);
  });
  it("describes ASCII identifiers/current-source requirements and preserves legacy schema snapshots", () => {
    const { input, materials } = clbInput(), frame = createSettlementFrame(input, materials);
    const payload = JSON.parse(compileSettlementRequest(frame, 0).messages[1].content);
    const schema = payload.outputSchema.properties.memory.properties.open.items.properties;
    expect(new RegExp(schema.key.pattern).test("中文标题")).toBe(false);
    expect(new RegExp(schema.key.pattern).test("pending-delivery")).toBe(true);
    expect(schema.basisIds).toEqual({ $ref: "#/$defs/currentBasis" });
    expect(payload.outputSchema.$defs.currentBasis.contains.enum).toContain("fact:choice");
    const old = cloneSettlement(frame); delete old.outputSchema; old.promptVersion = "cl-b-settlement-1";
    payload.outputSchema = LEGACY_SETTLEMENT_OUTPUT_SCHEMA;
    old.requestHash = settlementHash([{ role: "system", content: old.instruction }, { role: "user", content: canonicalJson(payload) }]);
    expect(compileSettlementRequest(old, 0).requestHash).toBe(old.requestHash);
  });
  it("shares current-evidence constraints without changing or upgrading a frozen v6 request", () => {
    const { input, materials } = clbInput(), frame = createSettlementFrame(input, materials);
    const payload = JSON.parse(compileSettlementRequest(frame, 0).messages[1].content), schema = payload.outputSchema;
    const holders = [schema.properties.affinity.items.properties, schema.properties.items.items.properties, schema.properties.memory.properties.open.items.properties];
    const basis = schema.$defs.currentBasis;
    expect(basis).toMatchObject({ minItems: 1, uniqueItems: true, minContains: 1 });
    expect(basis.contains.enum).toEqual(input.evidence.filter(s => s.role === "current").map(s => s.id));
    for (const holder of holders) { expect(holder.basisIds).toEqual({ $ref: "#/$defs/currentBasis" }); holder.basisIds = cloneSettlement(basis); }
    delete schema.$defs.currentBasis;
    const old = cloneSettlement(frame); old.promptVersion = "cl-b-settlement-6"; old.outputSchema = schema;
    const messages = [{ role: "system", content: old.instruction }, { role: "user", content: canonicalJson(payload) }];
    old.requestHash = settlementHash(messages);
    const frozen = canonicalJson(old);
    expect(compileSettlementRequest(old, 0).messages).toEqual(messages);
    expect(canonicalJson(old)).toBe(frozen);
    schema.properties.affinity.items.properties.basisIds.contains.enum.push("invented");
    expect(() => compileSettlementRequest(old, 0)).toThrow(/Frozen request changed/);
    const future = cloneSettlement(frame); future.promptVersion = "cl-b-settlement-999";
    expect(() => compileSettlementRequest(future, 0)).toThrow(/Unsupported/);
  });
  it("retains attempts for failed requests and enforces a finite attempt capacity", async () => {
    const { input, materials } = clbInput(), f = clbHost(input), id = await f.service.enqueue(input, materials);
    for (let n = 1; n <= 12; n++) { await begin(f, id, n); await f.service.fail(id, `attempt:${n}`, { at: n * 10 + 1, error: "provider-error", outcomeUnknown: true, usage: emptyUsage() }); }
    await expect(begin(f, id, 13)).rejects.toThrow(/eligible/);
    expect((await f.service.read()).ledger.jobs[0].attempts).toHaveLength(12);
  });
  it("cannot turn an event summary into another application of the same effect", async () => {
    const f = await ready(); await f.service.apply(f.id);
    const s = await f.service.read(), input = cloneSettlement(f.input); input.state = s.ledger.state; input.priorReceipts = s.ledger.receipts; input.openThreads = s.ledger.openThreads; input.scope.boundaryId = "summary:later";
    const id = await f.service.enqueue(input, f.materials); await begin(f, id, 2);
    await f.service.result({ jobId: id, attemptId: "attempt:2", output: JSON.stringify(clbProposal(input)), usage: emptyUsage(), at: 21 });
    expect((await f.service.read()).ledger.jobs[1].status).toBe("failed"); expect(f.raw().ledger.state.affinity[0].value).toBe(2);
    await begin(f, id, 3); const summary = emptySettlementProposal(input); summary.memory.priorReceiptIds = [s.ledger.receipts[0].id];
    await f.service.result({ jobId: id, attemptId: "attempt:3", output: JSON.stringify(summary), usage: emptyUsage(), at: 31 }); await f.service.apply(id);
    expect(f.raw().ledger.state.affinity[0].value).toBe(2); expect(f.raw().ledger.memories[1].effectIds).toEqual([]);
  });
  it("preserves intervening program movement instead of enforcing an old settlement location", async () => {
    const f = await ready(); await f.service.apply(f.id);
    expect(f.raw().ledger.state.actors[0].locationId).toBe("garden");
    f.advanceWorld();
    const moved = f.raw(); moved.ledger.state.actors[0].locationId = "hall";
    f.database.records.set(moved.head.saveId, moved); // Isolated program-state fixture, never a live save.
    const s = await f.service.read(), input = cloneSettlement(f.input), materials = cloneSettlement(f.materials);
    input.state = s.ledger.state; input.priorReceipts = s.ledger.receipts; input.openThreads = s.ledger.openThreads;
    input.scope.boundaryId = "summary:after-movement"; input.grants = [];
    input.evidence = input.evidence.slice(0, 1); materials.evidence = materials.evidence.slice(0, 1);
    const id = await f.service.enqueue(input, materials); await f.service.apply(id);
    const saved = await f.service.read();
    expect(saved.ledger.state.actors[0].locationId).toBe("hall");
    expect(saved.ledger.receipts[0].effects.find(e => e.kind === "actor")).toMatchObject({ after: { locationId: "garden" } });
    expect(saved.ledger.receipts[1].effects).toEqual([]);
    expect(saved.ledger.state.affinity[0].value).toBe(2);
  });
  it("persists unresolved matters and resolves only the named source-backed item", async () => {
    const { input, materials } = clbInput(), f = clbHost(input), id = await f.service.enqueue(input, materials); await begin(f, id);
    const p = emptySettlementProposal(input); p.memory.open = [{ kind: "fact", text: "实际请求仍待交付。", speakerId: null, knownBy: ["player", "npc-a"], basisIds: ["fact:choice"], key: "delivery" }];
    await f.service.result({ jobId: id, attemptId: "attempt:1", output: JSON.stringify(p), usage: emptyUsage(), at: 11 }); await f.service.apply(id);
    const s = await f.service.read(), next = cloneSettlement(input); next.state = s.ledger.state; next.priorReceipts = s.ledger.receipts; next.openThreads = s.ledger.openThreads; next.scope.boundaryId = "actual-delivery";
    const later = await f.service.enqueue(next, materials); await begin(f, later, 2);
    const q = emptySettlementProposal(next); q.memory.close = [{ id: next.openThreads[0].id, basisIds: ["fact:choice"] }];
    await f.service.result({ jobId: later, attemptId: "attempt:2", output: JSON.stringify(q), usage: emptyUsage(), at: 21 }); await f.service.apply(later);
    expect((await f.service.contextForNextGm()).openThreads).toEqual([]); expect(f.raw().ledger.memories[0].opened).toHaveLength(1);
  });
});
