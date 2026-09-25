import {expect, it} from "vitest";
import {formalAirpFixture} from "../testing/airp-game-fixture";
import {directorOutput, directorPlan} from "../testing/airp-director-playthrough";
import {directorTestMaterial} from "../testing/airp-director-fixture";
import {lowR8Source} from "../../content/presentation/airp/low-r8-source";
import {compileDirectorJob, directorStage} from "./jobs";
import {readSceneGMEvaluation} from "./scene-gm";
import {readD5Archive} from "../versions/d5-validate";
import {AIRP_GAME_CATALOG} from "../../game-runtime/airp-game-context";
import {D5_RUN_READERS} from "../../game-core/session";
import {coveredAcceptanceForChoice} from "./acceptance-coverage";
import {directorReplyBriefV20} from "./event-brief-v20";
import {directorLowFrame} from "./low";
import {DIRECTOR_FIXED_CARDS, directorAuthorSource} from "../../content/gameplay/airp-director/content";

const plan = {pacing: "brief", suggestedWords: 100, focus: "回应玩家实际态度", alreadyCovered: [], stopWhen: "回应充分即停", reason: "请求已提出"};
async function fixture() {
  const f = await formalAirpFixture(); await f.flow.sync();
  const material = directorTestMaterial(), wf = {read: async () => f.raw(), send: f.send};
  await f.send({type: "airp-director-configure", material, lowMaterial: lowR8Source, lowReadVersion: 6, lowContextVersion: 20});
  await directorPlan(wf, {kind: "fixed", definitionId: "ripple.elora.old-medicine-case"});
  await f.send({type: "advance-phase"}); await f.send({type: "advance-phase"});
  const eventId = f.raw().airpDirector!.events[0].id;
  await f.send({type: "airp-director-open", eventId});
  const job = () => f.raw().airpDirector!.jobs.find(j => j.id === f.raw().airpDirector!.reading!.jobId)!;
  const body = async () => {
    await directorOutput(wf, job(), "writing", "艾洛拉：我明白你的意思了。");
    await directorOutput(wf, job(), "formatting", JSON.stringify({lines: [{speaker: "elora", emotion: "smile", text: "我明白你的意思了。"}], choices: ["认真倾听", "轻松打趣", "有所保留"]}));
  };
  const evaluate = (complete: boolean, coveredAcceptance?: unknown) => directorOutput(wf, job(), "scene-evaluate", JSON.stringify({complete, reason: "已回应", unresolved: complete ? [] : ["等待玩家态度"], next: complete ? null : plan, ...(coveredAcceptance === undefined ? {} : {coveredAcceptance})}));
  const read = async () => {const j = job(); await f.send({type: "airp-director-show", jobId: j.id}); if (j.lowChoices?.length) await f.send({type: "airp-director-respond", jobId: j.id, index: 0}); await f.send({type: "airp-director-read", jobId: j.id, cursor: 0});};
  const coverage = (choiceId = "participate") => [{choiceId, basisSceneIds: [job().id], reason: "前文已回应参与态度，无须另写接单告别；实际行动仍待玩家"}];
  return {...f, material, eventId, job, body, evaluate, read, coverage};
}

it("v20 skips only GM-covered acceptance after the real choice, without an extra call or imaginary action", async () => {
  const f = await fixture(); await f.body(); await f.evaluate(false); await f.read();
  await f.body(); await f.evaluate(true, f.coverage());
  const source = structuredClone(f.job());
  expect(f.raw().airpDirector!.events[0].selected).toEqual([]);
  expect(f.raw().airpDirector!.events[0].status).toBe("offered");
  await f.read();
  const before = f.raw().airpDirector!, sourceJob = before.jobs.find(j => j.id === source.id)!;
  expect(coveredAcceptanceForChoice(before, before.events[0], sourceJob, "different-choice", 2)).toBeNull();
  expect(coveredAcceptanceForChoice(before, before.events[0], sourceJob, "participate", 3)).toBeNull();
  expect(coveredAcceptanceForChoice(before, {...before.events[0], deferredUntil: 3}, sourceJob, "participate", 2)).toBeNull();
  expect(coveredAcceptanceForChoice(before, {...before.events[0], occurrence: 1}, sourceJob, "participate", 2)).toBeNull();
  await f.send({type: "airp-director-choose", eventId: f.eventId, choiceId: "participate"});
  const state = f.raw().airpDirector!, event = state.events[0];
  expect(event).toMatchObject({status: "waiting-action", role: "action", actionPhase: 2});
  expect(event.narrativeSkips).toEqual([expect.objectContaining({role: "acceptance", sourceJobId: source.id, choiceId: "participate", decisionFactId: event.selected.at(-1)!.sourceId})]);
  expect(state.jobs.filter(j => j.kind === "scene")).toHaveLength(2);
  expect(state.jobs.filter(j => j.kind === "scene").map(j => j.attempts.map(a => a.stage))).toEqual(Array(2).fill(["writing", "formatting", "scene-evaluate"]));
  expect(state.jobs.some(j => j.scene?.role === "acceptance")).toBe(false);
  expect(event.readSceneIds).toHaveLength(2);
  expect(event.delivery).toBeUndefined(); expect(f.raw().snapshot.run).toBeNull();
  expect(state.reading).toMatchObject({jobId: source.id, completed: true});
  expect(directorStage(f.job())).toBeNull();
  await expect(f.send({type: "airp-director-choose", eventId: f.eventId, choiceId: "participate"})).rejects.toThrow();
  const archive = await f.runtime.application.exportSave("formal-airp"); if (!archive.ok) throw Error("export");
  expect(readD5Archive(archive.archive, AIRP_GAME_CATALOG, D5_RUN_READERS)).toEqual(f.raw());
}, 120000);

