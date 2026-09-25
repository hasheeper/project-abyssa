import type { AirpCard, AirpScript } from "../../game-core/contracts";
import type { DirectorSceneContext } from "./contracts";
import { directorCurrentHandoff } from "./handoff";

/** Activate author material by the actual step; never change the catalog or its hash. */
export function directorSceneBrief(scene: DirectorSceneContext, matchReturnWitness = false) {
  const original = scene.authorSource ? JSON.parse(scene.authorSource.text) as { card: AirpCard; scripts: Record<string, AirpScript> } : null;
  const reference = (role: string) => {
    const key = original?.card.scenes[role as keyof AirpCard["scenes"]], script = key && original?.scripts[key];
    return script ? { id: script.id, nodes: script.nodes.filter(n => n.kind === "beat") } : null;
  };
  const role = scene.role === "offer" ? "offer" : scene.role === "declined" ? "declined" : scene.role === "aftermath" ? "aftermath"
    : scene.role === "feedback" && scene.card.form === "liaison" ? "target"
    : scene.role === "feedback" && scene.progress?.actionOutcome === "failed" ? "retry"
    : scene.role === "result" ? scene.card.form === "sortie"
      ? scene.progress?.delivery?.status === "confirmed" ? scene.progress.runResult?.outcome === "cleared" ? "return-cleared" : "return-extracted" : ""
      : "complete" : "";
  const objective = original?.card.objective;
  const eventBrief = {
    title: scene.card.title, synopsis: scene.card.synopsis, motivation: scene.card.motivation,
    themeDescription: scene.card.themeDescription, form: scene.card.form, giverId: scene.card.giverId,
    // The request's exact authored words, not the future-resolution summary or old UI options.
    requestReference: scene.role === "followup" ? null : reference("offer"),
    objective: objective?.form === "sortie" ? { item: objective.itemLabel, ...objective.spec.objective } : null,
  };
  const currentAction = scene.card.actions[scene.actionIndex] ?? null;
  // The old fixed return scripts assume the giver stayed home. A companion
  // already witnessed the journey; those lines would turn known facts into questions.
  const incompatibleHomecoming = matchReturnWitness && scene.role === "result" && scene.card.form === "sortie" && scene.progress?.runResult?.partyIds?.includes(scene.card.giverId);
  return { eventBrief, currentAction, activeAuthorScript: role && !incompatibleHomecoming ? reference(role) : null,
    authorSourceDigest: scene.authorSource?.digest ?? null, programState: scene.progress ?? null };
}

// Prompt-refine: Fable c-e3da8b8b / t-b0e1ee01; only the runtime handoff, not r8.
export function directorBriefHandoff(scene: DirectorSceneContext, names: Record<string, string>) {
  return `${directorCurrentHandoff(scene, names)}
【本次事件】
eventBrief给出谁来找玩家、为什么、请求什么；currentAction是当前行动，programState是实际进度。activeAuthorScript和requestReference是作者参考，不是已经发生的事；其中旧时空不覆盖本场状态。
初次提出时，通过角色对话让玩家理解来意、请求和缘由，再停在回应处，不把资料逐条念成说明书。后续只回应玩家的新选择或实际结果，不再重复解释同一请求。
【本步长度】
初次提出和有真正新进展的场景沿用原文风与篇幅弹性。接受回应、实际行动反馈、交付收尾只写一个短节拍，随新增内容而定，不为约600字扩写，不重新迎接、介绍或检查。原三段结构保留，各段可以很短，不添加事情填满。
【当前进度】
${JSON.stringify(scene.progress)}
${scene.progress?.delivery?.status === "pending" ? "目标已带回，尚未交付；不能写成角色已收走。" : scene.progress?.delivery?.status === "confirmed" ? "玩家已明确交付。直接写交付后的反应，不重演归来和检查。" : "没有程序确认的交付，不补出交接或完成。"}
${scene.progress?.runResult?.partyIds ? `本趟实际同行者：${scene.progress.runResult.partyIds.map(id => id === "kael" ? scene.playerName : names[id] ?? id).join("、")}；同行者不是留馆等候的人。` : ""}
${scene.role === "acceptance" && scene.card.actions[scene.actionIndex]?.kind === "patrol" && scene.card.actions[scene.actionIndex].choices.length === 1 ? "任务已经接下。回应玩家这次表态即可，后面由玩家从地图出发，没有另一轮巡守做法选择，不再问愿不愿意去。" : ""}
【回应】
末尾仍给三个不同方向的中文短态度标签。标签不是玩家已说出的话，不代替接受、拒绝、推迟、交付等外层操作。收到selectedAttitudes后才承接该态度；实际决定只依据programState和programChoices。不虚构额外路线、任务或可操作物件。`;
}
