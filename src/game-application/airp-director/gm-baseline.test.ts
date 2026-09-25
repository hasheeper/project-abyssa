import { expect, it } from "vitest";
import { formalAirpFixture } from "../testing/airp-game-fixture";
import { directorOutput, directorPlan } from "../testing/airp-director-playthrough";
import { directorTestMaterial } from "../testing/airp-director-fixture";
import { lowR8Source } from "../../content/presentation/airp/low-r8-source";
import { SHOP_AIRP_CATALOG } from "../../game-runtime/shop-wave-context";
import { D5_RUN_READERS } from "../../game-core/session";
import { readD5Archive } from "../versions/d5-validate";
import type { AirpReplayInput } from "../versions/airp-boundary";
import { pendingHomeBoundary } from "../airp-game/home";
import { projectDirectorContext, projectDirectorScene } from "./context";
import { compileSceneGM } from "./scene-gm";
import { directorStage } from "./jobs";

// Synthetic, content24/context16 regression only. These are not real model outputs
// or a claim that the old medicine-case content acceptance passed.
const lines = [
  {speaker: "elora", emotion: "neutral", text: "我听见了。"},
  {speaker: "narrator", emotion: "neutral", text: "她收好手边的绷带。"},
  {speaker: "elora", emotion: "smile", text: "那就等你回来。"},
];
const choices = ["认真倾听", "轻松打趣", "有所保留"];
const next = {pacing: "brief", suggestedWords: 80, focus: "只回应玩家实际态度", alreadyCovered: ["已经提出请求"], stopWhen: "回应后收住", reason: "测试用续轮指导，不是事实"};

async function fixture() {
  const f = await formalAirpFixture(undefined, 24); await f.flow.sync();
  const material = directorTestMaterial();
  await f.send({type: "airp-director-configure", material, lowMaterial: lowR8Source, lowReadVersion: 6, lowContextVersion: 16});
  const wf = {read: async () => f.raw(), send: f.send};
  await directorPlan(wf, {kind: "fixed", definitionId: "ripple.elora.old-medicine-case"});
  await f.send({type: "advance-phase"}); await f.send({type: "advance-phase"});
  const event = () => f.raw().airpDirector!.events[0];
  await f.send({type: "airp-director-open", eventId: event().id});
  const job = () => f.raw().airpDirector!.jobs.find(j => j.id === f.raw().airpDirector!.reading!.jobId)!;
  const output = (stage: "writing" | "formatting" | "scene-evaluate", text: string) => directorOutput(wf, job(), stage, text);
  const body = async () => {
    await output("writing", lines.map(l => `${l.speaker}：${l.text}`).join("\n"));
    await output("formatting", JSON.stringify({lines, choices, phase: {complete: true, reason: "封装不能获得结束权"}}));
  };
  const evaluate = (complete: boolean) => output("scene-evaluate", JSON.stringify({complete, reason: "模拟阶段评估", unresolved: complete ? [] : ["等待玩家态度后的回应"], next: complete ? null : next}));
  const read = async (respond = false) => {
    const id = job().id; await f.send({type: "airp-director-show", jobId: id});
    for (let cursor = f.raw().airpDirector!.cursors[id]; cursor < lines.length; cursor++) {
      if (respond && cursor === lines.length - 1) await f.send({type: "airp-director-respond", jobId: id, index: 0});
      await f.send({type: "airp-director-read", jobId: id, cursor});
    }
  };
  const acceptance = async () => {
    await body(); await evaluate(false); await read(true);
    await body(); await evaluate(true); await read();
    expect(event().status).toBe("offered"); expect(event().selected).toEqual([]);
    await f.send({type: "airp-director-choose", eventId: event().id, choiceId: "participate"});
    expect(job().scene!.role).toBe("acceptance");
  };
  const replay = async () => {
    const exported = await f.runtime.application.exportSave("formal-airp");
    if (!exported.ok) throw Error("Test archive export failed");
    const restored = readD5Archive(exported.archive, SHOP_AIRP_CATALOG, D5_RUN_READERS);
    expect(restored).toEqual(f.raw()); return restored;
  };
  return {...f, material, event, job, body, evaluate, read, acceptance, replay};
}

it("context16 characterization: globally available evidence is NPC-filtered out of the scene GM, without leaking it to prose", async () => {
  const f = await fixture(); await f.body();
  const r = f.raw(), state = r.airpDirector!, secret = {
    id: "test:norma-private", phase: 2, text: "S0模拟：只有凯尔与诺玛知晓的旧事项。",
    knownBy: ["kael", "norma"], evidenceIds: [r.facts.at(-1)!.id],
  };
  state.memories.push(secret); // Projection fixture only; never stored as real evidence.
  const input: AirpReplayInput = {head: r.head, before: r.snapshot.campaign, after: r.snapshot.campaign,
    run: null, facts: r.facts, group: r.facts.slice(-1), retracted: r.retractedFactIds};
  const global = projectDirectorContext(SHOP_AIRP_CATALOG, state, input);
  expect(global.memories).toContainEqual(secret);
  expect(global.tasks[0].card.actions).toEqual(f.event().card.actions);
  const scene = projectDirectorScene(SHOP_AIRP_CATALOG, state, f.event(), input);
  expect(scene.memories.some(m => m.id === secret.id)).toBe(false);
  const j = {...f.job(), scene}, gm = compileSceneGM(j, "scene-evaluate");
  expect(j.planning).toBeNull();
  expect(JSON.parse(gm.messages[1].content).memories.some((m: {id: string}) => m.id === secret.id)).toBe(false);
  expect(JSON.stringify(j.lowFrame!.messages)).not.toContain(secret.text);
  expect(gm.messages.some(m => m.content.includes(secret.text))).toBe(false);
  const absent = lowR8Source.sources.find(s => s.kind === "character" && s.id === "norma")!;
  expect(absent.text.length).toBeGreaterThan(0);
  expect(gm.messages.some(m => m.content.includes(absent.text))).toBe(false);
  for (const source of j.lowFrame!.sources) expect(gm.messages.some(m => m.content.includes(source.text))).toBe(true);
  expect(f.raw().airpDirector!.memories.some(m => m.id === secret.id)).toBe(false);
}, 60000);

