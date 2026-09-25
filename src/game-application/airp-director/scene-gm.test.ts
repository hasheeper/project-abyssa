import { expect, it } from "vitest";
import { formalAirpFixture } from "../testing/airp-game-fixture";
import { directorOutput, directorPlan } from "../testing/airp-director-playthrough";
import { directorTestMaterial } from "../testing/airp-director-fixture";
import { lowR8Source } from "../../content/presentation/airp/low-r8-source";
import { compileDirectorJob, directorStage } from "./jobs";
import { compileLowRequest } from "../airp-low/output";
import { readD5Archive } from "../versions/d5-validate";
import { AIRP_GAME_CATALOG } from "../../game-runtime/airp-game-context";
import { D5_RUN_READERS } from "../../game-core/session";
import { createDirectorDriver } from "../../game-runtime/airp-director-driver";
import { emptyUsage } from "../airp-generation/contracts";
import { readSceneGMEvaluation, SCENE_GM_TURN_PROMPT } from "./scene-gm";
import { SCENE_GM_TURN_V18, sceneContinuationGuide } from "./scene-gm-v18";
import { GM_MEMORY_INSTRUCTION } from "../airp-memory/prompt";

const plan = {pacing: "brief" as const, suggestedWords: 120, focus: "只回应这次态度", alreadyCovered: ["委托目标已说明"], stopWhen: "角色回应后收住", reason: "前文已说明委托"};
const draft = "艾洛拉：我明白你的意思了。";
const formatted = {lines: [{speaker: "elora", emotion: "smile", text: "我明白你的意思了。"}], choices: ["认真倾听", "轻松打趣", "有所保留"]};
async function fixture(contextVersion: 14 | 15 | 16 | 17 | 18 | 19 = 15) {
  const f = await formalAirpFixture(); await f.flow.sync();
  const material = directorTestMaterial();
  await f.send({type: "airp-director-configure", material, lowMaterial: lowR8Source, lowReadVersion: 6, lowContextVersion: contextVersion});
  const wf = {read: async () => f.raw(), send: f.send};
  await directorPlan(wf, {kind: "fixed", definitionId: "ripple.elora.old-medicine-case"});
  await f.send({type: "advance-phase"}); await f.send({type: "advance-phase"});
  const eventId = f.raw().airpDirector!.events[0].id;
  await f.send({type: "airp-director-open", eventId});
  const job = () => f.raw().airpDirector!.jobs.find(j => j.id === f.raw().airpDirector!.reading!.jobId)!;
  const output = (stage: "scene-plan" | "writing" | "formatting" | "scene-evaluate", text: string) => directorOutput(wf, job(), stage, text);
  const body = async () => {if (contextVersion < 16) await output("scene-plan", JSON.stringify(plan)); await output("writing", draft); await output("formatting", JSON.stringify({...formatted, phase: {complete: true, reason: "小模型越权"}}));};
  const evaluate = (complete: boolean) => output("scene-evaluate", JSON.stringify({complete, reason: "本轮回应评估", unresolved: complete ? [] : ["等待玩家表态"], ...(contextVersion >= 16 ? {next: complete ? null : plan} : {})}));
  const read = async () => {const j = job(); await f.send({type: "airp-director-show", jobId: j.id}); if (j.lowChoices?.length) await f.send({type: "airp-director-respond", jobId: j.id, index: 0}); await f.send({type: "airp-director-read", jobId: j.id, cursor: 0});};
  return {...f, wf, material, eventId, job, output, body, evaluate, read};
}

