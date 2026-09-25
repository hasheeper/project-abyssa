import { keminiPlanningPrefix, keminiSource, keminiWritingPrefix } from "./kemini-profile";
import { generationDocuments } from "./generation-documents";
import { avgPlanningDirection, avgWritingReminder } from "./avg-flow";
import { keminiCreationModules } from "./kemini-profile";
import { creationPrompt, editingPrompt, chineseFormattingPrompt } from "./creative-prompts";
import { performedEditingPrompt, performedFormattingPrompt } from "./performance-prompts";
import { outlinePrompt, authoredPerformancePrompt } from "./outline-prompts";
import { withSourceActivation } from "./source-activation";
import { scopedKeminiModules } from "./scoped-kemini";
import { scopedPlanningPrompt, scopedWritingPrompt, scopedPlanningAdaptation, scopedWritingAdaptation } from "./scoped-prompts";
/* Source files are imported in full. Scenario/output adapters are separate from author material. */
export const legacyGenerationResources = {
  version: 4,
  sources: generationDocuments,
  planning: `依三段式核心及扩展要求，交付第一段、第二段、第三段的连续创作计划。每段都有情境回顾、人物塑造、走向比较、错误检查与衔接接口；不要合并成泛泛节拍表。人物塑造只到诉求与叙事方向，不写具体台词或演出定稿。接受时的安排是意图，实际结果才是经历；邀请不是已发生动作。无字数要求，不写正文、JSON或游戏命令。\n${avgPlanningDirection}`,
  writing: `将三段式规划落实为完整正文段落，承接药箱归来的本次实际结果；人物与世界依完整原文。台词与演出由正文模型创作。${avgWritingReminder}\n最终响应严格为 <planning>逐角色本音校正与语言协议</planning> 然后 <prose>完整故事自然段</prose>，两个区块都必须完整闭合，结尾不可省略 </prose>；区块之外不输出文字或围栏。旁白中文，每句台词严格为「日本語原文（中文翻译）」，译文放在同一对「」内部，不得只翻译第一句或仅输出日文。例：「おかえりなさい。（欢迎回来。）」仅示意格式，不是本场台词。交付前检查每句都有译文及最后的闭合标签，不输出检查过程。无字数要求。不新增玩家动作、台词、心理或数值结算。prose不含创作记录、大纲、JSON或游戏命令。`,
  formatting: "你只做段落JSON封装，draft是已经冻结的正文，不需要创作或规划。完整保留文字、标点（包括「」）与顺序，只能去掉行首显式说话者标签并调整排版空白。输出严格JSON，顶层恰有creationRecord（1至1200字符的简短封装检查）与lines（非空段落数组，防御上限256项，并非目标数量）。每项恰有speaker、emotion、text（每项防御上限12000字符）。按正文自然段封装；独立「」对白归elora，叙述、动作、未说出口的内心归narrator。若存在旁白／艾洛拉行首标签，按标签确定归属。speaker仅narrator/elora；情绪仅neutral smile joy sad angry surprised serious closed wry flustered displeased confident confused panicked，旁白固定neutral。不要代码围栏、奖励、选项或状态。feedback存在时依据同一draft、前次原文和错误修复，不能改写draft。",
};

export const generationSamples = ["cleared", "extracted"].map(outcome => ({
  sourceKind: "sample" as const, id: `medicine-case.${outcome}`, version: 1,
  title: outcome === "cleared" ? "完成巡路 · 药箱归来" : "侧门撤离 · 药箱归来",
  phase: 12, location: "洋馆 · 公共休息室", actorIds: ["kael", "elora"],
  selectedAction: "先记下位置，清出安全的路再取。", outcome: outcome as "cleared" | "extracted",
  facts: [
    { id: "sample.accepted", text: "玩家接受了替艾洛拉取回空药箱的委托。", knownBy: ["kael", "elora"] },
    { id: "sample.found", text: "本次已在委托地点找到并带回空药箱。", knownBy: ["kael", "elora"] },
    { id: "sample.returned", text: outcome === "cleared" ? "本次完成巡路并带回空药箱。" : "本次从侧门成功撤离并带回空药箱，是否全清未知。", knownBy: ["kael", "elora"] },
  ],
  memories: [],
}));

export const legacyBuiltinGenerationPreset = {
  name: "Kemini v3.1 · 原文保留／三段式规划",
  airp_planning_prefix: keminiPlanningPrefix,
  airp_source: keminiSource,
  prompts: [
    { identifier: "writing-prefix", name: "正文前置提示词（原文＋独立适配）", role: "system", content: keminiWritingPrefix },
    { identifier: "dialogueExamples", name: "口吻示例", role: "user", marker: true },
  ],
  prompt_order: [{ character_id: "airp-reviewed", order: ["writing-prefix", "dialogueExamples"].map(identifier => ({ identifier, enabled: true })) }],
};

export const v5GenerationResources = { ...legacyGenerationResources, version: 5, planning: creationPrompt, writing: editingPrompt, formatting: chineseFormattingPrompt };
export const v5BuiltinGenerationPreset = {
  name: "Kemini v3.1 · ICOT创作／编辑／中文封装 v5",
  airp_planning_prefix: "",
  airp_source: {...keminiSource, revision: "airp-kemini-3.1-v5-creation"},
  prompts: keminiCreationModules,
  prompt_order: [{character_id: "airp-creation-v5", order: keminiCreationModules.map(m => ({identifier: m.identifier, enabled: true}))}],
};

// Frozen v5 runs keep their old wire contract. New runs give expressions to the editor.
export const v6GenerationResources = {...v5GenerationResources, version: 6, writing: performedEditingPrompt, formatting: performedFormattingPrompt};
export const v6BuiltinGenerationPreset = {
  ...v5BuiltinGenerationPreset,
  name: "Kemini v3.1 · ICOT创作／文笔表情／中文封装 v6",
  airp_source: {...keminiSource, revision: "airp-kemini-3.1-v6-editor-performance"},
  prompt_order: [{character_id: "airp-creation-v6", order: keminiCreationModules.map(m => ({identifier: m.identifier, enabled: true}))}],
};

// v5/v6 remain frozen for replay. Only new runs use the corrected author ownership.
export const v7GenerationResources = {...v6GenerationResources, version: 7, sources: withSourceActivation(generationDocuments), planning: outlinePrompt, writing: authoredPerformancePrompt};
export const v7BuiltinGenerationPreset = {
  ...v5BuiltinGenerationPreset,
  name: "Kemini v3.1 · 三段式大纲／正文与表情／中文封装 v7",
  airp_source: {...keminiSource, revision: "airp-kemini-3.1-v7-outline-author"},
  prompt_order: [{character_id: "airp-outline-v7", order: keminiCreationModules.map(m => ({identifier: m.identifier, enabled: true}))}],
};

export const generationResources = {...v7GenerationResources, version: 8,
  writingTaskRole: "user" as const,
  planning: `${scopedPlanningAdaptation}\n${scopedPlanningPrompt}`, writing: `${scopedWritingAdaptation}\n${scopedWritingPrompt}`};
export const builtinGenerationPreset = {
  ...v7BuiltinGenerationPreset, name: "Kemini v3.1 · 规划／正文条目分离 v8",
  airp_source: {...keminiSource, revision: "airp-kemini-3.1-v8-scoped"}, prompts: scopedKeminiModules,
  prompt_order: [{character_id: "airp-scoped-v8", order: scopedKeminiModules.map(m => ({identifier: m.identifier, enabled: true}))}],
};
