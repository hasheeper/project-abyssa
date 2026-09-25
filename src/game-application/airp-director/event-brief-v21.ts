import type {DirectorSceneContext, SceneGMPlan} from "./contracts";
import {directorReplyHandoffV20} from "./event-brief-v20";

export function directorReplyHandoffV21(scene: DirectorSceneContext, names: Record<string, string>, plan?: SceneGMPlan) {
  return directorReplyHandoffV20(scene, names, plan)
    .replace("初场沿用原文风与篇幅弹性；续谈、接单回应与收尾按新增内容落笔，不为约600字扩写。原三段结构保留，各段可短。",
      "按当前交流所需的新增内容落笔：仅需承接态度、简短补充或收尾时简短完成，有必要的新问题、进展或人物回应时展开。没有GM建议时不设固定字数或自然段数。原三段结构保留，各段可短，共同完成当前交流，不为凑篇幅另造话题。")
    .replace("仅供续谈范围与软篇幅参考，以玩家实际选择为先；去重查previousRead，不复述旧GM概括，不为凑字另添话题。字数只计中文正文。",
      "建议在玩家本次选择前给出，仅供续谈范围与软篇幅参考；以实际selectedResponse为先，实际选择带来新问题或必要交流时相应展开，不受旧字数约束。回应充分即可收束；去重查previousRead，不复述旧GM概括，不为凑字另添话题。字数只计中文正文。");
}
