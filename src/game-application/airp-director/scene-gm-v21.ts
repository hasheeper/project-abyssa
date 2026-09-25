import type {SceneGMPlan} from "./contracts";
import {SCENE_GM_TURN_V20} from "./scene-gm-v20";

// Fable prompt-refine c-8a9c6235 / t-157122e1. Keep the v20 prompt replayable.
export const SCENE_GM_TURN_V21 = SCENE_GM_TURN_V20
  .replace("首次保留态度回应机会", "首次无论处境和请求是否已交代清楚，都须保留玩家表态机会：返回complete=false，unresolved写明等待并回应玩家实际选择，next给出下一轮范围与软篇幅；首轮不得返回complete=true或省略next")
  .replace("suggestedWords按新增信息给中文正文软目标，不是最低配额；三段结构保留，各段可短。",
    "next.pacing：下一轮只需承接态度、简短补充或收尾时用brief；确有未答问题、必要的新进展或需进一步交流的人物立场时用develop。suggestedWords按上述新增内容估计中文正文篇幅，是软目标而非最低配额，不以重复解释、背景或提醒凑字。玩家尚未作出下一轮选择，next不预设其态度或行为；实际选择带来需要展开的新问题时可调整篇幅，不受旧字数约束。三段结构保留，各段可短，共同完成当前交流，不为凑篇幅另造话题。");

export const FIRST_RESPONSE_PENDING = "等待并回应玩家首次实际选择。";

/** Program fallback only when GM said the first offer was already sufficient. */
export function firstResponsePlan(): SceneGMPlan {
  return {pacing: "brief", suggestedWords: 100,
    focus: "承接玩家下一次实际态度；若玩家提出新问题或人物仍有必要回应，按实际内容展开，不预设玩家选择。",
    alreadyCovered: [], stopWhen: "实际态度、追问与必要人物回应已处理充分时收束，不重复请求说明。",
    reason: "程序首轮保护的兜底建议：GM已判断当前说明充分，仍须保留玩家表态与人物承接；100字仅供简单回应参考。"};
}
