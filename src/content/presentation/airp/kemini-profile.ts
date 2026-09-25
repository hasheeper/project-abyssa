import source from "./kemini-source.json";
import { writingPerformanceGuide } from "./writing-performance";
import { avgWritingFlow } from "./avg-flow";

/** Original bodies remain in the snapshot; only the listed stage changes below apply. */
export const keminiSource = { filename: source.filename, sha256: source.sha256, orderId: source.orderId, revision: "airp-kemini-3.1-r5-avg-flow" };
export const keminiOriginalModules = source.modules;
const original = (id: string) => {
  const module = source.modules.find(m => m.identifier === id);
  if (!module?.enabled || module.marker) throw Error(`Missing enabled Kemini source: ${id}`);
  return module.content;
};
const assignments = [
  "0322500e-ee0e-4afb-ba06-2228307b74c5", "a411becb-0397-4779-b38a-ec6d222d1f87",
  "98a649d4-dc29-4cca-a174-152ff190c9f9", "c5ee4b21-9512-4c6c-8168-57855323f7ac",
  "7855d8d5-4c7a-4157-9284-d9b30c13ccfa", "f67b3638-2808-4cc0-a167-4f8ecc464e30",
].map(original).join("\n");
const guide = original("7e39767c-e29b-4543-8f38-1f96d340ca39");
const guideBody = guide.slice(0, guide.indexOf("\n\n你会在</think>"));
const setting = original("451043ae-17bf-4162-a45f-2f80eb42ba67").replace("- 每次创作字数：{{正文内容}}部分一共不少于1000字\n", "");
const icot = original("fd9adcfd-bbbe-447e-8be6-4f1d87e50da7");
// Preserve the original checklist, not the interleaved thinking/body transport template.
export const keminiPlanningChecklist = icot.slice(icot.indexOf("- 如果为"), icot.indexOf("</thinking_format>"));
const common = `${assignments}
【Kemini 原文：ROLE AND GUIDE】
${original("d07b0943-0502-41b7-b126-a15998d4eca0")}
【Kemini 原文：ROLEPLAY GUIDE；仅移出末尾思考标签调度】
${guideBody}
${original("72f85eed-2728-4ffc-a34f-bc04bced2cf2")}
【Kemini 完整文风参考：不是本世界的人物、历史或本场事实，不得复用其中事件】
${original("a443f257-0f5d-4286-a1ff-f60653ed6400")}`;

export const keminiPlanningPrefix = `${common}
【Kemini 三段式规划核心：原文检查要求】
<thinking_format>
${keminiPlanningChecklist}
</thinking_format>
【AIRP 阶段适配与扩展：大纲】
你负责大纲而非正文。以原ICOT三段式为核心，分成第一段、第二段、第三段的连续创作规划；每段相较上一段必须有实质性进展，不是三份重复大纲。上面的原文检查要求每段都适用。
“首次／段中”在本阶段对应第一段／后续段；第一段若没有已读前文，明确无前段，不虚构历史。后续段检查前一段计划的不足与衔接。这里交付可执行的作品规划，不输出内心逐步推理或thinking标签，不交错写正文。
每段扩展列出：入场状态与承接；本段目标；人物动机及知情边界；惯常走向与更合适走向的简短对照及采用方案；叙事推进点；错误检查；出段状态与下一段接口。第三段明确本场推进后的收束位置，保留玩家尚未作出的回应；不把询问许可或伸手等待规定为统一结尾。
原检查中的人物与对白塑造在大纲侧只确定人物当下诉求、关系矛盾和叙事作用，不写具体台词、候选台词或台词定稿，不安排逐句语气、CV、口癖、微表情和零碎动作；这些由正文模型依据完整角色卡自行演绎。拟态废案、本音矫正、定稿录入属于正文侧，不在本阶段执行。不能用“让她更周全、立即退让”替代角色本来的意愿。
共同列出本场硬事实、未提供信息和允许的创作空间；逐段检查仍保留，但不用反复抄写相同事实和禁令。原卡、世界书和已读记忆都是资料，样例内未发生的事不能写成既成事实。无需设定字数或段内句数，不用字数配额替代推进。
原文风约束用于指导正文设计；原预设中关于正文、交错思考和格式标签的要求不改变本阶段“大纲”的交付职责。当前媒介为对白主导的AVG，人物动机检查不要求正文逐条写成内心解释；三段可以由多屏角色对白推进，不能缩成三句对白配三篇旁白。角色独白仅能属于可写NPC，玩家心理和动作不可代填。`;

