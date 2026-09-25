import {beforeAll, expect, it} from "vitest";
import {formalAirpFixture} from "../testing/airp-game-fixture";
import {directorOutput, directorPlan} from "../testing/airp-director-playthrough";
import {directorTestMaterial} from "../testing/airp-director-fixture";
import {lowR8Source} from "../../content/presentation/airp/low-r8-source";
import type {DirectorJob, SceneGMPlan} from "./contracts";
import {readSceneGMEvaluation, compileSceneGM} from "./scene-gm";
import {directorLowFrame} from "./low";
import {FIRST_RESPONSE_PENDING, SCENE_GM_TURN_V21} from "./scene-gm-v21";
import {readD5Archive} from "../versions/d5-validate";
import {AIRP_GAME_CATALOG} from "../../game-runtime/airp-game-context";
import {D5_RUN_READERS} from "../../game-core/session";

const develop: SceneGMPlan = {pacing: "develop", suggestedWords: 460, focus: "回应实际追问与尚未说明的必要问题", alreadyCovered: [], stopWhen: "当前问题回应充分", reason: "本轮有新的交流需要"};
async function fixture() {
  const f = await formalAirpFixture(); await f.flow.sync();
  const material = directorTestMaterial(), wf = {read: async () => f.raw(), send: f.send};
  await f.send({type: "airp-director-configure", material, lowMaterial: lowR8Source, lowReadVersion: 6, lowContextVersion: 21});
  await directorPlan(wf, {kind: "fixed", definitionId: "ripple.elora.old-medicine-case"});
  await f.send({type: "advance-phase"}); await f.send({type: "advance-phase"});
  const eventId = f.raw().airpDirector!.events[0].id;
  await f.send({type: "airp-director-open", eventId});
  const job = () => f.raw().airpDirector!.jobs.find(j => j.id === f.raw().airpDirector!.reading!.jobId)!;
  const body = async () => {
    await directorOutput(wf, job(), "writing", "艾洛拉：我听见你的回应了。");
    await directorOutput(wf, job(), "formatting", JSON.stringify({lines: [{speaker: "elora", emotion: "smile", text: "我听见你的回应了。"}], choices: ["认真倾听", "轻松打趣", "有所保留"]}));
  };
  const evaluate = (complete: boolean, next: SceneGMPlan | null = null) => directorOutput(wf, job(), "scene-evaluate", JSON.stringify({complete, reason: "测试判断", unresolved: complete ? [] : ["仍需回应实际追问"], next}));
  const read = async (index = 0) => {const j = job(); await f.send({type: "airp-director-show", jobId: j.id}); if (j.lowChoices?.length) await f.send({type: "airp-director-respond", jobId: j.id, index}); await f.send({type: "airp-director-read", jobId: j.id, cursor: 0});};
  return {...f, material, eventId, job, body, evaluate, read};
}
let initial: DirectorJob;
beforeAll(async () => {initial = structuredClone((await fixture()).job());}, 30000);
const evaluation = (complete: boolean, next?: unknown) => JSON.stringify({complete, reason: "说明已充分", unresolved: [], ...(next === undefined ? {} : {next})});

it.each([null, undefined])("first-offer protection supplies a conditional plan when next is %s, preserving legacy behavior", next => {
  const raw = evaluation(true, next), result = readSceneGMEvaluation(raw, initial);
  expect(result).toMatchObject({complete: false, unresolved: [FIRST_RESPONSE_PENDING], next: {pacing: "brief", suggestedWords: 100}, coveredAcceptance: []});
  expect(result.next!.reason).toContain("程序首轮保护"); expect(result.next!.focus).toContain("实际态度");
  expect(readSceneGMEvaluation(raw, {...initial, lowContextVersion: 20})).toMatchObject({complete: false, unresolved: [], next: null});
  expect(initial.sceneGMEvaluation).toBeUndefined();
});

