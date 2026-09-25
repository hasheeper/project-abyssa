import { describe, expect, it } from "vitest";
import type { SettlementCommitGate, SettlementInput, SettlementProposal } from "../contracts/airp-settlement";
import { parseSettlementPolicy, parseSettlementProposal, parseSettlementState } from "../contracts/airp-settlement-validation";
import { canonicalJson, freezeData } from "../contracts/validation";
import { prepareAirpSettlement, projectSettlementActorState, settlementEffectId, settlementTaskIdentity } from "./airp-settlement";
import { fixtureReceipt, settlementFixture, settlementGate, settlementPoint, settlementProposal } from "./testing/airp-settlement-fixture";

function withAffinity(input = settlementFixture(), gradeId = "up") {
  const proposal = settlementProposal(input);
  proposal.affinity.push({ grantId: "grant:affinity", gradeId, reason: "依据该角色与本次行为判断，而非按按钮类型加分。", basisIds: ["fact:choice"] });
  proposal.memory.points.push(settlementPoint());
  return proposal;
}
function withActor(input = settlementFixture()) {
  const proposal = settlementProposal(input);
  proposal.actors.push({ grantId: "grant:actor", locationId: "garden", basisIds: ["fact:choice"] });
  proposal.memory.points.push(settlementPoint());
  return proposal;
}
function withItem(input = settlementFixture()) {
  const proposal = settlementProposal(input);
  proposal.items.push({ grantId: "grant:item", basisIds: ["fact:choice"] });
  proposal.memory.points.push(settlementPoint());
  return proposal;
}
function prepare(input: SettlementInput, proposal = settlementProposal(input), gate = settlementGate(input)) {
  const result = prepareAirpSettlement(input, proposal, gate);
  if (result.status !== "prepared") throw new Error("Expected new prepared batch");
  return result.batch;
}
const rebound = (input: SettlementInput, proposal: SettlementProposal) => ({ ...proposal, ...settlementTaskIdentity(input) });

