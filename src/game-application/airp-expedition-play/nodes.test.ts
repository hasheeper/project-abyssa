import { describe, expect, it } from "vitest";
import { nodeFixture, mockNodeText, mockNodeWriting, readAndChooseNode, mockNodeSettlement } from "../testing/airp-node-fixture";
import { nextD5PlayCommand } from "../testing/d5-playthrough";
import { AIRP_DIRECTOR_CATALOG } from "../../game-runtime/airp-director-context";
import { lowHash } from "../airp-low/native";
import { emptyUsage } from "../airp-generation/contracts";
import { createNodeService } from "./service";
import { nodeGate } from "./context";

describe("CL-D node/Low/settlement owning-root handoff", () => {
  it("persists reader entry before the first acknowledgement, without world effects or duplicate commits", async () => {
    const f = await nodeFixture(), id = f.raw().nodes.jobs[0].id;
    await expect(f.nodes.show(id)).rejects.toThrow();
    await mockNodeText(f, id);
    const world = (await f.nodes.read()).worldHead, gameplay = lowHash(f.raw().gameplay);
    await f.nodes.show(id);
    const saved = f.raw(); f.restore(saved);
    const restored = createNodeService(f.nodePort), node = (await restored.read()).ledger.jobs[0];
    expect(node.shown).toBe(true); expect(node.reads).toEqual([]); expect(node.selected).toBeNull();
    expect((await restored.read()).worldHead).toEqual(world);
    expect(lowHash(f.raw().gameplay)).toBe(gameplay);
    await restored.show(id); expect(f.raw().head).toEqual(saved.head);
    await expect(restored.skip(id)).rejects.toThrow();
    await restored.readLine(id, 0); expect((await restored.read()).ledger.jobs[0].reads).toHaveLength(1);
  }, 20000);
  it("starts a real D5 run with the CL-C ticket, only opens current node and hides future/loot data", async () => {
    const f = await nodeFixture(), s = await f.nodes.read(), entry = s.ledger.jobs[0];
    expect(f.raw().gm.jobs[0].status).toBe("started"); expect(s.program.start.beforeHead).toEqual(f.raw().gm.jobs[0].departureTicket?.expectedHead);
    expect(nodeGate(s, entry)).toBe("ready"); await expect(f.nodes.open(s.ledger.jobs[1].id)).rejects.toThrow();
    const unchanged = lowHash(f.raw().gameplay); await f.nodes.open(entry.id);
    expect(lowHash(f.raw().gameplay)).toBe(unchanged); const frame = f.raw().nodes.jobs[0].frame!;
    expect(frame.scene.scenario).not.toContain("slot:5:0"); expect(frame.scene.scenario).not.toMatch(/lootTable|returnedLoot|seed|rng/);
    expect(frame.sources.find(s => s.id === "elora")?.text.length).toBe(4947);
    const scenario = JSON.parse(frame.scene.scenario), current = JSON.parse(frame.scene.currentTurn!.split("\n").at(-1)!);
    expect(scenario.scene.allowedProgramActions).toEqual(["continue"]);
    expect(current.currentProgram).toMatchObject({ version: 8, layer: 1, roomIndex: 0, timing: "arrive", availableActions: [{ id: "continue" }], gmSuggestedActionIds: [], actualActions: [], choicesAreAttitudes: true });
    expect(frame.messages.at(-1)!.content.endsWith(frame.scene.currentTurn!)).toBe(true);
    expect(frame.scene.currentTurn).toContain("而不是下一步怎样处理任务或物件");
    expect(frame.scene.currentTurn).toContain("普通探索不必全员轮流表态");
    expect(frame.scene.currentTurn).toContain("不替玩家先作回答或承诺");
    expect(frame.scene.currentTurn!.split("【当前回应】")).toHaveLength(2);
    expect(frame.scene.currentTurn).not.toContain("slot:5:0");
  }, 20000);
  it("keeps generated/half-read/selected states distinct and blocks premature gameplay", async () => {
    const f = await nodeFixture(), id = f.raw().nodes.jobs[0].id;
    await mockNodeText(f, id); const play = nextD5PlayCommand(AIRP_DIRECTOR_CATALOG, f.raw().gameplay);
    await expect(f.send(play)).rejects.toThrow(/Read\/resolve/); await expect(f.nodes.choose(id, 0)).rejects.toThrow(); await expect(f.nodes.readLine(id, 1)).rejects.toThrow();
    await f.nodes.readLine(id, 0); const saved = f.raw(); f.restore(saved);
    const restored = createNodeService(f.nodePort); expect((await restored.read()).ledger.jobs[0].reads).toHaveLength(1);
    await f.nodes.readLine(id, 0); expect(f.raw().head).toEqual(saved.head);
    await readAndChooseNode(f, id); const before = f.raw(); await f.nodes.choose(id, 0); expect(f.raw().head).toEqual(before.head);
    await expect(f.nodes.choose(id, 1)).rejects.toThrow(); await expect(f.nodes.skip(id)).rejects.toThrow(); await expect(f.nodes.complete(id)).rejects.toThrow(/receipt/);
    const packet = await f.nodes.settlementInput(id), texts = packet.materials.evidence.map(s => s.text).join("\n");
    expect(packet.materials.checkpoint).toEqual({ kind: "scene", trackedTasks: [] });
    expect(texts).toContain("谨慎确认情况"); expect(texts).not.toContain("暂时保留意见"); expect(texts).not.toMatch(/thinking|planning|行こう/);
    expect(packet.input.grants).toEqual([]); expect(packet.materials.cards[0].text.length).toBe(4947);
  }, 20000);
  it("waits for CL-B, then uses full read dialogue and actual first-room result at the next node", async () => {
    const f = await nodeFixture(), id = f.raw().nodes.jobs[0].id;
    await mockNodeText(f, id); await readAndChooseNode(f, id); await mockNodeSettlement(f, id);
    const before = f.raw(); await f.nodes.complete(id); expect(f.raw().head).toEqual(before.head);
    for (let n = 0; n < 140 && f.raw().gameplay.snapshot.run?.kind === "expedition"; n++) {
      if ((await f.nodes.read()).program.slotIds.includes("slot:1:0:cleared")) break;
      await f.send(nextD5PlayCommand(AIRP_DIRECTOR_CATALOG, f.raw().gameplay));
    }
    await f.nodes.sync(); const second = f.raw().nodes.jobs[1]; await mockNodeText(f, second.id);
    expect(f.raw().nodes.jobs[1].frame!.scene.userInput).toContain("门就在前面，要走了吗？"); expect(f.raw().nodes.jobs[1].frame!.scene.userInput).toContain("谨慎确认情况");
    await readAndChooseNode(f, second.id); await expect(f.nodes.settlementInput(second.id)).rejects.toThrow(/real action/);
    // Healing/resume may precede the actual room advance; never synthesize its proof.
    for (let n = 0; n < 8 && !(await f.nodes.read()).program.actions.some(a => a.slotId === second.node.slotId && a.actionId === "continue"); n++) await f.send(nextD5PlayCommand(AIRP_DIRECTOR_CATALOG, f.raw().gameplay));
    const packet = await f.nodes.settlementInput(second.id); expect(packet.materials.evidence.some(s => s.text.includes("actual-program-action"))).toBe(true);
    await mockNodeSettlement(f, second.id); expect(f.raw().settlement.receipts).toHaveLength(2); expect(f.raw().gameplay.airpDirector!.events).toHaveLength(0);
  }, 60000);
  it("skips only unread nodes and never gives skipped branches history", async () => {
    const f = await nodeFixture(), id = f.raw().nodes.jobs[0].id; await f.nodes.skip(id);
    const j = f.raw().nodes.jobs[0]; expect(j.status).toBe("skipped"); expect(j.frame).toBeNull(); expect(j.reads).toEqual([]); expect(f.raw().settlement.memories).toEqual([]);
    await expect(f.nodes.open(id)).rejects.toThrow();
  });
  it("passes imperfect drafts forward but does not publish interrupted late postprocessing", async () => {
    const f = await nodeFixture(), id = f.raw().nodes.jobs[0].id; await f.nodes.open(id);
    await f.nodes.begin(id, { id: "bad", stage: "writing", model: "mock", connectionHash: "4".repeat(64), at: 10 });
    await f.nodes.result(id, "bad", "invalid draft", { inputTokens: 1, outputTokens: 1, totalTokens: 2 }, 11);
    expect(f.raw().nodes.jobs[0].attempts[0].output).toBe("invalid draft"); expect(f.raw().nodes.jobs[0].text).toBeNull();
    expect(f.raw().nodes.jobs[0].attempts[0].status).toBe("succeeded");
    await f.nodes.begin(id, { id: "late", stage: "formatting", model: "mock", connectionHash: "4".repeat(64), at: 12 }); await f.nodes.interrupt(id, "late", 13);
    await f.nodes.result(id, "late", mockNodeWriting(), emptyUsage(), 14); expect(f.raw().nodes.jobs[0].attempts[1].status).toBe("failed");
  });
  it("root CAS admits only one concurrent begin; no extra attempts or effects", async () => {
    const f = await nodeFixture(), id = f.raw().nodes.jobs[0].id; await f.nodes.open(id);
    const args = { stage: "writing" as const, model: "mock", connectionHash: "4".repeat(64), at: 10 };
    const r = await Promise.allSettled([f.nodes.begin(id, { ...args, id: "a" }), f.nodes.begin(id, { ...args, id: "b" })]);
    expect(r.filter(r => r.status === "fulfilled")).toHaveLength(1); expect(f.raw().nodes.jobs[0].attempts).toHaveLength(1);
  });
  it("rejects mutated visible text and foreign departure proof on restoration", async () => {
    const f = await nodeFixture(), id = f.raw().nodes.jobs[0].id; await mockNodeText(f, id);
    const corrupt = f.raw(); corrupt.nodes.jobs[0].text!.lines[0].text += "changed"; expect(() => f.restore(corrupt)).toThrow();
    const foreign = f.raw(); foreign.gm.jobs[0].startFactId = "other"; expect(() => f.restore(foreign)).toThrow();
  });
});