it("retains a supplied develop plan, rejects incomplete continuation and ends an already-answered later turn", () => {
  expect(readSceneGMEvaluation(evaluation(true, develop), initial).next).toEqual(develop);
  expect(readSceneGMEvaluation(evaluation(false, develop), initial).next).toEqual(develop);
  for (const next of [null, undefined, {pacing: "brief"}]) expect(() => readSceneGMEvaluation(evaluation(false, next), initial)).toThrow();
  expect(() => readSceneGMEvaluation(evaluation(true, {pacing: "brief"}), initial)).toThrow();
  const later = structuredClone(initial); later.scene!.dialogue!.turn = 1;
  expect(readSceneGMEvaluation(evaluation(true), later)).toMatchObject({complete: true, unresolved: [], next: null});
});

it("upgrades an inherited legacy null plan without inventing one or mutating the previous evaluation", () => {
  const scene = structuredClone(initial.scene!);
  scene.dialogue!.turn = 1; scene.dialogue!.selectedResponse = "我还有一个问题";
  scene.previousEvaluation = {sceneId: "old-turn", ...readSceneGMEvaluation(evaluation(true, null), {...initial, lowContextVersion: 20})};
  const saved = structuredClone(scene), frame = directorLowFrame(lowR8Source, scene, 21, 6);
  expect(frame.scene.pacing).toBeUndefined(); expect(frame.scene.proseVersion).toBe(1);
  expect(frame.messages.map(m => m.content).join("\n")).not.toContain("三段合计约600字");
  expect(frame.scene.currentTurn).toContain("不设固定字数或自然段数"); expect(scene).toEqual(saved);
});

it("carries brief and develop guidance through real choices, clears it across stages, and replays the save", async () => {
  const f = await fixture(); await f.body();
  const firstGM = compileSceneGM(f.job(), "scene-evaluate", f.material.resources.sources);
  expect(firstGM.messages[0].content.startsWith(SCENE_GM_TURN_V21)).toBe(true);
  await f.evaluate(true); const first = structuredClone(f.job());
  expect(JSON.parse(first.attempts.at(-1)!.output!).complete).toBe(true);
  expect(first.sceneGMEvaluation!.complete).toBe(false);
  await f.read(2);
  expect(f.job().scene!.dialogue!.selectedResponse).toBe("有所保留");
  expect(f.job().lowFrame!.scene.pacing).toEqual({suggestedWords: 100});
  expect(f.job().lowFrame!.scene.currentTurn).toContain("实际选择带来新问题或必要交流时相应展开");
  await f.body(); await f.evaluate(false, develop); await f.read();
  expect(f.job().lowFrame!.scene.pacing).toEqual({suggestedWords: 460});
  expect(f.job().lowFrame!.scene.currentTurn).toContain('"pacing":"develop"');
  await f.body(); await f.evaluate(true); expect(f.job().lowChoices).toEqual([]); await f.read();
  await f.send({type: "airp-director-choose", eventId: f.eventId, choiceId: "participate"});
  expect(f.job().scene!.role).toBe("acceptance"); expect(f.job().scene!.previousEvaluation).toBeNull();
  expect(f.job().lowFrame!.scene.pacing).toBeUndefined();
  expect(f.job().lowFrame!.messages.map(m => m.content).join("\n")).not.toContain("三段合计约600字");
  await f.body(); await f.evaluate(true); await f.read();
  expect(f.raw().airpDirector!.events[0]).toMatchObject({status: "waiting-action", actionPhase: 2});
  for (const j of f.raw().airpDirector!.jobs.filter(j => j.kind === "scene")) expect(j.attempts.map(a => a.stage)).toEqual(["writing", "formatting", "scene-evaluate"]);
  expect(f.raw().airpDirector!.jobs.find(j => j.id === first.id)!.attempts).toEqual(first.attempts);
  const archive = await f.runtime.application.exportSave("formal-airp"); if (!archive.ok) throw Error("export failed");
  expect(readD5Archive(archive.archive, AIRP_GAME_CATALOG, D5_RUN_READERS)).toEqual(f.raw());
}, 60000);