it("v20 changes draft event inputs, not full character cards, r8 entries, world selection or the formatter", async () => {
  const f = await fixture(), scene = f.job().scene!, frame = f.job().lowFrame!, old = directorLowFrame(lowR8Source, scene, 19, 6);
  expect(frame.sources).toEqual(old.sources); expect(frame.sampling).toEqual(old.sampling); expect(frame.trace).toEqual(old.trace);
  expect(frame.materialHash).toBe(old.materialHash); expect(frame.formatInstruction).toBe(old.formatInstruction);
  for (const source of frame.sources) expect(frame.messages.some(m => m.content.includes(source.text))).toBe(true);
  const all = frame.messages.map(m => m.content).join("\n"), raw = scene.authorSource!.text;
  for (const line of ["玛丽埃塔说，旧庄园的勤务走廊还留着一只空药箱，搭扣是黄铜的。", "如果这次巡守能走到那里，可以帮我带回来吗？我想把这些分开放。", "里面即使剩着药，也别拿来用。我要的只是箱子。"]) {
    expect(raw).toContain(line); expect(all).not.toContain(line);
  }
  expect(all).not.toContain("依据原工作稿提出"); expect(all).not.toContain("以附带的原始作者工作稿为依据");
  const data = JSON.parse(frame.scene.scenario);
  expect(data.eventBrief.motivation).toContain("分开放置"); expect(data.eventBrief.lead.source).toBe("玛丽埃塔告知艾洛拉");
  expect(data.eventBrief.constraints.join()).toContain("不要拿来用");
  expect(data.eventBrief.requestReference).toBeUndefined(); expect(data.activeAuthorScript).toBeUndefined();
  // The same adapter covers only the known source digests, never arbitrary author text.
  for (const fixed of DIRECTOR_FIXED_CARDS) {
    const current = {...scene, card: fixed.card, actorIds: [fixed.card.giverId], authorSource: {text: JSON.stringify(directorAuthorSource(fixed.sourceId)), digest: fixed.sourceDigest}};
    const brief = directorReplyBriefV20(current);
    expect(JSON.stringify(brief)).not.toContain('"frames"'); expect(JSON.stringify(brief)).not.toContain('"actorId":"elora","emotion"');
    if (fixed.card.form === "liaison") {
      expect(JSON.stringify(brief)).not.toContain("圈记是自己改的");
      expect(JSON.stringify(directorReplyBriefV20({...current, role: "feedback", progress: {...scene.progress!, actionOutcome: "succeeded"}}))).toContain("圈记是自己改的");
    }
    if (fixed.card.form === "vignette") expect(JSON.stringify(brief)).toContain("选择前不预写已经坐下");
  }
  const unknown = directorReplyBriefV20({...scene, authorSource: {...scene.authorSource!, digest: "unknown"}});
  expect(unknown).toHaveProperty("eventBrief.requestReference");
}, 120000);

it("v20 does not apply participation coverage to a refusal, and an unanswered reply stays open", async () => {
  const f = await fixture(); await f.body(); await f.evaluate(false); await f.read();
  await f.body(); await f.evaluate(false, f.coverage());
  expect(f.job().sceneGMEvaluation!.coveredAcceptance).toEqual([]);
  await f.read(); expect(f.job().scene!.dialogue!.turn).toBe(2);
  await f.body(); await f.evaluate(true, f.coverage()); await f.read();
  await f.send({type: "airp-director-decline", eventId: f.eventId});
  expect(f.job().scene!.role).toBe("declined");
  expect(f.raw().airpDirector!.events[0]).toMatchObject({status: "closed", actionPhase: null});
  expect(f.raw().airpDirector!.events[0].narrativeSkips).toBeUndefined();
}, 120000);

it.each([undefined, "invalid", [{choiceId: "wrong", basisSceneIds: ["foreign-scene"], reason: "wrong"}]])("v20 retains necessary acceptance when coverage is missing/invalid: %j", async covered => {
  const f = await fixture(); await f.body(); await f.evaluate(false); await f.read();
  await f.body(); await f.evaluate(true, covered); await f.read();
  await f.send({type: "airp-director-choose", eventId: f.eventId, choiceId: "participate"});
  expect(f.job().scene!.role).toBe("acceptance");
  expect(f.raw().airpDirector!.events[0].narrativeSkips).toBeUndefined();
  expect(directorStage(f.job())).toBe("writing");
}, 120000);

it("v20 preserves the initial attitude and ignores speculative coverage before that response", async () => {
  const f = await fixture(); await f.body(); await f.evaluate(true, f.coverage());
  expect(f.job().lowPhase!.complete).toBe(false);
  expect(f.job().sceneGMEvaluation!.coveredAcceptance ?? []).toEqual([]);
  await f.read(); expect(f.job().scene!.dialogue!.turn).toBe(1);
  await f.body();
  const gm = JSON.parse(compileDirectorJob(f.material, f.job()).messages[1].content);
  expect(gm.acceptanceCoverage.candidates[0].id).toBe("participate");
  expect(gm.acceptanceCoverage.currentSceneId).toBe(f.job().id);
  expect(gm.current.dialogue.selectedResponse).toBe("认真倾听");
  const valid = readSceneGMEvaluation(JSON.stringify({complete: true, reason: "已回应", unresolved: [], next: null, coveredAcceptance: f.coverage()}), f.job());
  expect(valid.coveredAcceptance).toHaveLength(1);
}, 120000);
