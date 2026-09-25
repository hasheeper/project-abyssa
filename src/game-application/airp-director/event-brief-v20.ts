import type {DirectorSceneContext, SceneGMPlan} from "./contracts";
import {directorReplyBrief, directorReplyPurpose} from "./continuation";
import {directorCurrentHandoff} from "./handoff";
import {sceneContinuationGuide} from "./scene-gm-v18";

// Versioned input adapters for the THREE unapproved engineering drafts only.
// The original catalogs, scripts, hashes, character cards and historic requests stay intact.
const drafts: Record<string, {digest: string; situation: string; request: string; motivation: string; constraints: string[]; lead?: {source: string; knownBy: string[]; claim: string}}> = {
  "ripple.elora.old-medicine-case": {
    digest: "0c370264161379d3e75eb3b4d831204be643d73f0dfbf8a08beb6e7b48c02f3a",
    situation: "艾洛拉整理绷带时，布袋装不下，物品难以分开放。",
    request: "希望玩家巡守旧庄园时带回一只黄铜搭扣的空药箱。",
    motivation: "用空箱子分开放置手头的绷带等物品。",
    constraints: ["需要的是空箱子，不是旧药品；箱内即使残留药品也不要拿来用。", "实际目标位置与达成条件以程序目标为准。"],
    lead: {source: "玛丽埃塔告知艾洛拉", knownBy: ["elora"], claim: "旧庄园勤务走廊还留有这只空药箱；这是人物得知的线索，不是本场共同目击。"},
  },
  "ripple.elora.watch-note": {
    digest: "095b77edc3f9672796fdab60ca13f63bfd7613e3d42036477081a48674285c97",
    situation: "艾洛拉手边两张整备表的记录似乎对不上。",
    request: "请玩家把原纸带给尤斯缇丝核对，再带回答复。",
    motivation: "艾洛拉担心再次抄写会带来新的差错，希望直接核对原纸。",
    constraints: ["提出委托时尚不知差异原因；尤斯缇丝的解释只在对应行动反馈时出现。"],
  },
  "ripple.kororo.quiet-cup": {
    digest: "f33de54a731802744ef792fab08dc3b378d8bb410c4bbd9be31c4e4023328558",
    situation: "柯萝萝捧着热杯，身旁可以腾出半张椅子。",
    request: "邀请玩家坐一会儿，没有需要帮忙的任务。",
    motivation: "留一点安静相伴的时间，不另造委托。",
    constraints: ["玩家选择前不预写已经坐下或陪伴完毕。"],
  },
};
function draftFor(id: string, digest?: string | null) {
  const draft = drafts[id]; return draft?.digest === digest ? draft : null;
}

export function directorReplyPurposeV20(scene: {role: DirectorSceneContext["role"]; turn: number; intent: string; cardId: string; digest?: string}) {
  if (scene.turn > 0) return "紧接已读前文和玩家实际输入，推进本轮仍有必要的交流或反馈，不重新演出本阶段开场。";
  if (scene.role === "offer" && draftFor(scene.cardId, scene.digest)) return "从人物当前处境自然提出这件事，让玩家理解来意与请求，停在玩家回应处。";
  return directorReplyPurpose(scene);
}

export function directorReplyBriefV20(scene: DirectorSceneContext) {
  const base = directorReplyBrief(scene), draft = draftFor(scene.card.id, scene.authorSource?.digest);
  if (!draft) return base; // Unknown/approved author content is not silently rewritten.
  const {requestReference: _reference, requestDefinition: _definition, ...event} = base.eventBrief;
  let plannedBeat: string | null = null;
  if (scene.card.id === "ripple.elora.watch-note" && scene.role === "feedback" && scene.progress?.actionOutcome === "succeeded")
    plannedBeat = "本步待演出：尤斯缇丝核对原纸，说明圈记是自己改的、墨水太浅；将该行描清后把原纸交回玩家。不是已经发生的记录，完成后仍须返回艾洛拉。";
  if (scene.card.id === "ripple.elora.watch-note" && scene.role === "result")
    plannedBeat = "承接玩家实际带回的核对答复，艾洛拉据此确认记录；具体结果以已读反馈为准，不强行套用旧剧本结局。";
  if (scene.card.id === "ripple.kororo.quiet-cup" && scene.role === "result")
    plannedBeat = "在玩家已选择坐一会儿的基础上，演出安静相伴与自然结束，不追加任务。";
  return {eventBrief: {...event, synopsis: draft.situation, motivation: draft.motivation, request: draft.request, constraints: draft.constraints,
    ...(draft.lead ? {lead: draft.lead} : {}), sourceStatus: "working-draft-event-basis-not-dialogue"},
    currentAction: base.currentAction, plannedBeat, authorSourceDigest: base.authorSourceDigest, programState: base.programState};
}

export function directorReplyHandoffV20(scene: DirectorSceneContext, names: Record<string, string>, plan?: SceneGMPlan) {
  return `${directorCurrentHandoff(scene, names, scene.intent)}
【事件与演出】
eventBrief提供处境、请求、动机与约束；动机是人物在剧情内的动机，不是写作指令。具体台词、动作和节奏由你结合完整角色卡与原预设创作。工作稿只作事件依据，不作成品台词。plannedBeat是当前步骤的待演出内容，不是已发生事实，须服从programState和实际前文。
previousRead是已读原文，角色说法保留其来源与知情范围；紧接玩家实际selectedResponse及当前进展，已交代内容自然承接，不重开委托说明。推进当前交流、必要反馈或人物回应，不限于回答问题。taskGuide由界面展示，不是台词清单。
初场沿用原文风与篇幅弹性；续谈、接单回应与收尾按新增内容落笔，不为约600字扩写。原三段结构保留，各段可短。
【实际边界】
${scene.progress?.delivery?.status === "confirmed" ? "目标已明确交付，写交付后的反应，不重演归来检查。" : scene.progress?.delivery?.status === "pending" ? "目标已带回但未交付，不写成角色已经收走。" : "没有程序确认的交付，不补出交接或完成。"}
${scene.progress?.runResult?.partyIds ? `本趟实际同行者：${scene.progress.runResult.partyIds.map(id => id === "kael" ? scene.playerName : names[id] ?? id).join("、")}；同行者不是留馆等候的人。` : ""}
态度不代替接单、拒绝、出征或交付。末尾仍按原预设给三个不同方向的态度标签，不把候选写成已发生决定；回应充分处自然收束，是否结束由GM判断，封装不判断。
【本轮输入】${JSON.stringify(scene.dialogue ? {...scene.dialogue, previousRead: undefined} : null)}
${plan ? `【上一轮GM交流建议（不是事实或台词）】${JSON.stringify(sceneContinuationGuide(plan))}\n仅供续谈范围与软篇幅参考，以玩家实际选择为先；去重查previousRead，不复述旧GM概括，不为凑字另添话题。字数只计中文正文。` : ""}`;
}
