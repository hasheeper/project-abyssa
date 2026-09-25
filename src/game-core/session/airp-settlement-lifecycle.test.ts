import { expect, it } from "vitest";
import type { SettlementInput, SettlementProposal, SettlementThread } from "../contracts/airp-settlement";
import { prepareAirpSettlement } from "./airp-settlement";
import { settlementFixture, settlementGate, settlementPoint, settlementProposal } from "./testing/airp-settlement-fixture";

function batch(input: SettlementInput, proposal = settlementProposal(input)) {
  const result = prepareAirpSettlement(input, proposal, settlementGate(input));
  if (result.status !== "prepared") throw Error("Expected prepared");
  return result.batch;
}
function threads(input: SettlementInput) {
  const p = settlementProposal(input);
  p.memory.open = [
    { ...settlementPoint(), key: "check-route", until: "run-end" },
    { ...settlementPoint(), key: "deliver-objective", until: "event-end" },
    { ...settlementPoint(), key: "keep-promise", until: "resolved" },
    { ...settlementPoint(), key: "legacy-unknown" },
  ];
  return batch(input, p).memory.opened;
}

it("run termination expires only explicit run-local work, not delivery, lasting promises or legacy threads", () => {
  const input = settlementFixture(); input.openThreads = threads(input);
  input.lifecycle = [{ kind: "run", id: "run:1", basisIds: ["fact:choice"] }];
  const result = batch(input);
  expect(result.memory.closed.map(c => c.id)).toEqual([input.openThreads[0].id]);
  expect(result.memory.opened).toEqual([]); expect(result.effects).toEqual([]);
  expect(result.memory.sources.some(s => s.id === "fact:choice")).toBe(true);
});

it("event closure expires event-local work but does not claim a lasting promise was fulfilled", () => {
  const input = settlementFixture(); input.openThreads = threads(input);
  input.lifecycle = [{ kind: "event", id: "event:1", basisIds: ["fact:choice"] }];
  expect(batch(input).memory.closed.map(c => c.id)).toEqual([input.openThreads[1].id]);
});

it("same topic has a stable scope-owned identity across settlement boundaries and is not reopened", () => {
  const input = settlementFixture(), initial = threads(input);
  input.openThreads = initial; input.scope.boundaryId = "feedback:next";
  const p = settlementProposal(input);
  p.memory.open = [{ ...settlementPoint(), text: "换了措辞的同一交付事项。", key: "deliver-objective", until: "event-end" }];
  expect(batch(input, p).memory.opened).toEqual([]);
  input.openThreads = []; input.scope.eventId = "event:2";
  input.grants = [];
  input.evidence = input.evidence.map(e => ({ ...e, eventId: "event:2" }));
  const other = settlementProposal(input); other.memory.open = p.memory.open;
  expect(batch(input, other).memory.opened[0].id).not.toBe(initial[1].id);
});

it("does not reopen an ended scope and permits explicit model closure of a legacy local thread", () => {
  const input = settlementFixture(); input.openThreads = threads(input);
  input.lifecycle = [{ kind: "run", id: "run:1", basisIds: ["fact:choice"] }];
  const p = settlementProposal(input);
  p.memory.open = [{ ...settlementPoint(), key: "new-route", until: "run-end" }];
  p.memory.close = [{ id: input.openThreads[3].id, basisIds: ["fact:choice"] }];
  const result = batch(input, p);
  expect(result.memory.opened).toEqual([]);
  expect(result.memory.closed.map(c => c.id).sort()).toEqual([input.openThreads[0].id, input.openThreads[3].id].sort());
});

it("cannot infer a scope ending from narration or an absent owner", () => {
  const input = settlementFixture(); input.openThreads = threads(input);
  input.lifecycle = [{ kind: "run", id: "run:1", basisIds: ["read:1"] }];
  expect(() => batch(input)).toThrow(/actual program/);
  delete input.lifecycle; input.scope.runId = null; input.evidence = input.evidence.map(e => ({ ...e, runId: null }));
  const p = settlementProposal(input); p.memory.open = [{ ...settlementPoint(), key: "new-local", until: "run-end" }];
  expect(() => batch(input, p)).toThrow(/owning run/);
});

it("old proposals preserve their original thread shape and identity without a silent migration", () => {
  const input = settlementFixture(), p: SettlementProposal = settlementProposal(input);
  p.memory.open = [{ ...settlementPoint(), key: "old" }];
  const old = batch(input, p).memory.opened[0];
  expect(old).not.toHaveProperty("until"); expect(old).not.toHaveProperty("topicKey");
  input.openThreads = [old as SettlementThread]; input.lifecycle = [{ kind: "event", id: "event:1", basisIds: ["fact:choice"] }];
  expect(batch(input).memory.closed).toEqual([]);
});
