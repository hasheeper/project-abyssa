import * as v from "../../game-core/contracts";
import { bytes, check, hash, LIMITS, type CompiledInput, type Message } from "../airp-generation/contracts";
import { compilePreset, createMacroCompiler } from "../airp-generation/preset";
import { readWritingOutput } from "../airp-generation/writing";
import type { DirectContext, DirectMaterial, DirectStage, DirectTask } from "./contracts";
import { updaterInput } from "./updater";
import { usesCreativeProtocol } from "../airp-generation/creative-output";
import { compileCreativeInput } from "../airp-generation/creative-input";

export const directOutput = (task: DirectTask, stage: DirectStage) => task.attempts.find(a => a.stage === stage && a.status === "succeeded")?.output ?? "";
export function directProse(material: DirectMaterial, task: DirectTask): string {
  const output = directOutput(task, "writing");
  return output ? readWritingOutput(output, material.resources.version).prose : "";
}
const block = (name: string, text: string) => `<${name}>\n${text}\n</${name}>`;
const policy = "本任务来自已验证的真实游戏存档，不是作者样例。所有作者资料保持全文；区分设定全知层与角色共同知情，角色卡中的示例不是本次已发生事实。固定关系以原卡为准，不增补关系数值。不新增玩家台词、心声、伤势、奖励、具体价格或任务结果。邀请不等于玩家接受或执行；原卡中的凯尔是玩家原名，显示名采用playerName，原卡不因此改写。标签仅组织输入，不要求XML输出或交错思考。interactive_input为冻结情境，info为完整资料，Interaction_history/interaction_history为已读历史，scene_plan为创作计划而非既往事实。";
export function compileDirectInput(material: DirectMaterial, context: DirectContext, task: DirectTask, stage: DirectStage, updater?: Parameters<typeof updaterInput>[0]): CompiledInput {
  check([1, 2].includes(material.version) && context.sourceKind === "gameplay" && context.version === 1, "不支持的游戏组装版本。");
  const messages: Message[] = [], diagnostics: string[] = [], r = material.resources;
  const push = (role: Message["role"], content: string) => messages.push({role, content});
  const previous = task.attempts.filter(a => a.stage === stage).at(-1);
  if (usesCreativeProtocol(r.version) && stage !== "updater") return compileCreativeInput({stage, material,
    context: {...context, goal: context.task === "return" ? "归来交接空药箱；交付尚未确认" : "交付已完成；承接已读前文推进下一件小事，不重新交付或结算",
      unknown: ["药箱状况与玩家身体状态未确立；接受时安排不能替代实际结果"], choices: []},
    history: JSON.stringify({memories: context.memories, parent: context.parent}), playerName: context.playerName,
    creation: directOutput(task, "planning"), draft: directProse(material, task),
    feedback: previous?.output ? {previousOutput: previous.output, error: "核对中文提取、严格JSON和逐段说话者，不修改双语终稿"} : null,
    selectedMemoryIds: context.memories.map(m => m.id)});
  if (stage === "updater") {
    check(updater, "整理记忆需要已读正文与程序派生的证据。");
    messages.push(...updaterInput(updater, material.version));
    if (previous?.output) push("user", `前次输出未通过结构校验；请完整重新封装，不新增事实。\n${previous.output}`);
  } else if (stage === "formatting") {
    const draft = directProse(material, task); check(draft.trim(), "缺少已保存的正文。");
    push("system", r.formatting);
    push("user", JSON.stringify({draft, feedback: previous?.output ? {previousOutput: previous.output, error: "严格JSON、每个自然段一段、原文保真，禁止增删文字或更换说话者。"} : null}));
  } else {
    const goal = context.task === "return" ? "归来交接空药箱；尚未确认交付。"
      : "药箱交接后的下一件小事：交付已经完成，不重复交付或重新结算。承接完整已读前文中的开放关心或后勤话题，推进一个新节拍，继续等待玩家回应；不把邀请写成玩家已执行。";
    const agenda = {goal, stance: context.stance, stanceScope: "接受时安排，不替代实际结果", outcome: context.proof.outcome, facts: context.facts, deterministicGameMemories: context.gameMemories.filter(m => m.axis === "agenda"),
      unknown: ["空箱的成色、完好与否、清洁程度、扣件和合页状态未提供", "玩家伤势、疲劳、具体巡路动作未提供", "修理、清洗、装药、治疗或接受邀请均不是已确认事实", ...(context.proof.outcome === "extracted" ? ["侧门撤离不等于全清或完成巡路"] : [])]};
    const bond = {deterministicGameMemories: context.gameMemories.filter(m => m.axis === "bond"), memories: context.memories, flags: context.flags, source: "关系以完整角色卡为准；游戏数值未提供。确定性委托记忆只证明任务结果，不能冒充已读对白摘要。"};
    const locus = {day: Math.floor(context.phase / 4) + 1, phase: ["晨", "昼", "昏", "夜"][context.phase % 4], location: context.location, actorIds: context.actorIds};
    const situation = {sourceKind: "gameplay", sourceHead: context.head, eventId: context.instanceId, playerName: context.playerName, task: context.task, agenda, bond, locus};
    const documents = (kind: typeof r.sources[number]["kind"]) => r.sources.filter(s => s.kind === kind).map(s => s.text).join("\n\n");
    const history = JSON.stringify({memories: context.memories, parent: context.parent});
    const outline = directOutput(task, "planning");
    const values = {user: context.playerName, char: "艾洛拉", description: documents("character"), personality: "", persona: documents("player"), scenario: JSON.stringify(situation), world: documents("world"), examples: "",
      history, facts: JSON.stringify(context.facts), agenda: JSON.stringify(agenda), bond: JSON.stringify(bond), locus: JSON.stringify(locus), memories: JSON.stringify(context.memories), outline, task: goal};
    push("system", r.version >= 4 ? policy.replace("标签仅组织输入，不要求XML输出或交错思考。", "输入标签不要求原样输出，不交错思考。大纲交付三段规划；正文按本阶段协议分开交付planning编辑记录与prose终稿，只有prose属于故事。") : policy);
    if (stage === "planning" && material.preset.planningPrefix.trim()) push("system", createMacroCompiler(values)(material.preset.planningPrefix));
    push("user", block("interactive_input", JSON.stringify(situation)));
    push("user", block("info", r.sources.map(s => `【完整原文资料：${s.path}；用途：${s.kind}】\n${s.text}`).join("\n\n")));
    push("user", block("Interaction_history", block("interaction_history", history)));
    if (stage === "planning") push("user", `${r.planning}\n\n本阶段任务适配：${goal}`);
    else {
      check(outline.trim(), "缺少已保存的大纲。");
      const preset = compilePreset(material.preset, material.orderId, values);
      messages.push(...preset.messages); diagnostics.push(...preset.diagnostics);
      push("user", `${block("scene_plan", outline)}\n\n本场事实复核：${JSON.stringify(agenda)}\n大纲是创作建议，不扩张已确认事实。\n${r.writing}\n\n本阶段任务适配：${goal}`);
    }
  }
  const size = messages.reduce((sum, m) => sum + bytes(m.content), 0);
  check(size <= LIMITS.inputBytes, "实际输入超过2 MiB防御上限，未截断任何原文。", "context-size");
  diagnostics.push(`真实游戏：${context.head.saveId}/${context.sceneId}/${context.task}`, `组装版本${material.version}；完整资料${stage === "planning" || stage === "writing" ? r.sources.length : 0}份`, `${size} UTF-8 bytes`);
  return {messages, bytes: size, diagnostics, contextHash: hash(context), selectedMemoryIds: context.memories.map(m => m.id)};
}

export function checkDirectInputHash(expected: string, input: CompiledInput) {
  if (hash(input) !== expected) v.invalid("direct.input", "Frozen input cannot be reconstructed; refusing to resume");
}
