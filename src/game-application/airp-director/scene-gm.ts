import * as v from "../../game-core/contracts";
import { directorHash } from "../../game-core/session";
import type { DirectorJob, DirectorPreparedInput, SceneGMEvaluation, SceneGMPlan } from "./contracts";
import { directorReplyBrief } from "./continuation";
import { resolveGMDocuments } from "./gm-context";
import type { SourceDocument } from "../airp-generation/contracts";
import { SCENE_GM_TURN_V18, sceneContinuationGuide } from "./scene-gm-v18";
import { GM_MEMORY_INSTRUCTION } from "../airp-memory/prompt";
import { correctionEnvelope } from "../airp-memory/effective";
import { sceneMemoryContext } from "../airp-memory/d5";
import { directorReplyBriefV20 } from "./event-brief-v20";
import { acceptanceCoverageInput, readAcceptanceCoverage } from "./acceptance-coverage";
import { SCENE_GM_TURN_V20 } from "./scene-gm-v20";
import {FIRST_RESPONSE_PENDING, firstResponsePlan, SCENE_GM_TURN_V21} from "./scene-gm-v21";

export const SCENE_GM_PLAN_PROMPT = `你是当前事件的场景GM。结合本事件完整已读对白、最新玩家态度或程序选择、当前进度与相关记忆设定，只决定本轮推进什么与大致篇幅。不写台词、不分段排演、不规定人物语气。
已有内容直接继承，不重新介绍整件委托。玩家刚表态而人物尚未回应时安排简短回应；有真实新问题或新进展才展开。建议字数按新增信息给出，是中文正文软目标，不是最低配额；原三段结构保留，但各段可以很短。不要用增加背景、提醒或任务说明凑篇幅。
taskGuide是程序目标。前文已经告知的继续计入，接单后仅补缺项；角色卡示例和作者剧本不是本次事实，不把第三层写成第三个房间。未来行动和候选不是已经发生。
只输出JSON：{"pacing":"brief或develop","suggestedWords":建议中文正文字数,"focus":"本轮仅需处理什么","alreadyCovered":["前文已明确交代的事项"],"stopWhen":"本轮收束条件","reason":"简短可核对依据"}。不新增路线、道具、任务、玩家承诺或状态命令。`;

export const SCENE_GM_EVALUATE_PROMPT = `你是当前事件的场景GM，评估当前交谈是否完成，不挑文风瑕疵、不修改或续写正文。
结合完整previousRead和当前currentText，检查人物是否实际回应最新玩家输入、当前阶段必要问题是否解释清楚。currentText是即将展示的本轮文本，评估通过不代表玩家已经阅读。
前文已明确交代的信息继续计入，不要求本轮重述。接单反馈需要让玩家知道目标、地点、达成条件和交付对象；taskGuide只检查缺项，不要求逐条背诵界面操作。待接单、出征、取得物品、交付等程序操作不等于还需要对白。
首轮提出保留一次态度回应机会；玩家新态度未被回应时不能直接结束。当前问题都已回应则complete=true；确有必要问题仍需交谈才false，并列明缺项。不因字数少、表情瑕疵、重复或文风欠佳要求重写，也不因正文自带三个候选而强行继续。
只输出JSON：{"complete":true或false,"reason":"简短可核对依据","unresolved":["仍需交谈的具体问题，结束时为空"]}。complete只允许在玩家读完后结束当前交谈阶段，不代表接受任务、执行行动、发放奖励或更新变量。`;

// Keep the real v14 attempts replayable. v15 adopts the consultant's phase-scope patch.
const PLAN_V15 = SCENE_GM_PLAN_PROMPT + `\n输入中的previousEvaluation是上一轮场景GM对交谈的评估，不是已发生的事实。若其unresolved中列有属于当前阶段、且前文尚未回答的问题，本轮在回应玩家最新表态的同时安排补齐，并写入focus；若该问题已被前文回答，或属于后续阶段（如接单后才需说明的路线、达成条件），则不纳入本轮，也不重复。仍只决定本轮范围与软字数，不写台词、不分段排演、不规定语气。`;
const EVALUATE_V15 = SCENE_GM_EVALUATE_PROMPT + `\n严格按current.role判断当前阶段，只核对本阶段及玩家当前输入是否已被回应，不跨阶段索取完成证据。
- offer：人物只需提出事情并回应玩家表态。玩家明白人物遇到什么问题、希望玩家做什么即可；首次提出时保留一次表态机会。人物回应玩家表态后，即使尚未正式接单也可判定complete=true，是否接单交由程序决定。不得以acceptance阶段才需要的详细路线、达成条件、交付说明卡住offer。
- acceptance：核对taskGuide中的必要缺项（目标、地点、达成条件、交付对象），此前已说清的计入。
- 其余阶段：只判断本阶段问题及当前输入是否已回应。
尚未执行的程序行动（接单、出征、交付等）不列入unresolved。complete=false必须对应当前阶段仍需交谈才能解决的具体缺项，不得用于要求增加字数或多过一轮。`;

