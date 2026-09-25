import { canonicalJson, utf8Size } from "../../game-core/contracts";
import { compileLowFrame } from "../airp-low/native";
import { compileLowRequest } from "../airp-low/output";
import type { LowMaterial } from "../airp-low/contracts";
import type { DirectorJob, DirectorLowContextVersion, DirectorPreparedInput, DirectorSceneContext, SceneGMPlan } from "./contracts";
import { directorContinuityHandoff, directorCurrentHandoff, directorCurrentTurn } from "./handoff";
import { LOW_ATTITUDE_HANDOFF, LOW_CURRENT_RESPONSE_HANDOFF, LOW_INTERACTION_HANDOFF } from "../airp-low/continuity";
import { directorBriefHandoff, directorSceneBrief } from "./scene-brief";
import { LOW_ATTITUDE_ONLY_INSTRUCTION } from "../airp-low/prompt";
import { directorReplyBrief, directorReplyHandoff } from "./continuation";
import { CONTINUATION_HANDOFF_V18, TASK_GUIDE_HANDOFF_V18, sceneContinuationGuide } from "./scene-gm-v18";
import { directorReplyBriefV20, directorReplyHandoffV20 } from "./event-brief-v20";
import {directorReplyHandoffV21} from "./event-brief-v21";

const names: Record<string, string> = { marietta: "玛丽埃塔", abyssa: "艾比希斯", elora: "艾洛拉", eustice: "尤斯缇丝", norma: "诺玛", kororo: "柯萝萝" };
export function directorLowFrame(material: LowMaterial, scene: DirectorSceneContext, contextVersion?: DirectorLowContextVersion, readerVersion?: 5 | 6, gmPlan?: SceneGMPlan) {
  // v16 never requests a new pre-writing plan; carry the preceding read turn's guidance.
  if ((contextVersion ?? 0) >= 16) gmPlan = scene.previousEvaluation?.next ?? undefined;
  if (contextVersion !== undefined && contextVersion >= 8) {
    const brief = contextVersion >= 20 ? directorReplyBriefV20(scene) : contextVersion >= 13 ? directorReplyBrief(scene) : directorSceneBrief(scene, contextVersion >= 10);
    const sourceContext = { eventBrief: brief.eventBrief, location: scene.locationId, intent: scene.intent, facts: scene.facts, memories: scene.memories };
    return compileLowFrame(material, { id: scene.sceneId, actors: Object.fromEntries(scene.actorIds.map(id => [id, names[id]])), player: {id: "kael", name: scene.playerName},
      scenario: canonicalJson({ ...brief, location: scene.locationId, phase: scene.phase, intent: scene.intent, facts: scene.facts, memories: scene.memories, programChoices: scene.choices, settlement: scene.settlement ?? null }),
      userInput: canonicalJson({ previousRead: scene.previous, taskReports: scene.taskReports, selected: scene.selected, selectedAttitudes: scene.selectedAttitudes ?? [], expeditionRead: scene.settlementRead?.filter(l => !scene.previous.some(p => p.sceneId === l.sceneId)) ?? [] }),
      sourceContext, ...(contextVersion >= 9 ? {choiceMode: "attitude-only" as const} : {}),
      ...(contextVersion >= 21 ? {proseVersion: 1 as const} : {}),
      ...(contextVersion >= 11 ? {dialogue: scene.dialogue} : {}),
      ...(contextVersion >= 14 && gmPlan ? {pacing: {suggestedWords: gmPlan.suggestedWords}} : {}),
      currentTurn: contextVersion >= 16 ? directorSingleGMHandoff(scene, gmPlan, contextVersion) : contextVersion >= 14 ? directorGMHandoff(scene, gmPlan) : contextVersion >= 13 ? directorReplyHandoff(scene, names) : directorBriefHandoff(scene, names) + (contextVersion >= 9 ? `\n${LOW_ATTITUDE_ONLY_INSTRUCTION.split("\n")[0]}` : "") + (contextVersion >= 11 ? `\n【同一阶段继续交谈】\n${JSON.stringify(scene.dialogue)}\npreviousRead是实际已读正文，selectedResponse是玩家本轮实际选择。直接回应这次选择，不重演初见、不重讲整件委托。仍按原预设文风与结构创作；还需表态时在选择处停下，回应充分后自然收束，不为续轮另造话题或代替玩家执行后续行动。acceptance阶段需把taskGuide中的目标、地点、达成条件和交付对象交代清楚；不是再问是否接受。阶段结束由后处理判定，不是写完一批文字就退出。` : "") }, true, readerVersion);
  }
  // Existing r8 + existing current-node handoff, without a new literary instruction.
  return compileLowFrame(material, { id: scene.sceneId, actors: Object.fromEntries(scene.actorIds.map(id => [id, names[id]])), player: { id: "kael", name: scene.playerName },
    scenario: (contextVersion === 2 ? `${directorCurrentHandoff(scene, names)}\n\n` : "") + canonicalJson({ location: scene.locationId, phase: scene.phase, intent: scene.intent, facts: scene.facts, memories: scene.memories, authorSource: scene.authorSource, currentRole: scene.role, programChoices: scene.choices, ...(scene.settlement ? { settlement: scene.settlement } : {}) }),
    userInput: canonicalJson({ previousRead: scene.previous, taskReports: scene.taskReports, selected: scene.selected,
      ...(scene.settlementRead ? { expeditionRead: (contextVersion ?? 0) >= 3 ? scene.settlementRead.filter(l => !scene.previous.some(p => p.sceneId === l.sceneId)) : scene.settlementRead } : {}),
      ...(contextVersion === 3 ? { currentProgram: scene.progress } : {}) }) + (contextVersion === 3 ? `\n\n${directorContinuityHandoff(scene, names)}` : ""),
    ...((contextVersion ?? 0) >= 4 ? { currentTurn: directorCurrentTurn(scene, names, contextVersion === 7 ? LOW_INTERACTION_HANDOFF : contextVersion === 6 ? LOW_CURRENT_RESPONSE_HANDOFF : undefined) + (contextVersion === 5 ? `\n${LOW_ATTITUDE_HANDOFF}` : "") } : {}) }, true, readerVersion);
}
export const directorLowWriting = (job: DirectorJob) => job.attempts.find(a => a.stage === "writing" && (a.status === "succeeded" || a.id === job.lowRevalidatedWriting))?.output ?? "";
function directorSingleGMHandoff(scene: DirectorSceneContext, plan?: SceneGMPlan, contextVersion?: DirectorLowContextVersion) {
  if ((contextVersion ?? 0) >= 21) return directorReplyHandoffV21(scene, names, plan);
  if ((contextVersion ?? 0) >= 20) return directorReplyHandoffV20(scene, names, plan);
  const v18 = (contextVersion ?? 0) >= 18;
  const base = directorReplyHandoff(scene, names, v18 ? TASK_GUIDE_HANDOFF_V18 : undefined).replace("阶段是否结束由后处理结合前文判断", "阶段是否结束由GM结合前文判断，封装不作判断");
  if (v18 && plan) return `${base}\n【上一轮GM交流建议（不是事实）】\n${JSON.stringify(sceneContinuationGuide(plan))}\n${CONTINUATION_HANDOFF_V18}\n字数只计中文正文，不计日文、思考、标签或选项。`;
  return plan ? `${base}\n【上一轮GM指导】\n${JSON.stringify(plan)}\n以下GM指导来自上一轮交谈，写于玩家本轮选择之前：以本轮selectedResponse为准承接，指导与实际选择不一致处不执行，alreadyCovered是无需重复的内容而非本轮提纲；不原地总结或重演已发生情节。达到stopWhen就收束，不为建议字数添新话题。字数只计中文正文，不计日文、思考、标签或选项。`
    : `${base}\n本轮没有待继承的GM续轮指导，直接按已有事件安排和当前步骤生成，不等待另一次写前分派。`;
}
function directorGMHandoff(scene: DirectorSceneContext, plan?: SceneGMPlan) {
  const base = directorReplyHandoff(scene, names)
    .replace(/【本轮篇幅】[\s\S]*?【实际进度】/, "【实际进度】")
    .replace(/taskGuide中的目标[^\n]+/, "taskGuide供核对任务事实；已告知的信息不再展开。本轮只处理GM指定的缺项或玩家回应，不重新背诵任务指引。")
    .replace("阶段是否结束由后处理结合前文判断", "阶段是否结束由GM结合前文评估，封装不作判断");
  return `${base}\n【场景GM本轮安排】\n${plan ? JSON.stringify(plan) : "等待GM分派，本帧尚不用于正文调用。"}\n遵照focus，只承接当前输入；alreadyCovered是已讲过的内容，不是本轮提纲。达到stopWhen就收束，不为建议字数补出新话题。字数是本轮中文正文的软目标，不计日文、思考、标签和选项；文风、三段结构与人物演绎仍沿用原预设。`;
}
export function compileDirectorLow(job: DirectorJob, stage: "writing" | "formatting"): DirectorPreparedInput {
  const request = compileLowRequest(job.lowFrame!, stage === "formatting" ? directorLowWriting(job) : undefined, job.lowReadVersion, job.lowFormatVersion);
  return { stage, messages: request.messages, contextHash: request.requestHash, selectedMemoryIds: job.scene!.memories.map(m => m.id), bytes: request.messages.reduce((n, m) => n + utf8Size(m.content), 0), diagnostics: ["正式洋馆Low；原r8；仅当前节点；程序选项仍由事件步骤控制"] };
}