it.each([14, 15] as const)("v%s: GM owns pacing and cumulative completion; small-model phase is ignored; no automatic task choice", async contextVersion => {
  const f = await fixture(contextVersion), template = f.job().lowFrame!;
  expect(directorStage(f.job())).toBe("scene-plan");
  const gm = compileDirectorJob(f.material, f.job());
  for (const source of template.sources) expect(gm.messages.some(m => m.content.includes(source.text))).toBe(true);
  expect(gm.messages.some(m => m.content.includes("<content_constraints>"))).toBe(false);
  await f.output("scene-plan", JSON.stringify(plan));
  const frame = f.job().lowFrame!;
  expect(frame.sources).toEqual(template.sources); expect(frame.sampling).toEqual(template.sampling);
  expect(frame.materialHash).toBe(template.materialHash);
  expect(frame.trace.filter(t => t.id !== "451043ae-17bf-4162-a45f-2f80eb42ba67")).toEqual(template.trace.filter(t => t.id !== "451043ae-17bf-4162-a45f-2f80eb42ba67"));
  expect(frame.messages.map(m => m.content).join("\n")).toContain("三段合计参考120字");
  expect(frame.messages.map(m => m.content).join("\n")).not.toContain("三段合计约600字，全篇共20个左右自然段");
  await f.output("writing", draft);
  const formatInput = compileLowRequest(frame, draft, 6, 2);
  expect(JSON.parse(formatInput.messages[1].content).stageContext).toBeUndefined();
  expect(formatInput.messages[0].content).toContain("不输出phase");
  await f.output("formatting", JSON.stringify({...formatted, phase: {complete: true, reason: "不能采用"}}));
  expect(f.job().lowPhase).toBeUndefined(); expect(directorStage(f.job())).toBe("scene-evaluate");
  await expect(f.send({type: "airp-director-show", jobId: f.job().id})).rejects.toThrow();
  const evaluationInput = JSON.parse(compileDirectorJob(f.material, f.job()).messages[1].content);
  expect(evaluationInput.currentText).toEqual(formatted.lines); expect(evaluationInput.previousRead).toEqual([]);
  await f.evaluate(true); // First offer must still allow the first player response.
  expect(f.job().lowPhase!.complete).toBe(false); await f.read();
  expect(f.raw().airpDirector!.events[0].status).toBe("offered");
  const nextInput = JSON.parse(compileDirectorJob(f.material, f.job()).messages[1].content);
  expect(nextInput.current.dialogue.selectedResponse).toBe("认真倾听");
  expect(nextInput.previousRead[0].text).toBe("elora：我明白你的意思了。");
  expect(nextInput.previousEvaluation).toEqual(contextVersion === 15 ? {...f.raw().airpDirector!.jobs.find(j => j.id === nextInput.previousRead[0].sceneId)!.sceneGMEvaluation, sceneId: nextInput.previousRead[0].sceneId} : undefined);
  if (contextVersion === 15) expect(compileDirectorJob(f.material, f.job()).messages[0].content).toContain("并写入focus");
  await f.body(); await f.evaluate(true); expect(f.job().lowChoices).toEqual([]); await f.read();
  expect(f.raw().airpDirector!.events[0].status).toBe("offered");
  await f.send({type: "airp-director-choose", eventId: f.eventId, choiceId: "participate"});
  expect(f.job().scene!.role).toBe("acceptance");
  expect(f.job().scene!.dialogue!.previousRead).toHaveLength(2);
  expect(f.job().scene!.previousEvaluation).toBe(contextVersion === 15 ? null : undefined);
  await f.body(); await f.evaluate(true); await f.read();
  expect(f.raw().airpDirector!.events[0]).toMatchObject({status: "waiting-action", actionPhase: 2});
  expect(f.raw().snapshot.run).toBeNull();
  const archive = await f.runtime.application.exportSave("formal-airp"); if (!archive.ok) throw Error("export");
  expect(readD5Archive(archive.archive, AIRP_GAME_CATALOG, D5_RUN_READERS)).toEqual(f.raw());
}, 120000);

it.each([16, 17, 18, 19] as const)("v%s uses one GM call per turn and carries its next guidance after the actual player choice", async contextVersion => {
  const f = await fixture(contextVersion), initial = structuredClone(f.job());
  expect(directorStage(initial)).toBe("writing");
  expect(initial.lowFrame!.scene.pacing).toBeUndefined();
  expect(initial.lowFrame!.scene.currentTurn).not.toContain("等待GM分派");
  await f.body();
  const gm = compileDirectorJob(f.material, f.job());
  expect(gm.stage).toBe("scene-evaluate");
  expect(gm.messages[0].content).toBe((contextVersion >= 18 ? SCENE_GM_TURN_V18 : SCENE_GM_TURN_PROMPT) + (contextVersion >= 19 ? `\n${GM_MEMORY_INSTRUCTION}` : ""));
  for (const source of initial.lowFrame!.sources) expect(gm.messages.some(m => m.content.includes(source.text))).toBe(true);
  expect(JSON.parse(gm.messages[1].content).guidanceUsed).toBeNull();
  expect(f.job().lowPhase).toBeUndefined(); // The small-model phase is ignored.
  await f.evaluate(false);
  const first = structuredClone(f.job()); await f.read();
  expect(directorStage(f.job())).toBe("writing");
  expect(f.job().scene!.previousEvaluation).toEqual({...first.sceneGMEvaluation, sceneId: first.id});
  expect(f.job().scene!.dialogue!.selectedResponse).toBe("认真倾听");
  expect(f.job().lowFrame!.scene.pacing).toEqual({suggestedWords: 120});
  expect(f.job().lowFrame!.scene.currentTurn).toContain(contextVersion >= 18 ? "以实际selectedResponse为先" : "以本轮selectedResponse为准");
  expect(f.job().lowFrame!.messages.map(m => m.content).join("\n")).toContain("三段合计参考120字");
  expect(f.job().lowFrame!.sources).toEqual(first.lowFrame!.sources);
  expect(f.job().lowFrame!.sampling).toEqual(first.lowFrame!.sampling);
  expect(f.job().lowFrame!.trace.filter(t => t.id !== "451043ae-17bf-4162-a45f-2f80eb42ba67")).toEqual(first.lowFrame!.trace.filter(t => t.id !== "451043ae-17bf-4162-a45f-2f80eb42ba67"));
  await f.body(); await f.evaluate(true);
  expect(f.job().sceneGMEvaluation!.next).toBeNull(); expect(f.job().lowChoices).toEqual([]);
  await f.read();
  await f.send({type: "airp-director-choose", eventId: f.eventId, choiceId: "participate"});
  expect(f.job().scene!.role).toBe("acceptance");
  expect(f.job().scene!.previousEvaluation).toBeNull(); // No stale offer guidance across stages.
  expect(directorStage(f.job())).toBe("writing");
  await f.body(); await f.evaluate(true); await f.read();
  expect(f.raw().airpDirector!.events[0]).toMatchObject({status: "waiting-action", actionPhase: 2});
  expect(f.raw().snapshot.run).toBeNull();
  for (const j of f.raw().airpDirector!.jobs.filter(j => j.kind === "scene")) {
    expect(j.attempts.map(a => a.stage)).toEqual(["writing", "formatting", "scene-evaluate"]);
    expect(j.sceneGMPlan).toBeUndefined();
  }
  const archive = await f.runtime.application.exportSave("formal-airp"); if (!archive.ok) throw Error("export");
  expect(readD5Archive(archive.archive, AIRP_GAME_CATALOG, D5_RUN_READERS)).toEqual(f.raw());
}, 120000);