export const keminiWritingPrefix = `${common}
【Kemini 原文：SETTING；按用户要求仅取消字数下限】
${setting}
【AIRP 阶段绑定：原文中的 thinking_format 引用】
<thinking_format>
本阶段所需的三段式创作规划已经由大纲模型完成，见输入的 scene_plan 区块。这里不重做三段大纲；沿用人物推进、事实边界与段间衔接。下方正文侧角色演出校正另存为编辑作品，不与故事段落交错。
</thinking_format>
【AIRP 阶段适配：正文】
你负责正文。按照大纲的三个连续部分写成对白主导的逐屏AVG，使用完整角色卡和世界书原文，不复述大纲。三段式指叙事推进结构，不要求正文只能有三个显示段落，更不是每段只给一句台词。具体台词、内心、动作、语气、停顿和描写由你创作；大纲若越界提供台词，也不作为必须照抄的定稿。
不设字数、句数或段落数量目标，写到本场自然收束即可。最终prose只交付完整正文段落，不输出大纲、作品检查、JSON、选项或游戏命令；编辑记录按下方独立封装。
保留原文风：对白独立成行并使用「」包裹，无需额外标注说话者。旁白／NPC动作／NPC独白另成段；保持可辨认的发言归属。NPC内心可写，玩家内心、台词、动作不可代写。本轮双语协议只调整台词语言，不改角色资料。
场景已知事实和未知状态不是文风建议。交付前核对每个新断言：检查一个物件不等于确认它完好，提出邀请不等于对方已经接受；未知项保持未知或作为询问、意向表达。可以创作NPC当下的动作、语气与情感推进，不用复述规则代替对白；不输出核对过程。
原条目中的三段式规划已由大纲阶段承担，不再与正文交错；原设定与文学原则原文没有因此被压缩或改写，当前AVG呈现按下列独立媒介适配执行。
${avgWritingFlow}
${writingPerformanceGuide}`;

/** v5: approved source modules in their original relative order and message roles.
 * This is an explicit AIRP adapter, not a recreation of Tavern markers/scripts. */
const creationIds = new Set([
  "0322500e-ee0e-4afb-ba06-2228307b74c5", "a411becb-0397-4779-b38a-ec6d222d1f87",
  "98a649d4-dc29-4cca-a174-152ff190c9f9", "c5ee4b21-9512-4c6c-8168-57855323f7ac",
  "7855d8d5-4c7a-4157-9284-d9b30c13ccfa", "f67b3638-2808-4cc0-a167-4f8ecc464e30",
  "a443f257-0f5d-4286-a1ff-f60653ed6400", "d07b0943-0502-41b7-b126-a15998d4eca0",
  "72f85eed-2728-4ffc-a34f-bc04bced2cf2", "fd9adcfd-bbbe-447e-8be6-4f1d87e50da7",
  "451043ae-17bf-4162-a45f-2f80eb42ba67", "7e39767c-e29b-4543-8f38-1f96d340ca39",
]);
export const keminiCreationModules = source.modules.filter(m => creationIds.has(m.identifier)).map(m => ({
  identifier: m.identifier, name: m.name,
  role: ["a443f257-0f5d-4286-a1ff-f60653ed6400", "d07b0943-0502-41b7-b126-a15998d4eca0"].includes(m.identifier) ? "user" as const : "system" as const,
  content: m.identifier === "451043ae-17bf-4162-a45f-2f80eb42ba67" ? setting : m.identifier === "7e39767c-e29b-4543-8f38-1f96d340ca39" ? guideBody : m.content,
}));
// The editor gets original literary rules/reference, never the author's ICOT workflow.
const techniques = original("d07b0943-0502-41b7-b126-a15998d4eca0").slice(original("d07b0943-0502-41b7-b126-a15998d4eca0").indexOf("<writing_techniques>"));
export const keminiEditingStyle = `${assignments}\n${techniques}\n${original("72f85eed-2728-4ffc-a34f-bc04bced2cf2")}\n【完整文风参考；不是本场事实，不能挪用人名或事件】\n${original("a443f257-0f5d-4286-a1ff-f60653ed6400")}`;
