import { beforeAll, describe, expect, it } from "vitest";
import { canonicalJson } from "../../game-core/contracts";
import { expeditionPlanHash } from "../../game-core/session";
import { expeditionGameplayCase } from "../testing/airp-expedition-gm-gameplay-case";
import { clcHost, clcProposal } from "../testing/airp-expedition-gm-fixture";
import { emptyUsage } from "../airp-generation/contracts";
import { cloneExpedition, compileExpeditionRequest, freezeExpeditionFrame } from "./context";
import { projectD5DepartureProofs, projectD5ExpeditionPreparation } from "./d5-source";

let commissioned: Awaited<ReturnType<typeof expeditionGameplayCase>>, exploration: Awaited<ReturnType<typeof expeditionGameplayCase>>;
beforeAll(async () => { commissioned = await expeditionGameplayCase(true); exploration = await expeditionGameplayCase(false); }, 30000);
describe("CL-C validated D5 departure projection (mock preceding prose)", () => {
  it("keeps the original task/step, full card and author source, never pretends departure occurred", () => {
    const { packet, options } = commissioned, before = canonicalJson(options.record);
    const c = packet.context.rules.commissions[0]; expect(c.stepId).toBe("patrol"); expect(c.returnRequired).toBe(true);
    expect(packet.context.rules.slots.find(s => s.id === c.slotId)?.objectiveIds).toContain(c.objectiveId);
    expect(packet.documents.find(d => d.id === "elora")!.text.length).toBe(4947);
    expect(packet.context.sources.some(s => s.kind === "author")).toBe(true);
    expect(packet.context.sources.some(s => s.kind === "read")).toBe(true);
    const input = compileExpeditionRequest(freezeExpeditionFrame(packet.context, packet.documents, packet.departure), 0).messages[1].content;
    expect(input).toContain("confirmed-not-started"); expect(input).not.toContain('"seed"'); expect(input).not.toContain('"rng"'); expect(input).not.toContain('"creationRecord"');
    expect(canonicalJson(options.record)).toBe(before); expect(options.record.snapshot.run).toBeNull();
  });
  it("projects ordinary exploration without inventing a commission", () => {
    expect(exploration.packet.context.rules.commissions).toEqual([]);
    expect(exploration.packet.context.rules.slots.length).toBeGreaterThan(4);
    expect(exploration.packet.context.rules.schedule.budget.publishedIds).toEqual([]);
    expect(exploration.packet.context.rules.slots.flatMap(s => s.objectiveIds)).toEqual([]);
    const { packet } = exploration;
    const request = compileExpeditionRequest(freezeExpeditionFrame(packet.context, packet.documents, packet.departure), 0);
    expect(request.messages[1].content).not.toContain(commissioned.packet.context.rules.commissions[0].objectiveId);
  });
  it("uses actual engine legality and refuses cross-save/stale settlement", () => {
    const bad = cloneExpedition(exploration.options); bad.departure.routeId = "invented-route";
    expect(() => projectD5ExpeditionPreparation(bad)).toThrow();
    const old = cloneExpedition(exploration.options); old.settlement.state.head.epoch = "foreign"; expect(() => projectD5ExpeditionPreparation(old)).toThrow(/stale settlement/);
  });
  it("validates departure binding against an actual program start and preserves pre-departure input", async () => {
    const { packet, f } = exploration, host = clcHost(packet), id = await host.service.enqueue(), p = clcProposal(packet);
    await host.service.begin(id, { id: "test-plan", stage: "plan", model: "mock", connectionHash: "0".repeat(64), at: 1 });
    await host.service.result(id, "test-plan", JSON.stringify(p), emptyUsage(), 2); await host.service.accept(id);
    const permit = await host.service.departurePermit(id), started = await f.send({ type: "start-expedition", ...permit.departure });
    const proofs = projectD5DepartureProofs(started); expect(proofs).toHaveLength(1); expect(proofs[0].commandHash).toBe(expeditionPlanHash(packet.departure));
    // Simulate the new owning-root startup envelope around the real old-D5 calculation.
    // These are distinct archives; this is NOT evidence that content19 already enforces the new gate.
    host.mutate(r => { expect(r.head).toEqual(permit.expectedHead); r.head = { ...r.head, revision: r.head.revision + 1 }; r.activeRunId = packet.departure.runId; r.startProofs = proofs.map(p => ({ ...p, beforeHead: permit.expectedHead })); }); await host.service.recordStarted(id);
    expect(host.raw().ledger.jobs[0].status).toBe("started"); expect(host.raw().ledger.jobs[0].frames[0].context.rules.head).toEqual(packet.context.rules.head);
    // The actual old D5 archive remains old-format; no CL-C ledger was silently installed.
    expect(started).not.toHaveProperty("expeditionGM");
  }, 30000);
});
