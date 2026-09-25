import type { ExpeditionSlot } from "../../game-core/contracts";
import type { NodeJob, NodeSnapshot } from "./contracts";
import { LOW_ATTITUDE_HANDOFF, LOW_INTERACTION_HANDOFF } from "../airp-low/continuity";

const actionLabels: Record<string, string> = {
  continue: "继续当前关卡流程", leave: "撤回洋馆", descend: "进入下一层", deeper: "进入下一层",
  "event-enter": "参与当前关卡事件", "event-leave": "离开当前关卡事件",
};

/** Slot capabilities are engine-owned. GM actionIds are suggestions, not that capability list. */
export function nodeCurrentProgram(s: NodeSnapshot, j: NodeJob, slot: ExpeditionSlot) {
  return {
    version: 8, runId: s.program.runId, routeId: s.program.routeId,
    day: Math.floor(s.program.phase / 4) + 1, phase: ["清晨", "白天", "黄昏", "夜晚"][s.program.phase % 4],
    layer: slot.layer, roomIndex: slot.roomIndex, timing: slot.timing,
    stage: { arrive: "当前关卡已抵达，玩法尚待执行", cleared: "当前关卡已处理，尚未离开", exit: "本层出口，等待继续或撤回" }[slot.timing],
    availableActions: slot.actionIds.map(id => ({ id, label: actionLabels[id] ?? id })),
    actualActions: s.program.actions.filter(a => a.slotId === slot.id),
    objectiveProgress: s.program.objectiveProgress,
    gmSuggestedActionIds: j.node.actionIds, stop: j.node.stop,
    choicesAreAttitudes: true, newGameplayBranches: false,
  };
}

/** Fable c-96e712c1 / t-903b2938. Handoff, not another literary preset. */
export const NODE_CONTINUITY_HANDOFF = `【本节点交接】
当前地点、已执行动作和可操作项以currentProgram及程序事实为准；GM意图只给叙事方向，不新增路线、机关或奖励。gmSuggestedActionIds是建议，不是已经执行的动作，也不限制程序本来允许的其他做法。
可以写环境细节和人物反应，但不要把环境描写变成新的可选关卡分支。未执行的玩法动作留给程序；承接已读前文的末尾，不重新勘察、重新发现或把同一过程再演一遍。
末尾三个选项是对眼前同一局面的三种不同立场或关注点，不是待执行动作菜单；不写具体行军、开门、分路、撤离步骤，不许诺程序没有的操作，选了某种态度也不等于该行动已完成。
${LOW_ATTITUDE_HANDOFF}
【副本节奏】保留定位、风险和动作反馈所需的画面；普通探索不必全员轮流表态，由与眼前事情相关的人自然接话，台词之间可以直接承接，不必每句都配一段站姿或动作。已说清的提醒没有新变化就不复述；同一连贯动作不为插入逐人反应而反复切开。`;

/** Only new nodes use the replacement; saved LowFrames keep their literal old instructions. */
export const NODE_CURRENT_HANDOFF = NODE_CONTINUITY_HANDOFF.replace(
  `末尾三个选项是对眼前同一局面的三种不同立场或关注点，不是待执行动作菜单；不写具体行军、开门、分路、撤离步骤，不许诺程序没有的操作，选了某种态度也不等于该行动已完成。\n${LOW_ATTITUDE_HANDOFF}`,
  LOW_INTERACTION_HANDOFF,
);
