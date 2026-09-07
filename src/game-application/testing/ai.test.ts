import { it, expect, describe } from "vitest";
import { createAiCoordinator } from "../ai";
import type {
  AiRequest,
  AiResponse,
  AiPortResult,
  AiClockPort,
  AiApplicationPort,
  AiScene,
} from "../ai";
import { LocalReactionPort } from "../../game-infrastructure/ai/local";
import { MemoryGameStore } from "../../game-infrastructure/storage/memory";
import { appFor, creation, opened, send, startCommand } from "./helpers";
import { projectFacts } from "../facts";
const options = {
  cueId: "cue1",
  sceneId: "scene",
  actorIds: ["kael"],
  emoteIds: ["calm"],
  actionIds: ["nod"],
  timeoutMs: 1000,
  maxLines: 2,
  maxCharacters: 80,
};
class Clock implements AiClockPort {
  time = 0;
  tasks = new Set<() => void>();
  now() {
    return this.time;
  }
  schedule(_ms: number, fn: () => void) {
    this.tasks.add(fn);
    return () => {
      this.tasks.delete(fn);
    };
  }
  expire() {
    this.time = 1000;
    for (const task of [...this.tasks]) task();
  }
}
class Deferred implements AiApplicationPort {
  request!: AiRequest;
  resolve!: (r: AiPortResult) => void;
  cancelled = 0;
  start(request: AiRequest) {
    this.request = request;
    return {
      result: new Promise<AiPortResult>((resolve) => {
        this.resolve = resolve;
      }),
      cancel: () => {
        this.cancelled++;
      },
    };
  }
  output(): AiResponse {
    return {
      version: 1,
      task: "react-to-commit",
      cueId: this.request.cueId,
      source: this.request.source,
      expeditionId: this.request.expeditionId,
      sceneId: this.request.sceneId,
      lines: [
        {
          speakerId: "kael",
          text: "一起走吧。",
          emoteId: "calm",
          actionId: null,
          factIds: [this.request.facts[0].id],
        },
      ],
    };
  }
}
async function fixture() {
  const app = appFor(new MemoryGameStore());
  await app.create(creation());
  await send(app, startCommand);
  const record = await opened(app);
  const scene: AiScene = {
    head: { ...record.head },
    expeditionId: "run",
    sceneId: "scene",
  };
  const clock = new Clock(),
    port = new Deferred(),
    ai = createAiCoordinator(port, clock, () => scene);
  return { app, record, scene, clock, port, ai };
}
describe("Committed facts and optional local AI", () => {
  it("uses the local port and exposes only authorized evidence", async () => {
    const f = await fixture();
    const ai = createAiCoordinator(
      new LocalReactionPort(),
      f.clock,
      () => f.scene,
    );
    expect(await ai.start(f.record, options).result).toMatchObject({
      status: "accepted",
    });
    const simulation = structuredClone(f.record);
    simulation.facts.forEach((fact) => {
      fact.origin = "simulation";
    });
    expect(projectFacts(simulation, ["kael"])).toEqual([]);
    const dto = projectFacts(f.record, ["kael"]);
    expect(JSON.stringify(dto)).not.toMatch(
      /rng|seed|cursor|characters|intents|effects|funds/,
    );
    expect(projectFacts(f.record, ["not-present"])).toEqual([]);
    expect(
      projectFacts(f.record, [], { ...f.record.head, revision: 0 }),
    ).toEqual([]);
  });
  it("accepts once and leaves the committed snapshot and RNG unchanged", async () => {
    const f = await fixture(),
      before = await opened(f.app),
      task = f.ai.start(f.record, options);
    f.port.resolve({ status: "success", output: f.port.output() });
    expect(await task.result).toMatchObject({ status: "accepted" });
    expect(await f.ai.start(f.record, options).result).toEqual({
      status: "skipped",
      reason: "duplicate-cue",
    });
    expect(await opened(f.app)).toEqual(before);
  });
  it.each(["failed", "cancelled"] as const)("skips port %s", async (status) => {
    const f = await fixture(),
      task = f.ai.start(f.record, options);
    f.port.resolve({ status });
    expect(await task.result).toEqual({ status: "skipped", reason: status });
  });
  it("times out even when a port never settles and ignores its late response", async () => {
    const f = await fixture(),
      task = f.ai.start(f.record, options);
    f.clock.expire();
    expect(await task.result).toEqual({ status: "skipped", reason: "timeout" });
    f.port.resolve({ status: "success", output: f.port.output() });
    expect(await task.result).toMatchObject({ reason: "timeout" });
    expect(f.port.cancelled).toBe(1);
  });
  it("cancels immediately and disposes all pending tasks", async () => {
    const f = await fixture(),
      task = f.ai.start(f.record, options);
    f.ai.dispose();
    expect(
      await f.ai.start(f.record, { ...options, cueId: "after-disposal" })
        .result,
    ).toMatchObject({ reason: "disposed" });
    expect(await task.result).toMatchObject({ reason: "cancelled" });
    expect(f.port.cancelled).toBe(1);
  });
  it.each(["head", "scene", "expedition"])(
    "rejects a late result after %s changes",
    async (field) => {
      const f = await fixture(),
        task = f.ai.start(f.record, options);
      if (field === "head") f.scene.head.revision++;
      else if (field === "scene") f.scene.sceneId = "scene2";
      else f.scene.expeditionId = "run2";
      f.port.resolve({ status: "success", output: f.port.output() });
      expect(await task.result).toMatchObject({ reason: "stale-source" });
    },
  );
  it.each([
    [
      "speaker",
      (r: AiResponse) => {
        r.lines[0].speakerId = "norma";
      },
    ],
    [
      "asset",
      (r: AiResponse) => {
        r.lines[0].emoteId = "unknown";
      },
    ],
    [
      "fact",
      (r: AiResponse) => {
        r.lines[0].factIds = ["fact:missing"];
      },
    ],
    [
      "budget",
      (r: AiResponse) => {
        r.lines[0].text = "长".repeat(81);
      },
    ],
    [
      "source",
      (r: AiResponse) => {
        r.source = { ...r.source, revision: 0 };
      },
    ],
    [
      "extra patch",
      (r: AiResponse) => {
        Object.assign(r, { grantGold: 999 });
      },
    ],
  ] as const)("rejects invalid %s", async (_name, mutate) => {
    const f = await fixture(),
      task = f.ai.start(f.record, options),
      output = f.port.output();
    mutate(output);
    f.port.resolve({ status: "success", output });
    expect(await task.result).toMatchObject({ reason: "invalid-output" });
  });
  it("does not let an older out-of-order cue attach to the newer commit", async () => {
    const f = await fixture(),
      old = f.ai.start(f.record, options);
    await send(f.app, {
      type: "battle-command",
      expeditionId: "run",
      command: { type: "roll-dice" },
    });
    f.scene.head = (await opened(f.app)).head;
    f.port.resolve({ status: "success", output: f.port.output() });
    expect(await old.result).toMatchObject({ reason: "stale-source" });
  });
  it("contains synchronous provider failure and cancellation exceptions", async () => {
    const f = await fixture();
    const ai = createAiCoordinator(
      {
        start() {
          throw new Error("offline");
        },
      },
      f.clock,
      () => f.scene,
    );
    expect(await ai.start(f.record, options).result).toMatchObject({
      reason: "failed",
    });
    expect(f.clock.tasks.size).toBe(0);
  });
});

