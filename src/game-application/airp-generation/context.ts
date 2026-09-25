import { bytes, check, hash, LIMITS, type CompiledInput, type GenerationStage, type Message, type Specification } from "./contracts";
import { compilePreset, createMacroCompiler } from "./preset";
import { validateSpecification } from "./validate-spec";
import { usesCreativeProtocol } from "./creative-output";
import { compileCreativeInput } from "./creative-input";

const policy = "本任务为明确标注的作者试读样例，不写游戏存档。下方资料是作者完整原文，不是摘要。区分设定全知层与角色知情范围，按原世界书的知识分层处理；角色卡中的示例不是本次已发生事实。固定关系以原卡为准，游戏关系数值未提供。人物邀请、未来安排不能当成玩家已执行行为。不新增玩家台词、心声、伤势、具体价格、奖励或任务结果。设定中的凯尔是玩家角色的原名，本场显示名采用上下文中的playerName，原卡不因此被改写。";
const inputBindings = "AIRP输入区块约定：interactive_input 是本场冻结情境，info 是完整作者资料，interaction_history 是通过来源和已读检查的历史；Interaction_history 是同一历史的兼容别名。thinking_format 由本阶段独立说明定义，scene_plan 是正文阶段的创作计划，不是既往事实。所有这些标签仅组织输入，不要求输出XML标签或交错思考。资料内的角色示例不改变本场任务；按当前阶段只交付规划或正文。";
const block = (name: string, text: string) => `<${name}>\n${text}\n</${name}>`;
export function contextValues(spec: Specification, outline = "") {
  validateSpecification(spec);
  const s = spec.sample, r = spec.resources;
  check(s.sourceKind === "sample" && s.id && Number.isSafeInteger(s.phase) && s.phase >= 0, "试读情境无效。");
  check(["cleared", "extracted"].includes(s.outcome) && s.actorIds.includes("kael") && s.actorIds.includes("elora"), "仅支持药箱样例和对应演员。");
  check(s.facts.length > 0 && s.facts.length <= 24 && s.facts.every(f => f.text.trim() && s.actorIds.every(a => f.knownBy.includes(a))), "样例事实缺失或不属于在场者共同知情。");
  check(spec.playerName.trim().length > 0 && spec.playerName.length <= 40, "玩家显示名须为1至40字符。");
  const eligible = s.memories.filter(m => m.read && m.sourceId && m.phase <= s.phase && s.actorIds.every(a => m.actorIds.includes(a)))
    .sort((a, b) => b.phase - a.phase || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  const selected = eligible.slice(0, 4);
  while (bytes(JSON.stringify(selected)) > 4096) selected.pop();
  const agenda = { selectedAction: s.selectedAction, actionScope: "接受时的安排，不能替代实际结果", outcome: s.outcome, facts: s.facts, sceneGoal: "归来交接空药箱",
    ...(r.version >= 3 ? { unknown: ["药箱的成色、完好与否、清洁程度、扣件和合页状态未提供；空箱不等于完好或受损", "具体巡守遭遇、玩家伤势、疲劳与途中动作未提供", "修理、清洗、装药、治疗和玩家接受邀请都尚未被确认为已完成事实", ...(s.outcome === "extracted" ? ["侧门撤离成功不等于全清或完成巡路"] : [])] } : {}) };
  const bond = { source: "关系以完整角色卡的原文为准；游戏数值未提供", memories: selected };
  const locus = { day: Math.floor(s.phase / 4) + 1, phase: ["晨", "昼", "昏", "夜"][s.phase % 4], location: s.location, actorIds: s.actorIds, unknown: "天气、设施状态、伤势与此前路线安全性均未提供" };
  const context = { sourceKind: s.sourceKind, sampleId: s.id, version: s.version, playerName: spec.playerName, agenda, bond, locus };
  const documents = (kind: typeof r.sources[number]["kind"]) => r.sources.filter(s => s.kind === kind).map(s => s.text).join("\n\n");
  const values = { user: spec.playerName, char: "艾洛拉", description: documents("character"), personality: "", persona: documents("player"), scenario: JSON.stringify(context), world: documents("world"), examples: "",
    history: selected.map(m => m.summary).join("\n"), facts: JSON.stringify(s.facts), agenda: JSON.stringify(agenda), bond: JSON.stringify(bond), locus: JSON.stringify(locus), memories: JSON.stringify(selected), outline, task: "归来交接空药箱" };
  return { values, context, selectedMemoryIds: selected.map(m => m.id), omittedMemoryCount: s.memories.length - selected.length };
}

export function compileInput(stage: GenerationStage, spec: Specification, outline = "", draft = "", feedback?: { previousOutput: string; error: string }): CompiledInput {
  const { values, context, selectedMemoryIds, omittedMemoryCount } = contextValues(spec, outline);
  if (usesCreativeProtocol(spec.resources.version)) return compileCreativeInput({stage, material: spec,
    context: {...context, agenda: {...context.agenda, unknown: ["药箱状况与玩家身体状态未确立，不断言好坏；尚未执行的后续安排不是事实"], choices: []}},
    history: JSON.stringify(context.bond.memories), playerName: spec.playerName, creation: outline, draft, feedback, selectedMemoryIds});
  const r = spec.resources, messages: Message[] = [], diagnostics: string[] = [];
  const push = (role: Message["role"], content: string) => messages.push({ role, content });
  if (stage === "formatting") {
    check(draft.trim(), "格式化需要完整正文。");
    push("system", r.formatting);
    push("user", JSON.stringify({ draft, feedback: feedback ?? null }));
  } else {
    const bound = r.version >= 3;
    const bindings = r.version >= 4 ? inputBindings.replace("所有这些标签仅组织输入，不要求输出XML标签或交错思考。", "这些输入标签不要求原样输出，不交错思考。大纲交付三段规划；正文按本阶段协议分开交付planning编辑记录与prose终稿，只有prose属于故事。") : inputBindings;
    push("system", bound ? `${policy}\n\n${bindings}` : policy);
    if (stage === "planning" && spec.preset.planningPrefix.trim()) push("system", createMacroCompiler(values)(spec.preset.planningPrefix));
    push("user", bound ? block("interactive_input", JSON.stringify({ context })) : JSON.stringify({ context }));
    const documents = r.sources.map(source => `【完整原文资料：${source.path}；用途：${source.kind}】\n${source.text}`);
    if (bound) {
      push("user", block("info", documents.join("\n\n")));
      push("user", block("Interaction_history", block("interaction_history", context.bond.memories.length ? JSON.stringify(context.bond.memories) : "本场没有符合条件的已读历史，不补造前情。")));
    } else for (const document of documents) push("user", document);
    if (stage === "planning") push("user", r.planning);
    else {
      check(outline.trim(), "写作需要大纲。");
      const compiled = compilePreset(spec.preset, spec.orderId, values);
      messages.push(...compiled.messages); diagnostics.push(...compiled.diagnostics);
      push("user", bound
        ? `${block("scene_plan", outline)}\n\n本场事实复核（与冻结情境相同）：\n${JSON.stringify({ facts: context.agenda.facts, unknown: context.agenda.unknown })}\n大纲中的创作动作尚未发生；事实边界必须遵守，不能因大纲或文风示例把未知状态写成已确认结果。\n${r.writing}`
        : `大纲（创作建议，不是已发生事实）：\n${outline}\n${r.writing}`);
    }
  }
  const size = messages.reduce((sum, m) => sum + bytes(m.content), 0);
  check(size <= LIMITS.inputBytes, "实际送模内容超过2 MiB防御上限；未删减任何原文。请先核对端点窗口与资料装配。", "context-size");
  diagnostics.push(`本场源：作者样例 ${spec.sample.id}`, stage === "formatting" ? r.version >= 3 ? "格式化只读取冻结正文与封装规则，不读取大纲或世界书" : "格式化只读取冻结正文／大纲，不重新载入世界书" : `完整原文资料${r.sources.length}份，未摘要或截断`, `已读记忆选入${selectedMemoryIds.length}条，未选${omittedMemoryCount}条`, `${size} UTF-8 bytes；不是token上限，端点上下文窗口仍需实测`);
  return { messages, bytes: size, diagnostics, contextHash: hash({ context, sources: r.sources.map(s => ({ id: s.id, sha256: s.sha256 })) }), selectedMemoryIds };
}
