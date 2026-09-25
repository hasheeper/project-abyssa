import type { DirectorSceneContext } from "./contracts";

// Fable consultation c-76436680 / t-a0206357. No changes to the frozen literary preset.
const scope: Record<DirectorSceneContext["role"], string> = {
  offer: "把事情交到玩家面前即止，停在玩家参与／推迟／拒绝之前，不替玩家作答。",
  acceptance: "只承接程序已记录的那个选择，不重演提出。",
  action: "只处理尚未确认的做法，不重新解释前场，不提前执行本步骤。",
  feedback: "只回应已经发生的行动和实际结果；带回不等于已经交付。",
  result: "承接本事件已确认的实际结果并收尾，不再接受同一个任务；涉及交付时，以明确交付事实为准。",
  declined: "承接玩家已明确拒绝，不执行任务，不制造新的承诺。",
  followup: "只承接原事件已完成的结果和本次后续，不重新接受或完成原任务。",
  aftermath: "只展示已确认的事件余波，不编造玩家曾经参与。",
};
const labels: Record<DirectorSceneContext["role"], string> = { offer: "提出事情，等待玩家选择", acceptance: "接受回应", action: "行动前确认", feedback: "实际行动反馈", result: "结果收尾", declined: "拒绝收尾", followup: "已完成事件的后续", aftermath: "事件余波" };
const locations: Record<string, string> = { plaza: "小广场", greenhouse: "温室药圃", elora: "艾洛拉的房间", eustice: "尤斯缇丝的房间", norma: "诺玛的房间", kororo: "柯萝萝的房间", tibby: "缇比的杂货铺" };
export function directorCurrentHandoff(scene: Pick<DirectorSceneContext, "phase" | "locationId" | "actorIds" | "playerName" | "role">, names: Record<string, string>, currentScope = scope[scene.role]) {
  return `【本场已确认状态】
游戏日：第${Math.floor(scene.phase / 4) + 1}日；时段：${["清晨", "白天", "黄昏", "夜晚"][scene.phase % 4]}；地点：${locations[scene.locationId] ?? scene.locationId}。
在场者：${[scene.playerName, ...scene.actorIds.map(id => names[id] ?? id)].join("、")}。当前步骤：${labels[scene.role]}。
本场的游戏日、时段、地点、在场者与当前步骤，以这里写明的中文事实为准。作者工作稿是参考，旧场景原文只作前文，都不能覆盖当前时空、玩家已做出的选择和任务进度。程序尚未走到的步骤不要提前演出。
【本步范围】${currentScope}
玩家的自然衔接短句沿用原预设，但不得构成玩家尚未做出的接受、拒绝或承诺。`;
}

/** Fable c-96e712c1 / t-903b2938, integrated with explicit program delivery state. */
export function directorContinuityHandoff(scene: Pick<DirectorSceneContext, "phase" | "locationId" | "actorIds" | "playerName" | "role" | "progress">, names: Record<string, string>) {
  const progress = scene.progress;
  if (!progress) throw Error("v3 handoff requires a program progress projection");
  const delivery = progress.delivery?.status === "pending"
    ? "任务目标已带回，但玩家尚未确认交付。本场只承接归来和实际行动反馈，目标仍由玩家持有；不演出收走、交接完成或玩家答应交付。"
    : progress.delivery?.status === "confirmed"
      ? "玩家已经明确交付任务目标。直接承接这次交付的后果并收尾，不再次欢迎归来、索要交付或重做前场检查。"
      : "没有新的程序交付记录，不从计划或前文补出一次交付。";
  return `${directorCurrentHandoff(scene, names)}
【连续性交接】
事情进行到哪一步，以currentProgram为准；作者工作稿只作参考，已读全文是前文。前文中超出程序进度的叙述不视为既成事实，只承接其中的人物情绪和谈话；已读过的迎接、提出、检查不再重演。
本场是同一段经历的下一拍，不是重新开场。待确认事项只写眼前反应，决定留给玩家；已确认执行的动作直接从后果写起，不再询问或重做。
【交付状态】${delivery}
末尾三项仍是对眼前局面的不同态度，不代替programChoices中的程序选择，不虚构额外玩法操作。`;
}

/** Fable c-96e712c1 / t-60fec557. The live v3 task was buried in a large history message. */
export function directorCurrentTurn(scene: DirectorSceneContext, names: Record<string, string>, responseHandoff?: string) {
  if (!scene.progress) throw Error("v4 current request requires program progress");
  const { evidenceIds: _references, ...current } = scene.progress;
  const needsDecision = ["offer", "acceptance", "action"].includes(scene.role) || current.delivery?.status === "pending";
  return `【当前请求：续接而非重开】
以下只划定本次场景的边界，文风与输出格式仍按原预设。
${directorCurrentHandoff(scene, names)}
当前任务状态：${JSON.stringify(current)}
${current.runResult?.partyIds ? `本趟实际同行者：${current.runResult.partyIds.map(id => id === "kael" ? scene.playerName : names[id] ?? id).join("、")}。其中本场在场的人物与玩家共同经历了这趟出征，并非一直留馆等待；相关已读全文的knownBy仍分别限定人物知情，不把玩家私知变成共同见闻。\n` : ""}\
前文已读步骤：${current.readScenes.map(s => labels[s.role]).join(" → ") || "无，本次是初次提出"}。本场紧接前文最后一场继续，只需完成：${scene.role === "action" && current.actionKind === "patrol" ? "任务已经接下，只确认出发前的安排，然后等玩家通过程序出征；不是再问是否接受任务。" : scope[scene.role]}
已完成的接受、已告知的用途与存放位置、已给出的安全提醒不再整套重演。${scene.role === "offer" ? "本次尚未接受，不替玩家答应。" : "不再询问玩家是否愿意接受原任务。"}
${needsDecision ? "本场结束前，角色仍处于当前交互中：等待玩家决定的角色不写成已离场。" : "已确认的结果从其后果写起，不重演迎接、检查或交付。"}不自行推进游戏时段。${current.delivery?.status === "confirmed" ? "任务目标已明确交付，写这次交付之后的收尾。" : current.delivery?.status === "pending" ? "任务目标已带回但尚未交付；不能写成对方已经收走，也不替玩家答应交付。" : "不补出程序没有确认的交付。"}
${responseHandoff ?? "末尾三个候选表现不同立场或关注点，不包含尚未做出的程序决定，不写具体行军、开门、分路、撤离步骤；程序行为由外层操作决定。"}`;
}