/** v16: one post-writing call owns both completion and the next turn's guidance. */
export const SCENE_GM_TURN_PROMPT = `你是当前事件的场景GM。输入：本轮已封装中文正文currentText、此前完整已读previousRead、当前阶段current.role、玩家实际输入、任务事实/记忆/相关完整设定。一次完成两件事：判断本阶段是否已充分回应；若需继续，给下一轮范围与软篇幅。
currentText是玩家即将读到、尚未读完的内容，不是已发生的阅读记录；未被选中的候选不是玩家事实。不写台词、不逐段排演、不规定语气；不评价文风，不改写正文。
按current.role判断，只核对本阶段目的与当前输入是否已回应，不跨阶段索取证据：
- offer：人物遇到的问题/请求已明确，且已回应玩家表态即可收束。首次提出时须留一次表态机会，不得直接判完成。
- acceptance：核对目标、地点、达成条件、交付对象，前文已说清的计入，只补缺项。
- 其他阶段：只检查本阶段目的及当前输入是否已回应。
等待接单、出征、取物、交付等程序操作不是继续对白的理由；不因字数少、重复、表情或文风要求再写一轮。
complete=true：玩家读完本轮后结束当前交谈，next=null，unresolved为空；不执行接单/出征/交付/结算。
complete=false：必须给出next，unresolved列出当前阶段仍需交谈的具体缺项（未答问题或待回应的玩家表态）。下一轮玩家尚未选择，不预设其意愿、行为或结果；指导以玩家实际选择为准，只需补缺项或简短回应，已交代内容不复述。suggestedWords按新增信息量给出，是中文正文软目标而非最低配额，不为凑字添新话题；三段结构保留，各段可短。
不新增任务、路线、道具、奖励或玩家承诺。
只输出JSON：{"complete":true或false,"reason":"简短依据","unresolved":["当前阶段仍需交谈的问题"],"next":null或{"pacing":"brief或develop","suggestedWords":建议中文正文字数,"focus":"下一轮只需推进什么","alreadyCovered":["本轮及前文已交代、无需重复的事项"],"stopWhen":"下一轮自然收束条件","reason":"篇幅与范围依据"}}。`;