describe("CL-A isolated contract (no network, inventory writes or save installation)", () => {
  it("allows empty variables and all-empty proposals; round-trips without touching old archive bytes", () => {
    const input = settlementFixture(); input.state.actors = [];
    const original = JSON.stringify({ oldProtocol: 1, readText: "完整角色卡／已读稿，原字原句。\n第二段。", state: input.state });
    const proposal = settlementProposal(input);
    expect(parseSettlementState(JSON.parse(JSON.stringify(input.state)))).toEqual(input.state);
    expect(parseSettlementProposal(JSON.parse(JSON.stringify(proposal)))).toEqual(proposal);
    expect(prepare(input).effects).toEqual([]);
    expect(prepare(input).memory.effectIds).toEqual([]);
    expect(original).toBe(JSON.stringify({ oldProtocol: 1, readText: "完整角色卡／已读稿，原字原句。\n第二段。", state: input.state }));
  });
  it("has no implicit game policy and rejects policy/state mismatches", () => {
    const input = settlementFixture();
    expect(parseSettlementPolicy(input.policy)).toEqual(input.policy);
    expect(() => parseSettlementPolicy({})).toThrow();
    input.state.policyId = "unapproved-new-policy";
    expect(() => prepare(input)).toThrow(/Policy/);
  });
  it.each(["apiKey", "rewardGold", "inventory", "gmPlan", "questStatus"])("rejects unauthorized proposal field %s", field => {
    expect(() => parseSettlementProposal({ ...settlementProposal(settlementFixture()), [field]: 1 })).toThrow(/Unknown field/);
  });
  it("rejects future protocol, unsafe numbers, unknown nested fields and empty prose", () => {
    const input = settlementFixture(), p = withAffinity(input);
    expect(() => parseSettlementProposal({ ...p, protocol: 2 })).toThrow();
    expect(() => parseSettlementState({ ...input.state, protocol: 2 })).toThrow();
    expect(() => parseSettlementState({ ...input.state, phase: Infinity })).toThrow();
    expect(() => parseSettlementProposal({ ...p, affinity: [{ ...p.affinity[0], delta: 9000 }] })).toThrow(/Unknown field/);
    expect(() => parseSettlementProposal({ ...p, affinity: [{ ...p.affinity[0], reason: "  \n " }] })).toThrow(/Empty prose/);
    expect(() => parseSettlementProposal({ ...p, inputHash: "not-a-digest" })).toThrow();
  });
  it("rejects duplicated grants, too many changes and duplicate state rows", () => {
    const input = settlementFixture(), p = withAffinity(input);
    expect(() => parseSettlementProposal({ ...p, affinity: [p.affinity[0], p.affinity[0]] })).toThrow(/Duplicate/);
    expect(() => parseSettlementProposal({ ...p, affinity: Array(33).fill(p.affinity[0]) })).toThrow();
    expect(() => parseSettlementState({ ...input.state, actors: [input.state.actors[0], input.state.actors[0]] })).toThrow(/Duplicate/);
  });
  it("freezes the full-card digest, input snapshot and policy without changing task identity on retry", () => {
    const input = settlementFixture(), p = withAffinity(input), originalId = p.taskId;
    expect(settlementTaskIdentity(input).taskId).toBe(originalId);
    input.fullActorCards[0].digest = "0".repeat(64);
    expect(settlementTaskIdentity(input).taskId).toBe(originalId);
    expect(() => prepare(input, p)).toThrow(/changed frozen input/);
    const next = settlementFixture(); next.scope.boundaryId = "feedback:next";
    expect(settlementTaskIdentity(next).taskId).not.toBe(originalId);
  });
  it("maps positive, negative and explicit zero grades; does not infer a score from the choice", () => {
    const input = settlementFixture();
    for (const [grade, expected] of [["up", 2], ["down", -2], ["none", 0]] as const) {
      const batch = prepare(input, withAffinity(input, grade));
      expect(batch.effects[0]).toMatchObject({ kind: "affinity", before: 0, after: expected, delta: expected });
      expect(batch.memory.effectIds).toEqual([batch.effects[0].id]);
    }
    expect(prepare(input).effects).toEqual([]);
  });
  it("stores the actual clamped change, not a model-authored amount", () => {
    const input = settlementFixture(); input.state.affinity.push({ actorId: "npc-a", value: 9 });
    expect(prepare(input, withAffinity(input)).effects[0]).toMatchObject({ requestedDelta: 2, delta: 1, before: 9, after: 10 });
  });
  it("requires complete affected cards, legitimate grades and actual actor knowledge", () => {
    const input = settlementFixture(); input.fullActorCards = [];
    expect(() => prepare(input, withAffinity(input))).toThrow(/complete/);
    const unknown = settlementFixture(); unknown.evidence[0].knownBy = ["player"];
    expect(() => prepare(unknown, withAffinity(unknown))).toThrow(/unknown information/);
    expect(() => prepare(settlementFixture(), withAffinity(settlementFixture(), "huge"))).toThrow(/grade/);
  });
  it("does not settle the whole event at a run ending or action boundary", () => {
    const input = settlementFixture(); input.scope.kind = "run";
    expect(() => prepare(input, withAffinity(input))).toThrow(/Whole-event/);
    const g = input.grants[0]; if (g.kind === "affinity") g.accountId = "explicit-stage:1";
    expect(prepare(input, withAffinity(input)).effects).toHaveLength(1);
  });
  it("deduplicates one effect across action feedback and a new summary/grant ID", () => {
    const first = settlementFixture(), receipt = fixtureReceipt(prepare(first, withAffinity(first)));
    const next = settlementFixture(); next.state.head = receipt.committedHead; next.scope.boundaryId = "summary:later";
    next.priorReceipts = [receipt]; next.grants[0].id = "renamed:grant";
    const p = withAffinity(next); p.affinity[0].grantId = "renamed:grant";
    expect(() => prepare(next, p)).toThrow(/already applied/);
    const summary = settlementProposal(next); summary.memory.priorReceiptIds = [receipt.id];
    const batch = prepare(next, summary);
    expect(batch.effects).toEqual([]); expect(batch.memory.priorReceiptIds).toEqual([receipt.id]);
  });
  it("shares the event budget across explicitly authorized stage accounts", () => {
    const first = settlementFixture();
    const receipt = fixtureReceipt(prepare(first, withAffinity(first, "large")));
    const next = settlementFixture(); next.state.head = receipt.committedHead; next.scope.boundaryId = "other-stage";
    next.priorReceipts = [receipt];
    const g = next.grants[0]; if (g.kind === "affinity") g.accountId = "explicit-stage:2";
    expect(() => prepare(next, withAffinity(next))).toThrow(/budget/);
  });
  it.each(["save", "epoch", "revision"])("rejects late %s results without a batch", which => {
    const input = settlementFixture(), gate = settlementGate(input);
    if (which === "save") gate.head.saveId = "different-save";
    if (which === "epoch") gate.head.epoch = "deleted-then-recreated";
    if (which === "revision") gate.head.revision++;
    expect(() => prepare(input, withAffinity(input), gate)).toThrow();
  });
  it("returns the committed receipt on a same-task save retry, with no second effect", () => {
    const input = settlementFixture(), p = withAffinity(input), batch = prepare(input, p), receipt = fixtureReceipt(batch);
    const gate: SettlementCommitGate = { head: receipt.committedHead, receipts: [receipt], appliedItemOperations: [] };
    expect(prepareAirpSettlement(input, p, gate)).toEqual({ status: "already-applied", receipt });
    gate.receipts = [{ ...receipt, inputHash: "0".repeat(64) }];
    expect(() => prepareAirpSettlement(input, p, gate)).toThrow(/different input/);
  });
  it.each(["run", "action", "event", "future", "epoch", "unread"])("rejects %s source contamination", which => {
    const input = settlementFixture(), s = input.evidence[0];
    if (which === "run") s.runId = "run:old";
    if (which === "action") s.actionId = "unselected-action";
    if (which === "event") s.eventId = "event:other";
    if (which === "future") s.phase++;
    if (which === "epoch") s.head = { ...s.head, epoch: "old-epoch" };
    if (which === "unread" && input.evidence[1].kind === "read-paragraph") input.evidence[1].readAtRevision++;
    expect(() => prepare(input, withAffinity(input))).toThrow();
  });
  it("does not accept GM plans/ICOT/unselected choices as evidence kinds", () => {
    for (const kind of ["gm-plan", "icot", "candidate", "unselected-choice"]) {
      const input = settlementFixture(); Object.assign(input.evidence[0], { kind });
      expect(() => settlementTaskIdentity(input)).toThrow();
    }
  });
  it("allows explicitly scoped historical context, but not history alone for a new effect", () => {
    const input = settlementFixture(); input.evidence[0].role = "history"; input.evidence[0].runId = "run:old";
    expect(() => prepare(input, withAffinity(input))).toThrow(/History alone/);
    const p = settlementProposal(input); p.memory.points.push(settlementPoint());
    expect(prepare(input, p).memory.points).toHaveLength(1);
  });
  it("rejects missing source IDs and knowledge widening in summaries", () => {
    const input = settlementFixture(), p = withAffinity(input);
    p.affinity[0].basisIds = ["not-in-archive"];
    expect(() => prepare(input, p)).toThrow(/Missing source/);
    const m = settlementProposal(input); m.memory.points = [{ ...settlementPoint(), knownBy: ["npc-b"] }];
    expect(() => prepare(input, m)).toThrow(/knowledge/);
  });
  it("preserves claims as claims; an invitation does not authorize asset or actual-location changes", () => {
    const input = settlementFixture(), source = input.evidence[1];
    source.authority = "claim"; source.speakerId = "npc-a";
    const p = settlementProposal(input); p.memory.points = [{ ...settlementPoint(), basisIds: ["read:1"] }];
    expect(prepare(input, p).memory.points[0]).toEqual({ ...p.memory.points[0], kind: "record", claims: [{ sourceId: "read:1", speakerId: "npc-a" }] });
    p.memory.points[0].kind = "claim"; p.memory.points[0].speakerId = "npc-a";
    expect(prepare(input, p).memory.points[0].kind).toBe("claim");
    p.items = [{ grantId: "grant:item", basisIds: ["read:1"] }];
    expect(() => prepare(input, p)).toThrow(/claim\/plan/);
    p.items = []; p.actors = [{ grantId: "grant:actor", basisIds: ["read:1"], locationId: "garden" }];
    expect(() => prepare(input, p)).toThrow(/claim\/plan/);
  });
  it("admits mixed narrative/dialogue summaries and open matters without rewriting text or removing citations", () => {
    const input = settlementFixture(); input.evidence[1].authority = "claim"; input.evidence[1].speakerId = "npc-a";
    const p = settlementProposal(input), point = { ...settlementPoint(), text: "她检查包扣，说补给带好了；队伍在门口等玩家表态。", basisIds: ["fact:choice", "read:1"] };
    p.memory.points = [point]; p.memory.open = [{ ...point, key: "departure" }];
    const original = canonicalJson(p), batch = prepare(freezeData(input), freezeData(p));
    expect(canonicalJson(p)).toBe(original);
    expect(batch.memory.points[0]).toEqual({ ...point, kind: "record", claims: [{ sourceId: "read:1", speakerId: "npc-a" }] });
    expect(batch.memory.opened[0]).toMatchObject(batch.memory.points[0]);
    expect(batch.memory.sources).toEqual(input.evidence);
    expect(batch.effects).toEqual([]);
    const next = settlementFixture(); next.openThreads = structuredClone(batch.memory.opened);
    // Saved open records round-trip into the next settlement without a protocol migration.
    expect(prepare(next).effects).toEqual([]);
  });
  it("keeps player/multiple-speaker citations distinct and corrects mismatched attribution locally", () => {
    const input = settlementFixture(); input.evidence[1].authority = "claim"; input.evidence[1].speakerId = "npc-a";
    input.evidence.push({ ...input.evidence[1], id: "read:player", speakerId: "player" });
    const p = settlementProposal(input);
    p.memory.points = [{ ...settlementPoint(), basisIds: ["fact:choice", "read:1", "read:player"] }];
    expect(prepare(input, p).memory.points[0]).toMatchObject({ kind: "record", speakerId: null, claims: [
      { sourceId: "read:1", speakerId: "npc-a" }, { sourceId: "read:player", speakerId: "player" },
    ] });
    p.memory.points[0] = { ...p.memory.points[0], kind: "claim", speakerId: "npc-b" };
    expect(prepare(input, p).memory.points[0]).toMatchObject({ kind: "record", speakerId: null, claims: [
      { sourceId: "read:1", speakerId: "npc-a" }, { sourceId: "read:player", speakerId: "player" },
    ] });
    p.memory.points[0].basisIds = ["fact:choice"];
    expect(prepare(input, p).memory.points[0]).toMatchObject({ kind: "record", speakerId: null, claims: [] });
  });
  it("does not change existing fact/claim batches or the model proposal schema", () => {
    const input = settlementFixture(); input.evidence[1].authority = "claim"; input.evidence[1].speakerId = "npc-a";
    const p = settlementProposal(input); p.memory.points = [settlementPoint(), { ...settlementPoint(), kind: "claim", speakerId: "npc-a", basisIds: ["read:1"] }];
    expect(prepare(input, p).memory.points).toEqual(p.memory.points);
    Object.assign(p.memory.points[0], { kind: "record", claims: [] });
    expect(() => parseSettlementProposal(p)).toThrow();
  });
  it("does not discard authorized effects just because their memory also cites dialogue", () => {
    const input = settlementFixture(); input.evidence[1].authority = "claim"; input.evidence[1].speakerId = "npc-a";
    for (const make of [withAffinity, withActor, withItem]) {
      const p = make(input); p.memory.points[0].basisIds.push("read:1");
      const batch = prepare(input, p);
      expect(batch.effects).toHaveLength(1); expect(batch.memory.points[0].kind).toBe("record");
    }
    const p = withItem(input); p.items[0].grantId = "invented-grant"; p.memory.points[0].basisIds.push("read:1");
    expect(() => prepare(input, p)).toThrow(/grant/);
  });
  it("returns only an opaque frozen asset operation for the future adapter", () => {
    const input = settlementFixture(), batch = prepare(input, withItem(input));
    expect(batch.effects[0]).toMatchObject({ kind: "item", operation: { adapterId: "fixture-asset-adapter", operationId: "acquire:1" } });
    expect(batch).not.toHaveProperty("inventory");
    const p = withItem(input); Object.assign(p.items[0], { quantity: 99, price: 0 });
    expect(() => parseSettlementProposal(p)).toThrow(/Unknown field/);
  });
  it("refuses an asset operation already issued by the inventory domain, even if its hash changed", () => {
    const input = settlementFixture(), gate = settlementGate(input), g = input.grants[1];
    if (g.kind !== "item") throw new Error("Fixture");
    gate.appliedItemOperations = [{ ...g.operation, operationHash: "0".repeat(64) }];
    expect(() => prepare(input, withItem(input), gate)).toThrow(/Asset operation already/);
    expect(settlementEffectId(input.state.head, g)).toBe(settlementEffectId(input.state.head, { ...g, id: "other", operation: { ...g.operation, operationHash: "0".repeat(64) } }));
  });
  it("patches only actual changed fields and leaves unrelated actors/conditions intact", () => {
    const input = settlementFixture(); input.state.actors[0].conditions.push({ id: "tired", untilPhase: 12, endConditionId: "returned" });
    const batch = prepare(input, withActor(input));
    expect(batch.effects[0]).toMatchObject({ kind: "actor", after: { locationId: "garden", conditions: input.state.actors[0].conditions } });
    expect(input.state.actors[0].locationId).toBe("hall");
    expect(batch.effects).toHaveLength(1);
  });
  it("honors program movement/combat/occupancy locks and registered locations", () => {
    const input = settlementFixture(); input.actorLocks.push({ actorId: "npc-a", fields: ["location"] });
    expect(() => prepare(input, withActor(input))).toThrow(/locked/);
    const unlocked = settlementFixture(), p = withActor(unlocked); p.actors[0].locationId = "invented";
    expect(() => prepare(unlocked, p)).toThrow(/location/);
    p.actors[0].locationId = "hall";
    expect(() => prepare(unlocked, p)).toThrow(/changes nothing/);
  });
  it("requires a bounded lifetime; no implicit permanent busy or every-scene reset", () => {
    const input = settlementFixture(), p = withActor(input);
    p.actors[0] = { grantId: "grant:actor", basisIds: ["fact:choice"], activity: { id: "resting", untilPhase: 11, endConditionId: "returned" } };
    const effect = prepare(input, p).effects[0];
    if (effect.kind !== "actor") throw new Error("Expected actor");
    expect(projectSettlementActorState(effect.after, 10).activity).not.toBeNull();
    expect(projectSettlementActorState(effect.after, 11).activity).toBeNull();
    expect(projectSettlementActorState(effect.after, 9, ["returned"]).activity).toBeNull();
    expect(projectSettlementActorState(effect.after, 20).locationId).toBe("hall");
    for (const untilPhase of [8, 99]) {
      p.actors[0].activity!.untilPhase = untilPhase;
      expect(() => prepare(input, p)).toThrow(/expired\/overlong/);
    }
  });
  it("rejects conflicting actor patches and implicit condition renewal", () => {
    const input = settlementFixture();
    input.grants.push({ id: "grant:actor:2", kind: "actor", actorId: "npc-a", changeId: "transition:2", fields: ["location"] });
    const p = withActor(input); p.actors.push({ grantId: "grant:actor:2", locationId: "hall", basisIds: ["fact:choice"] });
    expect(() => prepare(input, p)).toThrow(/Conflicting actor/);
    p.actors.pop(); input.state.actors[0].conditions.push({ id: "tired", untilPhase: 11, endConditionId: null });
    p.actors[0].conditions = { add: [{ id: "tired", untilPhase: 12, endConditionId: null }], removeIds: [] };
    expect(() => prepare(input, rebound(input, p))).toThrow(/renew/);
  });
  it("adds/removes explicit conditions without clearing unmentioned ones, and enforces aggregate capacity", () => {
    const input = settlementFixture(), p = withActor(input);
    p.actors[0].conditions = { add: [{ id: "tired", untilPhase: 12, endConditionId: null }], removeIds: [] };
    const effect = prepare(input, p).effects[0];
    if (effect.kind !== "actor") throw new Error("Expected actor");
    input.state.actors[0] = structuredClone(effect.after);
    const remove = settlementProposal(input); remove.actors = [{ grantId: "grant:actor", basisIds: ["fact:choice"], conditions: { add: [], removeIds: ["tired"] } }]; remove.memory.points = [settlementPoint()];
    expect(prepare(input, remove).effects[0]).toMatchObject({ kind: "actor", after: { conditions: [] } });
    input.policy.conditions = Array.from({ length: 33 }, (_, i) => ({ id: `condition:${i}`, maxPhases: 8 }));
    input.state.actors[0].conditions = input.policy.conditions.slice(0, 32).map(c => ({ id: c.id, untilPhase: 12, endConditionId: null }));
    remove.actors[0].conditions = { add: [{ id: "condition:32", untilPhase: 12, endConditionId: null }], removeIds: [] };
    expect(() => prepare(input, rebound(input, remove))).toThrow(/capacity/);
  });
  it("rejects wrong-kind/unauthorized grants and hidden-knowledge thread closure", () => {
    const input = settlementFixture(), p = withActor(input);
    p.actors[0].grantId = "grant:affinity";
    expect(() => prepare(input, p)).toThrow(/wrong-kind/);
    input.openThreads = [{ ...settlementPoint(), knownBy: ["player", "npc-a", "npc-b"], id: "thread:old", scope: input.scope }];
    const close = settlementProposal(input); close.memory.close = [{ id: "thread:old", basisIds: ["fact:choice"] }];
    expect(() => prepare(input, close)).toThrow(/closure widens/);
  });
  it("keeps unresolved matters across days, closes only named sourced matters and retains original refs", () => {
    const input = settlementFixture(), p = settlementProposal(input);
    p.memory.open.push({ ...settlementPoint(), key: "delivery-needed" });
    p.memory.points.push({ ...settlementPoint(), basisIds: ["read:1"] });
    const batch = prepare(input, p), next = settlementFixture();
    expect(batch.memory.sources.find(s => s.id === "read:1")).toEqual(input.evidence[1]);
    next.state.phase = 12; next.scope.boundaryId = "later:delivery"; next.openThreads = batch.memory.opened;
    const q = settlementProposal(next); q.memory.close = [{ id: batch.memory.opened[0].id, basisIds: ["fact:choice"] }];
    expect(prepare(next, q).memory.closed).toHaveLength(1);
    expect(next.openThreads).toHaveLength(1); // No program write has happened.
    q.memory.close[0].id = "nonexistent";
    expect(() => prepare(next, q)).toThrow(/Missing unresolved/);
  });
  it("rejects unpaired variable/memory output and never mutates input on late failure", () => {
    const input = freezeData(settlementFixture()), p = withAffinity(input), gate = freezeData(settlementGate(input)), before = canonicalJson(input);
    p.memory.points = [];
    expect(() => prepare(input, p, gate)).toThrow(/matching memory/);
    expect(canonicalJson(input)).toBe(before);
    const good = prepare(input, withAffinity(input), gate);
    expect(Object.isFrozen(good.effects[0])).toBe(true);
    expect(canonicalJson(input)).toBe(before);
  });
  it("does not manufacture a no-change receipt when preparation fails", () => {
    const input = settlementFixture(), p = withAffinity(input), gate = settlementGate(input);
    p.items.push({ grantId: "unapproved-item", basisIds: ["fact:choice"] });
    expect(() => prepare(input, p, gate)).toThrow(/grant/);
    expect(gate.receipts).toEqual([]); expect(input.state.affinity).toEqual([]);
  });
});