it('authorizes only current settlement witnesses after the active expedition is removed', async () => {
  const { terminal } = await import('./helpers');
  const f = await fixture(); const end = await terminal(f.app);
  await send(f.app, { type: 'settle-expedition', expeditionId: 'run', terminalRef: end.pendingSettlement!.terminalRef });
  const settled = await opened(f.app);
  const scene: AiScene = { head: settled.head, expeditionId: 'run', sceneId: 'mansion' };
  const ai = createAiCoordinator(new LocalReactionPort(), f.clock, () => scene);
  const accepted = await ai.start(settled, { ...options, sceneId: 'mansion' }).result;
  expect(accepted).toMatchObject({ status: 'accepted', output: { expeditionId: 'run', lines: [{ speakerId: 'kael', text: '已经回到洋馆了，先休息一下吧。' }] } });
  expect(await ai.start(settled, { ...options, cueId: 'stranger', sceneId: 'mansion', actorIds: ['abyssa'] }).result).toMatchObject({ status: 'skipped', reason: 'unauthorized-participant' });
  const retracted = structuredClone(settled);
  retracted.retractedFactIds.push(...retracted.facts.filter(fact => fact.kind === 'expedition-settled').map(fact => fact.id));
  expect(await ai.start(retracted, { ...options, cueId: 'withdrawn', sceneId: 'mansion' }).result).toMatchObject({ status: 'skipped', reason: 'unauthorized-participant' });
  await send(f.app, { ...startCommand, expeditionId: 'second' });
  scene.head = (await opened(f.app)).head; scene.expeditionId = 'second';
  expect(await ai.start(settled, { ...options, cueId: 'stale-home', sceneId: 'mansion' }).result).toMatchObject({ status: 'skipped', reason: 'stale-source' });
  ai.dispose();
});