export function compileSceneGM(job: DirectorJob, stage: "scene-plan" | "scene-evaluate", sources?: SourceDocument[]): DirectorPreparedInput {
  if (!job.scene || !job.lowFrame || (job.lowContextVersion ?? 0) < 14 || stage === "scene-evaluate" && !job.text) return v.invalid("scene-gm", "Missing scene GM context");
  const scene = job.scene, scoped = (job.lowContextVersion ?? 0) >= 15, combined = (job.lowContextVersion ?? 0) >= 16;
  const global = (job.lowContextVersion ?? 0) >= 17;
  const v18 = (job.lowContextVersion ?? 0) >= 18;
  const v20 = (job.lowContextVersion ?? 0) >= 20;
  if (global && (!job.gmContext || !sources)) return v.invalid("scene-gm", "Missing frozen global context/source library");
  if (combined && stage !== "scene-evaluate") return v.invalid("scene-gm", "This version has no pre-writing GM call");
  const {previousRead: _read, ...dialogue} = scene.dialogue ?? {};
  const globalContext = job.gmContext?.memoryContext ? {...job.gmContext, memoryContext: sceneMemoryContext(job.gmContext.memoryContext, job.id, scene.actorIds, job.text!.lines)} : job.gmContext;
  const context = {...(global ? {global: globalContext, taskGuidePresentation: {text: scene.dialogue?.taskGuide ?? [], channel: "task-guide-and-stage-exit", readConfirmed: false}} : {}), ...(v20 ? {acceptanceCoverage: acceptanceCoverageInput(job)} : {}), event: v20 ? directorReplyBriefV20(scene) : directorReplyBrief(scene), current: {role: scene.role, intent: scene.intent, location: scene.locationId, phase: scene.phase, actors: scene.actorIds,
    dialogue, selected: scene.selected, selectedAttitudes: scene.selectedAttitudes ?? [], progress: scene.progress ?? null},
    previousRead: scene.previous, taskReports: scene.taskReports, expeditionRead: scene.settlementRead ?? [],
    facts: scene.facts, memories: scene.memories, settlement: scene.settlement ?? null,
    ...(scoped ? {previousEvaluation: scene.previousEvaluation ?? null} : {}),
    ...(stage === "scene-evaluate" ? {...(combined ? {guidanceUsed: v18 ? sceneContinuationGuide(scene.previousEvaluation?.next) : scene.previousEvaluation?.next ?? null, candidateAttitudes: job.lowChoices ?? []} : {plan: job.sceneGMPlan ?? null}), currentText: job.text!.lines} : {})};
  const memoryContext = job.gmContext?.memoryContext;
  const messages = [{role: "system" as const, content: ((job.lowContextVersion ?? 0) >= 21 ? SCENE_GM_TURN_V21 : v20 ? SCENE_GM_TURN_V20 : v18 ? SCENE_GM_TURN_V18 : combined ? SCENE_GM_TURN_PROMPT : stage === "scene-plan" ? scoped ? PLAN_V15 : SCENE_GM_PLAN_PROMPT : scoped ? EVALUATE_V15 : SCENE_GM_EVALUATE_PROMPT) + (memoryContext ? `\n${GM_MEMORY_INSTRUCTION}` : "")},
    {role: "user" as const, content: v.canonicalJson(context)},
    ...(global ? resolveGMDocuments(job.gmContext!, sources!) : job.lowFrame.sources).map(s => ({role: "user" as const, content: `完整资料：${s.path}\n${s.text}`})),
    {role: "user" as const, content: global ? "只返回所请求的JSON，不输出推理过程或台词。" : `不在场人物简稿（不代表在场或共同知情）：\n${job.lowFrame.briefs.map(s => s.text).join("\n\n")}\n只返回所请求的JSON，不输出推理过程或台词。`}];
  const bytes = messages.reduce((n, m) => n + v.utf8Size(m.content), 0);
  if (bytes > 2 * 1024 * 1024) return v.invalid("scene-gm", "Input exceeds 2 MiB; full sources were not trimmed");
  return {stage, messages, bytes, contextHash: directorHash(messages), selectedMemoryIds: (global ? job.gmContext!.memories : scene.memories).map(m => m.id), diagnostics: [combined ? "场景GM：一次判断收束或指导下一轮" : stage === "scene-plan" ? "场景GM：写前节奏分派" : "场景GM：实际文本收束评估", global ? "GM独立全局快照／可调度人物完整原卡；正文知情范围不变" : "完整已读正文与本场卡书；不加载文学创作预设"]};
}
const json = (raw: string) => v.parseJson(raw.trim().replace(/^```(?:json)?\s*\n([\s\S]*?)\n```$/i, "$1"));
export function readSceneGMPlan(raw: string): SceneGMPlan {
  const p = v.record(json(raw), "sceneGMPlan", ["pacing", "suggestedWords", "focus", "alreadyCovered", "stopWhen", "reason"]);
  return {pacing: v.choice(p.pacing, ["brief", "develop"], "pacing"), suggestedWords: v.number(p.suggestedWords, "suggestedWords", 1, 4000),
    focus: v.text(p.focus, "focus", 3000), alreadyCovered: v.list(p.alreadyCovered, "alreadyCovered", 32).map(x => v.text(x, "covered", 2000)),
    stopWhen: v.text(p.stopWhen, "stopWhen", 3000), reason: v.text(p.reason, "reason", 3000)};
}
export function readSceneGMEvaluation(raw: string, job: DirectorJob): SceneGMEvaluation {
  const combined = (job.lowContextVersion ?? 0) >= 16;
  const v18 = (job.lowContextVersion ?? 0) >= 18;
  const v20 = (job.lowContextVersion ?? 0) >= 20;
  const p = v.record(correctionEnvelope(json(raw), !!job.gmContext?.memoryContext), "sceneGMEvaluation", ["complete", "reason", "unresolved"], v20 ? ["next", "taskGuideConflict", "coveredAcceptance"] : v18 ? ["next", "taskGuideConflict"] : combined ? ["next"] : []);
  const complete = v.boolean(p.complete, "complete");
  const result: SceneGMEvaluation = {complete, reason: v.text(p.reason, "reason", 3000), unresolved: v.list(p.unresolved, "unresolved", 32).map(x => v.text(x, "unresolved", 2000)),
    ...(combined ? {next: complete ? null : readSceneGMPlan(v.canonicalJson(p.next))} : {}),
    // Advisory display metadata must not reject a valid completion or rewrite text.
    ...(v18 ? {taskGuideConflict: p.taskGuideConflict === true} : {}),
    ...(v20 ? readAcceptanceCoverage(p.coveredAcceptance, job, complete) : {})};
  // Preserve the established first response opportunity, not a literary gate.
  if (job.scene?.role === "offer" && (job.scene.dialogue?.turn ?? 0) === 0 && result.complete) {
    const protectedResult = {...result, complete: false, reason: `${result.reason}；首次提出仍保留玩家回应机会。`};
    if ((job.lowContextVersion ?? 0) < 21) return protectedResult;
    // Preserve any valid supplied guidance before using an explicitly program-authored fallback.
    return {...protectedResult, unresolved: [...new Set([...result.unresolved, FIRST_RESPONSE_PENDING])],
      next: p.next == null ? firstResponsePlan() : readSceneGMPlan(v.canonicalJson(p.next)), coveredAcceptance: []};
  }
  return result;
}
