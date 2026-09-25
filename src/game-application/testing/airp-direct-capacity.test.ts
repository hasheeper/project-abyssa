import { expect, it } from "vitest";
import { performance } from "node:perf_hooks";
import { directReturnGate, prepareDirect, simulateDirectStage } from "./airp-direct-playthrough";
import { poolTestRuntime, readPoolConversation } from "./airp-pool-playthrough";
import { inspectDirectAttempt } from "../airp-direct-gameplay/inspection";
import { DIRECT_LIMITS } from "../airp-direct-gameplay/contracts";

// Deliberately longer than both P1 samples: planning >13.4KiB, prose >2.9KiB.
// Synthetic prose is capacity data, not live-model evidence or author canon.
const planning = "仅用于容量测试的三段规划。".repeat(700);
const paragraphs = Array.from({length: 20}, (_, i) => `第${i + 1}段：` + "艾洛拉留意着桌旁，等对方回应；这是容量测试的占位文字。".repeat(6));
const prose = paragraphs.join("\n");
const formatted = JSON.stringify({creationRecord: "容量测试封装。", lines: paragraphs.map(text => ({speaker: "narrator", emotion: "neutral", text}))});

it("retains realistic full outputs, both repairs and a safe copy BEFORE followup with verifiable ancestor recall", async () => {
  let f = await directReturnGate("cleared");
  const instanceId = (await f.read()).airpDirect!.tasks[0].instanceId;
  for (const index of [0, 1]) {
    await prepareDirect(f);
    await simulateDirectStage(f, "planning", planning);
    await simulateDirectStage(f, "writing", prose);
    await simulateDirectStage(f, "formatting", formatted + " invalid suffix");
    await simulateDirectStage(f, "formatting", formatted);
    await readPoolConversation(f);
    if (!index) await f.send({type: "airp-turn-in", instanceId});
    const r = await f.read(), scene = r.narrative.scenes.find(s => s.id === r.airpDirect!.tasks.at(-1)!.sceneId)!;
    await simulateDirectStage(f, "updater", JSON.stringify({summary: "无效支持", supports: ["foreign"], flags: []}));
    await simulateDirectStage(f, "updater", JSON.stringify({summary: "艾洛拉等候回应。", supports: [scene.body.nodes[0].id], flags: []}));
    if (!index) {
      for (let n = 0; n < 12; n++) {
        const other = (await f.read()).narrative.instances.find(i => i.status === "pending" || i.status === "offered");
        if (!other) break;
        await f.send({type: "airp-open", instanceId: other.id}); await f.send({type: "airp-decline", instanceId: other.id}); await readPoolConversation(f);
      }
      const exported = await f.runtime.application.exportSave("pool"); if (!exported.ok) throw Error("export");
      expect(await f.runtime.application.importSave({saveId: "capacity-copy", epoch: "capacity-copy-epoch", clientRequestId: "capacity-copy", archive: exported.archive})).toMatchObject({ok: true});
      const copy = await f.runtime.application.open("capacity-copy"); if (!copy.ok || copy.record.schemaVersion !== 4) throw Error("copy");
      f = poolTestRuntime(copy.record, "capacity-copy");
      await f.send({type: "airp-direct-followup", instanceId});
    }
  }
  const r = await f.read();
  expect(r.airpDirect!.tasks[1].context!.head.saveId).toBe("capacity-copy");
  expect(r.airpDirect!.tasks[0].context!.head.saveId).toBe("pool");
  expect(r.airpDirect!.tasks[1].context!.parent?.prose).toBe(prose);
  expect(r.airpDirect!.tasks[1].context!.gameMemories).toHaveLength(1);
  for (const t of r.airpDirect!.tasks) for (const a of t.attempts) expect(inspectDirectAttempt(r, t.sceneId, a.id).inputHash).toBe(a.inputHash);
  const archive = await f.runtime.application.exportSave("capacity-copy"); if (!archive.ok) throw Error("export");
  const bytes = Buffer.byteLength(archive.archive), stateBytes = Buffer.byteLength(JSON.stringify(r.airpDirect));
  expect(bytes).toBeLessThan(8 * 1024 * 1024); expect(stateBytes).toBeLessThan(DIRECT_LIMITS.stateBytes);
  const start = performance.now();
  expect(await poolTestRuntime().runtime.application.restoreSave({archive: archive.archive, clientRequestId: "capacity-restore"})).toMatchObject({ok: true});
  console.info(JSON.stringify({kind: "P2 synthetic full-length + repairs + ancestor copy", archiveBytes: bytes, stateBytes, planningBytes: Buffer.byteLength(planning), proseBytes: Buffer.byteLength(prose), replayMs: Math.round(performance.now() - start)}));
}, 300000);
