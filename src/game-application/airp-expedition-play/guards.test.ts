import { describe, expect, it } from "vitest";
import { nodeFixture, mockNodeText, readAndChooseNode, mockNodeSettlement } from "../testing/airp-node-fixture";
import { nextD5PlayCommand } from "../testing/d5-playthrough";
import { AIRP_DIRECTOR_CATALOG } from "../../game-runtime/airp-director-context";
import { assertNodeProgramMayAdvance, emptyNodeLedger } from "./service";
import { projectD5NodeProgram } from "./d5-source";
import { nodeAction, nodeGate } from "./context";
import { roomInstance } from "../../game-core/session";

describe("CL-D explicit integration guards", () => {
  it("does not let an unsynced ledger bypass the current trigger or permit content20/21", async () => {
    const f = await nodeFixture(), s = await f.nodes.read();
    expect(() => assertNodeProgramMayAdvance({ ...s, ledger: emptyNodeLedger() })).toThrow(/must be opened/);
    for (const contentVersion of [20, 21] as const) expect(() => projectD5NodeProgram({ catalog: { ...AIRP_DIRECTOR_CATALOG, ref: { ...AIRP_DIRECTOR_CATALOG.ref, contentVersion } }, record: f.raw().gameplay, plan: s.plan, commits: f.raw().programCommits })).toThrow(/validated content19 or formal content22/);
    const unstarted = await nodeFixture({ start: false }); await expect(unstarted.nodes.read()).rejects.toThrow(/departure/);
  }, 20000);
  it("requires external event publication/acceptance; planned or merely offered is not accepted", async () => {
    const f = await nodeFixture(), s = await f.nodes.read(), j = s.ledger.jobs[0];
    j.node.link = { kind: "new-event", eventKey: "side-event", step: "scene" };
    s.plan.prepared!.events.push({ id: "published:1", key: "side-event", definitionId: "test-only", basisIds: [], body: { title: "测试", themeKey: "test", themeDescription: "测试", objectIds: [], actorIds: ["kael", "elora"], load: "light", needsReturn: false, repeat: "once" } });
    expect(nodeGate(s, j)).toBe("blocked");
    s.program.events.push({ id: "published:1", status: "offered" }); expect(nodeGate(s, j)).toBe("ready");
    j.node.link.step = "feedback"; expect(nodeGate(s, j)).toBe("blocked");
    s.program.events[0].status = "accepted"; expect(nodeGate(s, j)).toBe("ready");
  }, 20000);
  it("a pending settlement blocks continuation; an empty memory is legitimate after full evidence", async () => {
    const f = await nodeFixture(), id = f.raw().nodes.jobs[0].id; await mockNodeText(f, id); await readAndChooseNode(f, id);
    const packet = await f.nodes.settlementInput(id); await f.settlement.enqueue(packet.input, packet.materials);
    await expect(f.send(nextD5PlayCommand(AIRP_DIRECTOR_CATALOG, f.raw().gameplay))).rejects.toThrow(/Pending settlement/);
    await mockNodeSettlement(f, id); expect(f.raw().nodes.jobs[0].status).toBe("completed"); expect(f.raw().settlement.memories[0].points).toEqual([]);
    expect(f.raw().settlement.jobs[0].frames[0].input.evidence.filter(e => e.kind === "read-paragraph")).toHaveLength(4);
  }, 20000);
  it("uses an engine-legal deviation instead of demanding the GM's predicted action", async () => {
    const f = await nodeFixture(), s = await f.nodes.read(), j = s.ledger.jobs[0];
    j.node.actionIds = ["continue"]; j.selected = { index: 0, text: "测试态度", head: s.head };
    const action = { ...s.program.sources[0], id: "test:actual-leave", head: { ...s.head, revision: s.head.revision + 1 }, slotId: j.node.slotId, actionId: "leave" };
    s.program.actions.push(action); expect(nodeAction(s, j)).toEqual(action);
  }, 20000);
  it("real third-layer extraction skips unvisited deep scenes without remembered events", async () => {
    const f = await nodeFixture();
    // Deliberately decline the first two optional scenes. No mock read histories are injected.
    await f.nodes.skip(f.raw().nodes.jobs[0].id); await f.nodes.skip(f.raw().nodes.jobs[1].id);
    for (let n = 0; n < 300 && !(await f.nodes.read()).program.slotIds.includes("slot:3:1:exit"); n++) await f.send(nextD5PlayCommand(AIRP_DIRECTOR_CATALOG, f.raw().gameplay));
    expect((await f.nodes.read()).program.slotIds).toContain("slot:3:1:exit");
    // Its completed prerequisite was declined, so this scene also must not open.
    const exit = f.raw().nodes.jobs[2]; await expect(f.nodes.open(exit.id)).rejects.toThrow(); await f.nodes.skip(exit.id);
    const run = f.raw().gameplay.snapshot.run; if (run?.kind !== "expedition") throw Error("No actual expedition");
    await f.send({ type: "choose-exit", runRef: { kind: "expedition", id: run.id }, roomId: roomInstance(run.state.run), choice: "leave" }); await f.nodes.sync();
    expect((await f.nodes.read()).program.terminal).toBe("extracted");
    const deep = f.raw().nodes.jobs[3]; expect(deep.status).toBe("skipped"); expect(deep.frame).toBeNull(); expect(deep.reads).toEqual([]);
    expect(f.raw().settlement.memories.some(m => m.scope.boundaryId === deep.id)).toBe(false);
  }, 180000);
});