it("frozen context16 GM request survives configuration changes and archive replay; pending text is not read evidence", async () => {
  const f = await fixture(); await f.body();
  const before = f.job(), gm = compileSceneGM(before, "scene-evaluate"), context = JSON.parse(gm.messages[1].content);
  expect(directorStage(before)).toBe("scene-evaluate"); expect(before.lowPhase).toBeUndefined();
  expect(context.currentText).toEqual(lines); expect(context.previousRead).toEqual([]);
  expect(context.candidateAttitudes).toEqual(choices);
  expect(f.event().readSceneIds).toEqual([]);
  expect(f.raw().airpDirector!.memories.some(m => m.id === `memory:${before.id}`)).toBe(false);
  await f.send({type: "airp-director-configure", material: f.material, lowContextVersion: 15});
  expect(f.raw().airpDirector!.lowContextVersion).toBe(15);
  expect(f.job()).toEqual(before); expect(compileSceneGM(f.job(), "scene-evaluate")).toEqual(gm);
  const restored = await f.replay();
  expect(compileSceneGM(restored.airpDirector!.jobs.find(j => j.id === before.id)!, "scene-evaluate")).toEqual(gm);
  expect(f.raw().airpGame!.settlement.memories).toEqual([]);
}, 60000);

it("acceptance completion applies only after the last read; partial replay, pause and duplicate reads cannot depart or settle", async () => {
  const f = await fixture(); await f.acceptance(); await f.body(); await f.evaluate(true);
  const id = f.job().id, settlement = f.raw().airpGame!.settlement;
  expect(f.job().lowChoices).toEqual([]);
  expect(f.event()).toMatchObject({status: "accepted", role: "acceptance", actionPhase: null});
  expect(f.event().readSceneIds).not.toContain(id);
  await f.send({type: "airp-director-show", jobId: id});
  await f.send({type: "airp-director-read", jobId: id, cursor: 0});
  expect(f.event().readSceneIds).not.toContain(id);
  expect(f.raw().airpDirector!.memories.some(m => m.id === `memory:${id}`)).toBe(false);
  expect(pendingHomeBoundary(f.raw())).toBeNull();
  await f.replay();
  await f.send({type: "airp-director-pause"});
  await f.send({type: "airp-director-open", eventId: f.event().id});
  expect(f.raw().airpDirector!.reading!.cursor).toBe(1);
  expect(f.event()).toMatchObject({status: "accepted", role: "acceptance", actionPhase: null});
  await f.read();
  expect(f.event()).toMatchObject({status: "waiting-action", role: "action", actionPhase: 2, actionOutcome: null, binding: null});
  expect(f.event().readSceneIds.filter(readId => readId === id)).toHaveLength(1);
  expect(f.raw().airpDirector!.memories.filter(m => m.id === `memory:${id}`)).toHaveLength(1);
  expect(f.raw().snapshot.run).toBeNull(); expect(f.event().delivery).toBeUndefined();
  expect(pendingHomeBoundary(f.raw())).toBeNull();
  const after = f.raw().airpGame!.settlement;
  expect(after.memories).toEqual(settlement.memories); expect(after.openThreads).toEqual(settlement.openThreads);
  expect(after.receipts).toEqual(settlement.receipts);
  expect(after.state.actors).toEqual(settlement.state.actors); expect(after.state.affinity).toEqual(settlement.state.affinity);
  const beforeDuplicate = f.raw();
  await expect(f.send({type: "airp-director-read", jobId: id, cursor: lines.length - 1})).rejects.toThrow();
  expect(f.raw()).toEqual(beforeDuplicate);
  for (const j of f.raw().airpDirector!.jobs.filter(j => j.kind === "scene")) {
    expect(j.attempts.map(a => a.stage)).toEqual(["writing", "formatting", "scene-evaluate"]);
  }
  await f.replay();
}, 120000);

it("the post-acceptance reply is not skipped before the player's new choice has a response", async () => {
  const f = await fixture(); await f.acceptance();
  expect(f.job().scene!.dialogue!.selectedResponse).toBeNull();
  expect(f.job().scene!.previousEvaluation).toBeNull();
  expect(f.job().scene!.selected).toEqual([expect.objectContaining({id: "participate"})]);
  expect(f.job().text).toBeNull(); expect(f.event().actionPhase).toBeNull();
  expect(directorStage(f.job())).toBe("writing");
  expect(pendingHomeBoundary(f.raw())).toBeNull();
  expect(f.raw().airpGame!.settlement.memories).toEqual([]);
  expect(f.raw().airpGame!.settlement.openThreads).toEqual([]);
}, 90000);
