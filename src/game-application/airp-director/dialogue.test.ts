import { expect, it } from "vitest";
import { formalAirpFixture } from "../testing/airp-game-fixture";
import { directorPlan, directorOutput } from "../testing/airp-director-playthrough";
import { directorTestMaterial } from "../testing/airp-director-fixture";
import { lowR8Source } from "../../content/presentation/airp/low-r8-source";
import { pendingHomeBoundary } from "../airp-game/home";
import { readD5Archive } from "../versions/d5-validate";
import { AIRP_GAME_CATALOG } from "../../game-runtime/airp-game-context";
import { D5_RUN_READERS } from "../../game-core/session";
import { compileLowRequest } from "../airp-low/output";
import { directorLowFrame } from "./low";

async function fixture(card = "ripple.elora.old-medicine-case", version: 12 | 13 = 12) {
  const f = await formalAirpFixture(); await f.flow.sync();
  await f.send({type: "airp-director-configure", material: directorTestMaterial(), lowMaterial: lowR8Source, lowReadVersion: 6, lowContextVersion: version});
  const wf = {read: async () => f.raw(), send: f.send};
  await directorPlan(wf, {kind: "fixed", definitionId: card});
  await f.send({type: "advance-phase"}); await f.send({type: "advance-phase"});
  const eventId = f.raw().airpDirector!.events[0].id;
  const job = () => f.raw().airpDirector!.jobs.find(j => j.id === f.raw().airpDirector!.reading?.jobId)!;
  async function text(complete: boolean) {
    let j = job();
    j = await directorOutput(wf, j, "writing", "艾洛拉：我听见你的回答了。");
    j = await directorOutput(wf, j, "formatting", JSON.stringify({lines: [{speaker: j.scene!.actorIds[0], emotion: "smile", text: "我听见你的回答了。"}],
      choices: complete ? [] : ["认真倾听", "轻松打趣", "有所保留"], phase: {complete, reason: complete ? "当前阶段已回应完毕" : "仍需回应"}}));
    await f.send({type: "airp-director-show", jobId: j.id}); return j;
  }
  async function read() { const j = job(); if (j.lowChoices?.length) await f.send({type: "airp-director-respond", jobId: j.id, index: 1}); await f.send({type: "airp-director-read", jobId: j.id, cursor: 0}); }
  await f.send({type: "airp-director-open", eventId});
  return {...f, eventId, job, text, read};
}
it("selected response starts another writing/formatting turn; only formatted phase completion exposes acceptance", async () => {
  const f = await fixture(), first = await f.text(false); await f.read();
  expect(f.raw().airpDirector!.reading).toMatchObject({paused: false, cursor: 0});
  expect(f.job().id).not.toBe(first.id); expect(f.job().scene!.dialogue).toMatchObject({turn: 1, selectedResponse: "轻松打趣"});
  expect(f.job().scene!.dialogue?.programDecisionPending).toBe(true);
  expect(f.job().lowFrame!.formatInstruction).toContain("仅仅“等待玩家接单／决定是否参与”不属于未解决的对话问题");
  expect(f.job().scene!.previous.some(p => p.sceneId === first.id)).toBe(true);
  expect(f.raw().airpDirector!.events[0].status).toBe("offered");
  await expect(f.send({type: "airp-director-choose", eventId: f.eventId, choiceId: "participate"})).rejects.toThrow();
  await f.text(false); await f.read(); expect(f.job().scene!.dialogue!.turn).toBe(2);
  await f.text(true); await f.read();
  await f.send({type: "airp-director-choose", eventId: f.eventId, choiceId: "participate"});
  expect(f.job().scene!.role).toBe("acceptance"); expect(f.raw().airpDirector!.reading?.paused).toBe(false);
  expect(f.job().scene!.dialogue!.taskGuide.join(" ")).toContain("第3层");
  expect(f.job().scene!.dialogue!.taskGuide.join(" ")).toContain("明确交付");
  await f.text(true); await f.read();
  expect(f.raw().airpDirector!.events[0]).toMatchObject({status: "waiting-action", role: "action", actionPhase: 2});
  expect(f.raw().airpDirector!.reading?.completed).toBe(true);
  expect(f.raw().snapshot.run).toBeNull(); expect(pendingHomeBoundary(f.raw())).toBeNull();
  const archive = await f.runtime.application.exportSave("formal-airp"); if (!archive.ok) throw Error("export");
  expect(readD5Archive(archive.archive, AIRP_GAME_CATALOG, D5_RUN_READERS)).toEqual(f.raw());
}, 120000);
it("v13 activates the opening once, replies instead of offering again, and gives the formatter cumulative full dialogue", async () => {
  const f = await fixture(undefined, 13), first = f.job(), initial = first.lowFrame!;
  const source = JSON.parse(initial.scene.scenario);
  expect(source.eventBrief.requestReference.id).toContain("offer");
  expect(source.activeAuthorScript).toBeNull();
  expect(source.eventBrief.requestDefinition).toBeNull();
  const old = directorLowFrame(lowR8Source, first.scene!, 12, 6);
  expect(initial.trace).toEqual(old.trace); expect(initial.sampling).toEqual(old.sampling);
  expect(initial.sources).toEqual(old.sources);
  await f.text(false); await f.read();
  const reply = f.job(), frame = reply.lowFrame!, scene = reply.scene!;
  expect(scene.intent).toContain("只回应玩家本轮");
  expect(scene.dialogue!.purpose).toBe(scene.intent);
  expect(frame.scene.currentTurn).not.toContain("把事情交到玩家面前即止");
  expect(frame.scene.currentTurn).toContain("不按初次完整场景的约600字、20段扩写");
  const data = JSON.parse(frame.scene.scenario);
  expect(data.eventBrief.requestReference).toBeNull(); expect(data.activeAuthorScript).toBeNull();
  const definitions = data.eventBrief.requestDefinition.statements;
  expect(definitions).toEqual(source.eventBrief.requestReference.nodes.flatMap((n: any) => n.frames.filter((l: any) => l.kind === "dialogue")));
  expect(JSON.stringify(data)).not.toContain("袋口合不上");
  expect(JSON.stringify(definitions)).toContain("里面即使剩着药，也别拿来用。我要的只是箱子。");
  const payload = JSON.parse(compileLowRequest(frame, "艾洛拉：我听见你的回答了。", 6, 2).messages[1].content);
  expect(payload.stageContext.previousRead).toEqual(scene.previous);
  expect(scene.previous[0].text).toBe("elora：我听见你的回答了。");
  expect(frame.formatInstruction).toContain("不要求本轮重述");
  expect(frame.formatInstruction).toContain("不再复制进lines");
  expect(f.raw().airpDirector!.jobs.find(j => j.id === first.id)!.lowFrame).toEqual(initial);
  await f.text(true); await f.read();
  await f.send({type: "airp-director-choose", eventId: f.eventId, choiceId: "participate"});
  const acceptance = f.job();
  expect(acceptance.scene!.intent).toContain("只补前文尚未交代");
  expect(acceptance.scene!.dialogue!.previousRead).toHaveLength(2);
  expect(acceptance.lowFrame!.scene.currentTurn).not.toContain("需把taskGuide中的目标");
  await f.text(true); await f.read();
  expect(f.raw().airpDirector!.events[0]).toMatchObject({status: "waiting-action", actionPhase: 2});
  expect(f.raw().snapshot.run).toBeNull();
  const archive = await f.runtime.application.exportSave("formal-airp"); if (!archive.ok) throw Error("export");
  expect(readD5Archive(archive.archive, AIRP_GAME_CATALOG, D5_RUN_READERS)).toEqual(f.raw());
}, 120000);
it("result continuations do not settle or close the event before the formatter ends that phase", async () => {
  const f = await fixture("ripple.kororo.quiet-cup"); await f.text(false); await f.read(); await f.text(true); await f.read();
  await f.send({type: "airp-director-choose", eventId: f.eventId, choiceId: "participate"});
  await f.text(true); await f.read();
  await f.send({type: "airp-director-open", eventId: f.eventId});
  await f.text(false); await f.read();
  expect(pendingHomeBoundary(f.raw())).toBeNull(); expect(f.raw().airpDirector!.events[0].status).toBe("ready");
  await f.text(true); await f.read();
  expect(pendingHomeBoundary(f.raw())?.kind).toBe("event"); expect(f.raw().airpDirector!.events[0].status).toBe("resolved");
  expect(f.raw().airpDirector!.reading?.completed).toBe(true);
}, 120000);
it("declining generates a response and only then creates its settlement boundary", async () => {
  const f = await fixture(); await f.text(false); await f.read(); await f.text(true); await f.read();
  await f.send({type: "airp-director-decline", eventId: f.eventId});
  expect(f.job().scene!.role).toBe("declined"); expect(pendingHomeBoundary(f.raw())).toBeNull();
  await f.text(true); await f.read(); expect(pendingHomeBoundary(f.raw())?.kind).toBe("event");
  await f.flow.sync(); expect(await f.flow.settleHome()).toBeTruthy();
}, 120000);