it.each([15, 16, 17, 18, 19] as const)("v%s: a failed GM resumes only GM, preserves prose and confirms a new GM connection", async contextVersion => {
  const f = await fixture(contextVersion); await f.body(); await f.evaluate(false); await f.read();
  const calls: string[] = [], connection = {models: f.material.models, keys: {planning: "test-key", writing: "test-key", updater: "test-key"}};
  const port = {read: async () => ({head: f.raw().head, ...f.raw().airpDirector!}), commit: async (command: any) => {await f.send(command); return port.read();}};
  let fail = true;
  const driver = createDirectorDriver({lock: async (_k, _s, op) => op(), provider: async request => {
    const evaluation = !!JSON.parse(request.messages[1].content).currentText; calls.push(evaluation ? "scene-evaluate" : "scene-plan");
    return {text: JSON.stringify(evaluation ? fail ? {wrong: "invalid"} : {complete: true, reason: "已回应，无需重复", unresolved: [], ...(contextVersion >= 16 ? {next: null} : {})} : plan), usage: emptyUsage(), finishReason: "stop"};
  }, lowProvider: async request => {calls.push(request.stage); return {text: request.stage === "writing" ? draft : JSON.stringify(formatted), usage: emptyUsage(), finishReason: "stop"};}});
  await driver.run(port, f.job().id, connection);
  const expected = contextVersion >= 16 ? ["writing", "formatting", "scene-evaluate"] : ["scene-plan", "writing", "formatting", "scene-evaluate"];
  expect(calls).toEqual(expected);
  expect(driver.getSnapshot().phase).toBe("failed");
  const saved = structuredClone(f.job()); expect(saved.text!.lines).toEqual(formatted.lines); expect(saved.lowPhase).toBeUndefined();
  connection.models = {...connection.models, planning: {...connection.models.planning, max_tokens: 1024}};
  await driver.run(port, f.job().id, connection);
  expect(driver.getSnapshot().error).toContain("确认使用当前连接");
  expect(calls).toHaveLength(expected.length);
  await f.send({type: "airp-director-reconnect", jobId: f.job().id, config: connection.models.planning});
  expect(f.job().connections!.at(-1)!.stage).toBe("scene-evaluate");
  fail = false; await driver.run(port, f.job().id, connection);
  expect(calls).toEqual([...expected, "scene-evaluate"]);
  expect(f.job().attempts.slice(0, saved.attempts.length)).toEqual(saved.attempts);
  expect(f.job().gmContext).toEqual(saved.gmContext);
  expect(f.job().text).toEqual(saved.text); expect(f.job().lowPhase!.complete).toBe(true);
  await driver.run(port, f.job().id, connection); expect(calls).toHaveLength(expected.length + 1);
}, 120000);

