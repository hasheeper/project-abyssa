import { beforeAll, describe, expect, it } from "vitest";
import { canonicalJson } from "../../game-core/contracts";
import { cloneSettlement, emptySettlementProposal } from "./context";
import { projectD5SettlementBoundary } from "./d5-source";
import { createSettlementService } from "./service";
import { clbHost } from "../testing/airp-settlement-fixture";
import { gameplaySettlementInput, settlementGameplayCase } from "../testing/airp-settlement-gameplay-case";
import { emptyUsage } from "../airp-generation/contracts";
import { directorRuntime } from "../testing/airp-director-playthrough";
import { AIRP_DIRECTOR_CATALOG } from "../../game-runtime/airp-director-context";
import { nextD5PlayCommand } from "../testing/d5-playthrough";
import { airpPhaseIndex } from "../../game-core/session";
import { createSettlementLedger } from "./service";

let play: Awaited<ReturnType<typeof settlementGameplayCase>>;
beforeAll(async () => { play = await settlementGameplayCase(); }, 30000);
describe("CL-B real gameplay record projection (mock prior prose, no production writes)", () => {
  it("projects only actual selected choices and read paragraphs with the complete Elora card", () => {
    const packet = gameplaySettlementInput(play.action, "action", play.eventId);
    expect(packet.input.scope.kind).toBe("action");
    expect(packet.input.evidence.some(e => e.kind === "read-paragraph")).toBe(true);
    expect(packet.materials.cards[0].actorId).toBe("elora"); expect(packet.materials.cards[0].text.length).toBeGreaterThan(1000);
    const all = JSON.stringify(packet.materials.evidence);
    expect(all).toContain("本步骤"); expect(all).not.toContain("第一段"); expect(all).not.toContain("planning");
    expect(packet.input.evidence.filter(s => s.kind === "read-paragraph").every(s => s.authority === "claim" && ["elora", "eustice"].includes(s.speakerId!))).toBe(true);
    expect(packet.input.evidence.filter(s => s.speakerId === "eustice").every(s => !s.knownBy.includes("elora"))).toBe(true);
  });
  it("rejects unopened plan/scene checkpoints and refuses to label action feedback as event closure", () => {
    expect(() => gameplaySettlementInput(play.offered, "event", play.eventId)).toThrow();
    expect(() => gameplaySettlementInput(play.feedback, "event", play.eventId)).toThrow(/closure/);
    const packet = gameplaySettlementInput(play.feedback, "action", play.eventId);
    expect(packet.input.scope.actionId).not.toBeNull();
  });
  it("rejects missing/retracted/cross-save source proofs", () => {
    const packet = gameplaySettlementInput(play.closed, "event", play.eventId), record = cloneSettlement(play.closed), boundary = { kind: "event" as const, eventId: play.eventId, factId: record.facts.at(-1)!.id };
    record.retractedFactIds.push(boundary.factId);
    expect(() => projectD5SettlementBoundary({ record, ledger: packet.ledger, boundary, grants: [], cards: packet.materials.cards })).toThrow(/effective/);
    record.retractedFactIds = []; record.facts.at(-1)!.source.epoch = "another-epoch";
    expect(() => projectD5SettlementBoundary({ record, ledger: packet.ledger, boundary, grants: [], cards: packet.materials.cards })).toThrow(/effective/);
  });
  it("feeds a real closed event into settlement, with original game/archive unchanged", async () => {
    const before = canonicalJson(play.closed), packet = gameplaySettlementInput(play.closed, "event", play.eventId);
    const host = clbHost(packet.input), service = createSettlementService(host.port);
    const id = await service.enqueue(packet.input, packet.materials);
    await service.begin(id, { id: "actual-case:1", model: "mock-settlement", connectionHash: "0".repeat(64), at: 1 });
    const proposal = emptySettlementProposal(packet.input), source = packet.input.evidence.find(e => e.kind === "program-fact" && e.role === "current")!;
    proposal.affinity = [{ grantId: "event-affinity:elora", gradeId: "none", reason: "本验收不将接受委托机械换算为好感。", basisIds: [source.id] }];
    proposal.memory.points = [{ kind: "fact", text: "本事件结果已读并结案；未增加资产。", speakerId: null, knownBy: source.knownBy, basisIds: [source.id] }];
    await service.result({ jobId: id, attemptId: "actual-case:1", at: 2, output: JSON.stringify(proposal), usage: emptyUsage() });
    await service.apply(id);
    expect((await service.contextForNextGm()).receipts).toHaveLength(1);
    expect(canonicalJson(play.closed)).toBe(before);
  });
  it("projects an actual completed expedition as a run outcome, never as a closed commission or another reward", async () => {
    const f = await directorRuntime();
    let record = await f.send({ type: "start-expedition", runId: "cl-b-run", routeId: AIRP_DIRECTOR_CATALOG.data.manor!.maintenanceRouteId, partyIds: AIRP_DIRECTOR_CATALOG.data.initialParty, itemIds: ["item.food", "item.potion"], seed: 19 });
    for (let step = 0; record.snapshot.run && step < 700; step++) {
      const command = nextD5PlayCommand(AIRP_DIRECTOR_CATALOG, record);
      record = await f.send(command.type === "choose-exit" ? { ...command, choice: "leave" } : command);
    }
    expect(record.snapshot.run).toBeNull();
    const base = gameplaySettlementInput(play.closed, "event", play.eventId);
    const state = { ...base.ledger.state, head: record.head, phase: airpPhaseIndex(record.snapshot.campaign.clock.day, record.snapshot.campaign.clock.phase) };
    const ledger = createSettlementLedger(base.ledger.policy, state);
    const fact = record.facts.filter(f => f.kind === "progression" && f.payload.type === "expedition-settled").at(-1)!;
    const packet = projectD5SettlementBoundary({ record, ledger, boundary: { kind: "run", factId: fact.id, eventId: null }, grants: [], cards: [] });
    expect(packet.input.scope).toMatchObject({ kind: "run", eventId: null, runId: "cl-b-run" });
    expect(packet.input.lifecycle).toEqual([{ kind: "run", id: "cl-b-run", basisIds: [fact.id] }]);
    expect(packet.input.grants).toEqual([]);
    expect(packet.materials.evidence[0].text).toContain('"eventClosed":false');
    expect(packet.materials.evidence[0].text).not.toContain("loot");
    expect(packet.materials.evidence[0].text).not.toContain("rng");
  }, 60000);
});
