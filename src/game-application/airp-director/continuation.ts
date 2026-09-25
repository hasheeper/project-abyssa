import type { DirectorSceneContext } from "./contracts";
import { directorSceneBrief } from "./scene-brief";
import { directorCurrentHandoff } from "./handoff";
import { LOW_INTERACTION_HANDOFF } from "../airp-low/continuity";

/** v13 separates this reply's purpose from the event's unchanged program role. */
export function directorReplyPurpose(scene: Pick<DirectorSceneContext, "role" | "intent"> & {turn: number}) {
  if (scene.turn > 0) return "紧接已读前文，只回应玩家本轮选定的态度或问题；不重新演出本阶段的开场。";
  if (scene.role === "acceptance") return "玩家已经明确接单。写人物对此的反应，只补前文尚未交代的必要任务信息，然后自然收束。";
  return scene.intent;
}

export function directorReplyBrief(scene: DirectorSceneContext) {
  const brief = directorSceneBrief(scene, true);
  const firstOffer = scene.role === "offer" && (scene.dialogue?.turn ?? 0) === 0;
  const request = brief.eventBrief.requestReference;
  return {...brief, eventBrief: {...brief.eventBrief,
    // The scene is activated once, not twice as both request and active script.
    requestReference: firstOffer ? request : null,
    // Keep the author's exact request/constraints, without the opening actions.
    requestDefinition: !firstOffer && request ? {id: request.id, statements: request.nodes.flatMap(n => n.frames.filter(f => f.kind === "dialogue"))} : null,
  }, activeAuthorScript: firstOffer || (scene.dialogue?.turn ?? 0) > 0 ? null : brief.activeAuthorScript};
}

// Consultation c-c31be302 failed twice; scoped implementation of the approved diagnosis.
export function directorReplyHandoff(scene: DirectorSceneContext, names: Record<string, string>, taskGuideHandoff?: string) {
  const firstOffer = scene.role === "offer" && (scene.dialogue?.turn ?? 0) === 0;
  const shortReply = (scene.dialogue?.turn ?? 0) > 0 || ["acceptance", "feedback", "result", "declined"].includes(scene.role);
  return `${directorCurrentHandoff(scene, names, scene.intent)}
【本轮任务】${scene.intent}
【前文与资料】
previousRead是已经读过的完整对话，不是待重演的剧本。紧接最后一段的动作与情绪，selectedResponse是本轮新输入。已经交代的请求、用途、位置与提醒直接承接，只有玩家确实追问时才针对性解释。
eventBrief是事件依据；requestDefinition保留作者原话中的请求和约束，不代表本轮要再说一遍。activeAuthorScript只在对应步骤首次启用；其中旧时空不覆盖programState，前文对话也不能代替程序确认。
【本轮篇幅】
${firstOffer ? "本轮首次提出，沿用原文风与篇幅弹性，让玩家理解来意、请求和缘由，停在回应处。" : shortReply ? "续谈、接受回应和结果反馈只写当前这一拍；有多少新内容写多少，不按初次完整场景的约600字、20段扩写。沿用原文风与三段结构，各段可以很短，不为凑足篇幅重讲任务、另起环境开场或反复收拾物件、等待答复。" : "本轮有新的实际进展，沿用原文风与篇幅弹性，只演出当前步骤，不重讲前文的委托。"}
【实际进度】
${scene.progress?.delivery?.status === "pending" ? "目标已带回，尚未交付；不能写成角色已收走。" : scene.progress?.delivery?.status === "confirmed" ? "玩家已明确交付，直接写交付后的反应，不重演归来和检查。" : "没有程序确认的交付，不补出交接或完成。"}
${scene.progress?.runResult?.partyIds ? `本趟实际同行者：${scene.progress.runResult.partyIds.map(id => id === "kael" ? scene.playerName : names[id] ?? id).join("、")}；同行者不是留馆等候的人。` : ""}
${taskGuideHandoff ?? "taskGuide中的目标、地点、达成条件、交付对象须让玩家了解；前文已交代的继续有效，只补缺项，不逐条重述或念出界面操作说明。接单后不再询问是否愿意参与，实际出发留给玩家操作。"}
【本轮输入】
${JSON.stringify(scene.dialogue ? {...scene.dialogue, previousRead: undefined} : null)}
${LOW_INTERACTION_HANDOFF}
态度不代替接受、拒绝、推迟、交付等程序决定。已有回应充分时自然收束，不为了末尾候选再提出新问题；阶段是否结束由后处理结合前文判断。`;
}
