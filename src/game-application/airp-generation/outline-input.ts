import { bytes, check, hash, LIMITS, type CompiledInput, type CreativeInput, type Message } from "./contracts";
import { defaultActorNames, performedParagraphs } from "./creative-output";
import { readScenePlan } from "./outline-output";
import { compilePreset, createMacroCompiler } from "./preset";
import { selectSceneSources } from "./source-selection";

const block = (name: string, text: string) => `<${name}>\n${text}\n</${name}>`;
const policy = `本任务只生成当前步骤的AVG场景，不修改游戏状态。interactive_input是本次冻结情境，info为完整作者资料，Interaction_history/interaction_history为已读历史；示例、scene_plan和card未来流程骨架不是已发生证据。只演出本场演员；作者全知不等于人物知情，事实与未知用于核对，不要求逐项讲成对白。不替玩家补台词、动作、表情、眼神或心理，不发奖励，不跨未选分支代办后续。NPC可以有自己的当下举动、想法和提议，提议不等于玩家已同意。
taskReports若存在，是本次会面由玩家任务带来的已读请求／答复原文，不代表对方此前在场或早已知道，不杜撰玩家转述台词。playerName是本场玩家称呼，原卡默认名不覆盖它；无已批准日文名时可省略称呼，不自行音译。所选预设按模块顺序注入；末尾独立阶段适配确定职责和输出容器，不改写作者原文。`;

/** Sol plans; Gemini authors with full onstage cards and activated world documents. */
export function compileOutlinedInput(input: CreativeInput): CompiledInput {
  const {stage, material, context, history, playerName, creation = "", draft = "", feedback = null, selectedMemoryIds} = input;
  const r = material.resources, actors = input.actors ?? defaultActorNames, names = {narrator: "旁白", ...actors};
  const selected = stage === "formatting" ? {full: [], briefs: [], diagnostics: []} : selectSceneSources(r.sources, actors, context, history);
  const scoped = r.version === 8, planningOnly = scoped && stage === "planning";
  const messages: Message[] = [], diagnostics: string[] = selected.diagnostics.map(d => planningOnly && d.startsWith("voice-guide：") ? "voice-guide：正文专属，规划不加载" : d);
  const sources = selected.full.filter(s => !planningOnly || s.id !== "voice-guide");
  const push = (role: Message["role"], content: string) => messages.push({role, content});
  for (const id of Object.keys(actors)) check(r.sources.some(s => s.kind === "character" && s.id === id), `缺少在场角色${id}的完整卡。`);
  if (stage === "formatting") {
    check(draft.trim(), "中文封装需要正文模型已完成的双语终稿。");
    push("system", r.formatting);
    push("system", `本场speaker名称表：${JSON.stringify(names)}。只允许上述ID。`);
    push("user", JSON.stringify({draft, feedback, paragraphMap: performedParagraphs(draft, actors).map((p, index) => ({index, speaker: p.speaker, emotion: p.emotion}))}));
  } else {
    const outline = stage === "writing" ? readScenePlan(creation) : "";
    const documents = (kind: typeof r.sources[number]["kind"]) => sources.filter(s => s.kind === kind).map(s => s.text).join("\n\n");
    const values = {user: playerName, char: Object.values(actors).join("、"), description: documents("character"), personality: "", persona: documents("player"), scenario: JSON.stringify(context), world: documents("world"), examples: "", history,
      facts: JSON.stringify(context), agenda: JSON.stringify(context), bond: history, locus: JSON.stringify(context), memories: history, outline, task: "当前步骤的AVG场景",
      思考内容: "{{思考内容}}", 正文内容: "{{正文内容}}", 可能要求的附加内容: ""};
    push("system", scoped ? policy.replace("所选预设按模块顺序注入；末尾独立阶段适配确定职责和输出容器，不改写作者原文。", "所选预设按显式阶段归属路由原文片段，资料与执行指令分开；只有本阶段的输出协议生效，不改写作者原文。") : policy);
    if (stage === "planning" && material.preset.planningPrefix.trim()) push("system", createMacroCompiler(values)(material.preset.planningPrefix));
    const preset = compilePreset(material.preset, material.orderId, values, scoped ? stage : undefined);
    messages.push(...preset.messages); diagnostics.push(...preset.diagnostics);
    push("user", block("interactive_input", JSON.stringify(context)));
    push("user", block("info", sources.map(s => `【完整作者资料：${s.path}；用途：${s.kind}】\n${s.text}`).join("\n\n")));
    if (selected.briefs.length) push("user", block("offstage_characters", `以下为非在场角色的身份简稿，只供背景辨认，不表示在场、知情或本次行动；不能使用简稿代替出场角色卡。\n${selected.briefs.map(s => `【${s.id}；来源：${s.path}】\n${s.text}`).join("\n\n")}`));
    push("user", block("Interaction_history", block("interaction_history", history)));
    if (stage === "writing") push("user", outline);
    push("system", planningOnly ? `本场在场角色：${JSON.stringify(actors)}。玩家显示名：${playerName}；只规划NPC诉求与事件脉络，不安排玩家反应。` : `本场角色名称表：${JSON.stringify(names)}。正文每段标明归属，不标玩家为说话者；大纲不使用正文标签。玩家显示名：${playerName}。`);
    // Frozen opt-in: some compatible channels follow the final user task more reliably.
    // Original source-module roles and historical v7/v8 inputs remain unchanged.
    push(scoped && stage === "writing" ? r.writingTaskRole ?? "system" : "system", createMacroCompiler(values)(stage === "planning" ? r.planning : r.writing));
  }
  const size = messages.reduce((n, m) => n + bytes(m.content), 0);
  check(size <= LIMITS.inputBytes, "实际输入超过2 MiB防御上限，未截断任何原文。", "context-size");
  diagnostics.push(`v${r.version} ${stage}：全文${sources.length}份、非在场简稿${selected.briefs.length}份；触发原文未摘要／截断`, stage === "planning" ? "Sol仅交付三段式大纲；无正文或台词" : stage === "writing" ? scoped ? "Gemini接正文专属条目、在场原卡和触发世界书，不接活动ICOT；创作正文、台词和表情" : "Gemini接完整预设、在场角色卡和触发世界书，创作正文、台词和表情；无初稿段数限制" : "仅提取现有中文，逐段复制说话者和表情", `${size} UTF-8 bytes`);
  return {messages, bytes: size, diagnostics, contextHash: hash({context, sources: sources.map(s => ({id: s.id, sha256: s.sha256})), briefs: selected.briefs}), selectedMemoryIds};
}