it("v18 drops model recaps from the prose handoff, preserves raw evidence and checks actual continuation guidance", async () => {
  const f = await fixture(18); await f.body();
  const wrong = {...plan, alreadyCovered: ["需要穿过第三道回廊"], reason: "第三道回廊已经明确，可以照办"};
  await f.output("scene-evaluate", JSON.stringify({complete: false, reason: "等待真实回应", unresolved: ["等待回应"], next: wrong, taskGuideConflict: true}));
  const original = structuredClone(f.job());
  // Current text is still unread; neither narrative facts nor stage advance yet.
  expect(f.raw().airpDirector!.events[0].readSceneIds).not.toContain(original.id);
  await f.read();
  const next = f.job(), messages = next.lowFrame!.messages.map(m => m.content).join("\n");
  expect(next.scene!.previousEvaluation!.next).toEqual(wrong);
  expect(messages).not.toContain("第三道回廊");
  expect(next.scene!.previous[0].text).toBe("elora：我明白你的意思了。");
  expect(next.lowFrame!.scene.currentTurn).toContain(JSON.stringify(sceneContinuationGuide(wrong)));
  expect(next.lowFrame!.scene.currentTurn).not.toContain("四项");
  expect(next.lowFrame!.scene.currentTurn).not.toContain("taskGuide中的目标、地点、达成条件、交付对象须让玩家了解");
  expect(next.lowFrame!.scene.dialogue!.taskGuide!.join("\n")).toContain("第3层");
  await f.body();
  const gm = compileDirectorJob(f.material, f.job()), context = JSON.parse(gm.messages[1].content);
  expect(context.guidanceUsed).toEqual(sceneContinuationGuide(wrong));
  expect(context.previousEvaluation.next).toEqual(wrong); // GM may inspect, never treat as a fact.
  expect(context.taskGuidePresentation.readConfirmed).toBe(false);
  expect(gm.messages[0].content).toContain("与权威目标矛盾的旧指导不继承");
  expect(gm.messages[0].content).toContain("不是每场必须口述的清单");
  await f.evaluate(true);
  // Missing/invalid optional display metadata does not block a valid result.
  expect(readSceneGMEvaluation(JSON.stringify({complete: true, reason: "已回应", unresolved: [], next: null, taskGuideConflict: "invalid"}), f.job()).taskGuideConflict).toBe(false);
  expect(f.raw().airpDirector!.jobs.find(j => j.id === original.id)!.attempts).toEqual(original.attempts);
  const archive = await f.runtime.application.exportSave("formal-airp"); if (!archive.ok) throw Error("export");
  expect(readD5Archive(archive.archive, AIRP_GAME_CATALOG, D5_RUN_READERS)).toEqual(f.raw());
}, 120000);

it("v18 respects an unanswered acceptance and only advances on a read completion, without an extra departure scene", async () => {
  const f = await fixture(18); await f.body(); await f.evaluate(false); await f.read();
  await f.body(); await f.evaluate(true); await f.read();
  await f.send({type: "airp-director-choose", eventId: f.eventId, choiceId: "participate"});
  expect(f.job().scene!.role).toBe("acceptance");
  await f.body();
  await f.output("scene-evaluate", JSON.stringify({complete: false, reason: "玩家的新问题尚未回答", unresolved: ["说明这次请求的缘由"], next: {...plan, focus: "回答玩家关于缘由的追问"}, taskGuideConflict: false}));
  expect(f.job().lowPhase!.complete).toBe(false);
  const before = f.raw().airpDirector!.events[0];
  expect(before).toMatchObject({status: "accepted", role: "acceptance", actionPhase: null});
  await f.read();
  expect(f.job().scene!.role).toBe("acceptance");
  await f.body(); await f.output("scene-evaluate", JSON.stringify({complete: true, reason: "已回应，实际出征留给玩家", unresolved: [], next: null, taskGuideConflict: true}));
  const completedJob = structuredClone(f.job());
  expect(f.raw().airpDirector!.events[0]).toMatchObject({status: "accepted", actionPhase: null});
  await f.send({type: "airp-director-show", jobId: completedJob.id});
  await f.send({type: "airp-director-pause"});
  await f.send({type: "airp-director-open", eventId: f.eventId});
  expect(f.job().id).toBe(completedJob.id);
  expect(f.job().sceneGMEvaluation?.taskGuideConflict).toBe(true);
  await f.send({type: "airp-director-read", jobId: completedJob.id, cursor: 0});
  expect(f.raw().airpDirector!.events[0]).toMatchObject({status: "waiting-action", role: "action", actionPhase: 2});
  expect(f.raw().snapshot.run).toBeNull();
  expect(f.raw().airpDirector!.events[0].delivery).toBeUndefined();
  expect(f.raw().airpDirector!.jobs.some(j => j.scene?.role === "action")).toBe(false);
  expect(f.raw().airpDirector!.reading!.completed).toBe(true);
  expect(f.job().text).toEqual(completedJob.text);
  const archive = await f.runtime.application.exportSave("formal-airp"); if (!archive.ok) throw Error("export");
  expect(readD5Archive(archive.archive, AIRP_GAME_CATALOG, D5_RUN_READERS)).toEqual(f.raw());
}, 120000);
