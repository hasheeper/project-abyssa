import { bytes, check, hash, LIMITS, type CompiledInput, type CreativeInput, type Message } from "./contracts";
import { compilePreset, createMacroCompiler } from "./preset";
import { defaultActorNames, performedParagraphs, readCreationOutput, usesCreativeProtocol } from "./creative-output";
import { compileOutlinedInput } from "./outline-input";

const block = (name: string, text: string) => `<${name}>\n${text}\n</${name}>`;
const policy = `本任务只生成当前步骤的AVG文本，不修改游戏状态。场景信息提供本步范围、真实事实与玩家输入，完整作者资料规定人物和世界；已读历史才是前情，示例和未来流程不是已发生证据。作者全知与人物知情分开，不替玩家补台词、动作、表情、眼神、心理，不发奖励或代办后续。playerName是本次玩家显示名，原卡默认名不覆盖它。
interactive_input为程序场景信息；info为作者原文；Interaction_history/interaction_history为已读前文。事实与未知仅用于核对，不是要求逐项写进对白。文风示例不是本世界的新人物或历史。taskReports若存在，是本次会面由玩家任务带来的已读请求／答复原文，不代表对方以前在场或早已知道；不得杜撰玩家转述台词。
所选预设的模块顺序在创作阶段执行，输入标签不要求照抄。当前阶段最后的交付适配确定输出容器和中文提取规则，不是要求重写作者资料。`;

/** Versioned creative protocol shared by workbench, direct path and GM scenes. */
export function compileCreativeInput(input: CreativeInput): CompiledInput {
  if (input.material.resources.version === 7 || input.material.resources.version === 8) return compileOutlinedInput(input);
  const {stage, material, history, playerName, creation = "", draft = "", feedback = null, selectedMemoryIds} = input;
  const actors = input.actors ?? defaultActorNames, names = {narrator: "旁白", ...actors};
  const r = material.resources, messages: Message[] = [], diagnostics: string[] = [];
  check(usesCreativeProtocol(r.version), "创作编译器仅处理v5/v6资料。");
  const push = (role: Message["role"], content: string) => messages.push({role, content});
  const context = stage === "writing" ? input.editorContext ?? input.context : input.context;
  const sources = stage === "planning" ? r.sources : stage === "writing"
    ? r.sources.filter(s => s.kind === "character" && Object.hasOwn(actors, s.id) || s.kind === "player" || s.kind === "guideline") : [];
  for (const id of Object.keys(actors)) check(r.sources.some(s => s.kind === "character" && s.id === id), `缺少在场角色${id}的完整卡。`);
  const documents = (kind: typeof r.sources[number]["kind"]) => sources.filter(s => s.kind === kind).map(s => s.text).join("\n\n");
  const values = {user: playerName, char: Object.values(actors).join("、"), description: documents("character"), personality: "", persona: documents("player"), scenario: JSON.stringify(context), world: documents("world"), examples: "", history,
    facts: JSON.stringify(context), agenda: JSON.stringify(context), bond: history, locus: JSON.stringify(context), memories: history, outline: "", task: "当前步骤的AVG场景",
    思考内容: "{{思考内容}}", 正文内容: "{{正文内容}}", 可能要求的附加内容: ""};
  if (stage === "formatting") {
    check(draft.trim(), "中文封装需要已完成的双语终稿。");
    push("system", r.formatting);
    push("system", `本场speaker名称表：${JSON.stringify(names)}。只允许上述ID。`);
    push("user", JSON.stringify({draft, feedback, ...(r.version === 6 ? {
      paragraphMap: performedParagraphs(draft, actors).map((p, index) => ({index, speaker: p.speaker, emotion: p.emotion})),
    } : {})}));
  } else {
    push("system", policy);
    if (stage === "planning") {
      if (material.preset.planningPrefix.trim()) push("system", createMacroCompiler(values)(material.preset.planningPrefix));
      const preset = compilePreset(material.preset, material.orderId, values);
      messages.push(...preset.messages); diagnostics.push(...preset.diagnostics);
    }
    push("user", block("interactive_input", JSON.stringify(context)));
    push("user", block("info", sources.map(s => `【完整作者资料：${s.path}；用途：${s.kind}】\n${s.text}`).join("\n\n")));
    push("user", block("Interaction_history", block("interaction_history", history)));
    push("system", `本场正文标签名称表：${JSON.stringify(names)}。每个自然段须标明归属，不标玩家为说话者。玩家显示名：${playerName}。`);
    if (stage === "planning") push("user", createMacroCompiler(values)(r.planning));
    else {
      const prose = readCreationOutput(creation).prose;
      push("user", block("draft", prose));
      push("user", createMacroCompiler(values)(r.writing));
    }
  }
  const size = messages.reduce((n, m) => n + bytes(m.content), 0);
  check(size <= LIMITS.inputBytes, "实际输入超过2 MiB防御上限，未截断任何原文。", "context-size");
  diagnostics.push(`v${r.version} ${stage}：完整资料${sources.length}份，未摘要／截断`, stage === "planning" ? "所选预设按模块顺序在创作阶段执行；不是酒馆运行时复刻" : stage === "writing" ? "编辑只接初稿、在场原卡、文风与程序场景信息；不接创作记录／世界书／未来事件骨架" : "只提取现有中文译文，程序逐段核验", `${size} UTF-8 bytes`);
  if (r.version === 6) diagnostics.push("表情由文笔模型选定；封装逐段复制，程序校验，标记不展示");
  return {messages, bytes: size, diagnostics, contextHash: hash({context, sources: sources.map(s => ({id: s.id, sha256: s.sha256}))}), selectedMemoryIds};
}
