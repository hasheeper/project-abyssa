import * as v from "../../game-core/contracts";
import { directorHash } from "../../game-core/session";
import { AIRP_TEXT_EMOTIONS } from "../airp/contracts";
import { LIMITS, type Message } from "../airp-generation/contracts";
import { compilePreset, createMacroCompiler } from "../airp-generation/preset";
import { readWritingOutput } from "../airp-generation/writing";
import { compileCreativeInput } from "../airp-generation/creative-input";
import { bilingualParagraphs, performedParagraphs, usesCreativeProtocol, usesPerformanceProtocol, validateCreativeStage } from "../airp-generation/creative-output";
import type { DirectorJob, DirectorMaterial, DirectorPreparedInput, DirectorSceneText } from "./contracts";

const legacyActorNames: Record<string, string> = {narrator: "旁白", elora: "艾洛拉", eustice: "尤斯缇丝", norma: "诺玛", kororo: "柯萝萝"};
export const directorActorNames: Record<string, string> = {...legacyActorNames, marietta: "玛丽埃塔", abyssa: "艾比希斯"};
export const directorOutput = (job: DirectorJob, stage: string) => job.attempts.find(a => a.stage === stage && a.status === "succeeded")?.output ?? "";
/** Layout-only tolerance for a closing quotation wrapped to its own line. Raw attempts stay intact. */
export const readDirectorWriting = (output: string, version: number) => readWritingOutput(output.replace(/）\r?\n[\t ]*」(?=[\t ]*(?:\r?\n|<\/prose>|$))/g, "）」"), version);
export const directorProse = (material: DirectorMaterial, job: DirectorJob) => readDirectorWriting(directorOutput(job, "writing"), material.resources.version).prose;

export function compileDirectorScene(material: DirectorMaterial, job: DirectorJob, stage: "planning" | "writing" | "formatting", formatRepair?: 1): DirectorPreparedInput {
  const c = job.scene;
  if (!c) v.invalid("director.scene", "Missing frozen scene context");
  const r = material.resources, messages: Message[] = [], outline = directorOutput(job, "planning");
  if (usesCreativeProtocol(r.version)) {
    const {card: _card, authorSource: _authorSource, ...editorContext} = c;
    return {...compileCreativeInput({stage, material, context: c, editorContext,
      history: JSON.stringify({previousReadText: c.previous, taskReports: c.taskReports, memories: c.memories, selected: c.selected}), playerName: c.playerName,
      actors: Object.fromEntries(c.actorIds.map(id => [id, directorActorNames[id]])), creation: outline,
      draft: stage === "formatting" ? directorProse(material, job) : "",
      feedback: formatRepair === 1 ? {previousInvalidOutput: job.attempts.filter(a => a.stage === stage && a.error === "invalid-output").at(-1)?.output, error: "只修复严格JSON封装和中文提取，不改写双语稿"} : null,
      selectedMemoryIds: c.memories.map(m => m.id)}), stage};
  }
  const push = (role: Message["role"], content: string) => messages.push({role, content});
  if (stage === "formatting") {
    push("system", `只封装冻结正文，不创作、不输出planning。严格JSON顶层仅creationRecord和lines；lines每项仅speaker/emotion/text。每个自然段一项，保持文字标点和顺序，只去掉显式行首角色标签。speaker只允许${["narrator", ...c.actorIds].join("/")}，标签映射${JSON.stringify(c.actorIds.some(id => !legacyActorNames[id]) ? directorActorNames : legacyActorNames)}。每句台词的日文和译文保留在同一项内。emotion只允许${AIRP_TEXT_EMOTIONS.join("/")}，旁白固定neutral。不得加入选项、数值或状态。`);
    push("system", '字段类型必须匹配：creationRecord是1～1200字的非空字符串，例如"按原文逐段封装"，不是对象、数组或null；lines是非空数组，每项的speaker、emotion、text都是字符串。只输出JSON对象，不加Markdown代码围栏。');
    // Opted into and frozen by the new attempt, never retroactively added to old input hashes.
    if (formatRepair === 1) push("system", '这是一次失败封装的显式修复。previousInvalidOutput已被严格校验拒绝，只是错误样本，不可直接照抄。重新依据draft逐段封装，不改写、删减或增加任何正文。检查每个JSON字符串都有成对的英文双引号，尤其最后一段text：中文收引号」不是JSON结束引号，后面仍必须有英文双引号。完整结构示例：{"creationRecord":"按原文逐段封装","lines":[{"speaker":"narrator","emotion":"neutral","text":"原文"}]}。同时检查说话者、emotion枚举和自然段数量；仅返回修复后的完整JSON。');
    push("user", JSON.stringify({draft: directorProse(material, job), previousInvalidOutput: job.attempts.filter(a => a.stage === stage && a.error === "invalid-output").at(-1)?.output ?? null}));
  } else {
    const history = JSON.stringify({previousReadText: c.previous, taskReports: c.taskReports, memories: c.memories, selected: c.selected});
    const documents = (kind: typeof r.sources[number]["kind"]) => r.sources.filter(s => s.kind === kind).map(s => s.text).join("\n\n");
    const values = {user: c.playerName, char: c.actorIds.map(id => directorActorNames[id] ?? id).join("、"), description: documents("character"), personality: "", persona: documents("player"), scenario: JSON.stringify(c), world: documents("world"), examples: "",
      history, facts: JSON.stringify(c.facts), agenda: c.intent, bond: JSON.stringify(c.memories), locus: `${c.locationId}/${c.phase}`, memories: JSON.stringify(c.memories), outline, task: c.intent};
    push("system", "本次是游戏当前步骤的一场，不是整件事件。card是未来流程骨架，只有facts、已读原文和selected是已发生证据。禁止跨玩家选择代办后续。原卡与世界书保持全文；作者全知设定不是角色共同知情。只演出本场actorIds，不补写玩家台词、动作或心理，不发奖励。大纲只管叙事规划，正文负责台词。输入标签不要求照抄输出。");
    if (c.taskReports.length) push("system", "taskReports是玩家参与当前传话任务后携带的已读请求／答复原文，来源人物和阅读证据均已标注。本场对象可以在本次会面确认这些任务信息；不能写成对方此前在场或早已知道，不能借此获得其他私人记忆。保持答复原意，不杜撰玩家转述台词，不把未来任务结果写成已发生。");
    if (stage === "planning" && material.preset.planningPrefix) push("system", createMacroCompiler(values)(material.preset.planningPrefix));
    push("user", `<interactive_input>\n${JSON.stringify(c)}\n</interactive_input>`);
    for (const s of r.sources) push("user", `【完整作者资料：${s.path}】\n${s.text}`);
    push("user", `<Interaction_history>\n${history}\n</Interaction_history>`);
    if (stage === "planning") push("user", `${r.planning}\n本场范围：${c.intent}。保持既定三段式，不提前代办下一步骤。`);
    else {
      if (!outline.trim()) v.invalid("director.planning", "Missing saved outline");
      messages.push(...compilePreset(material.preset, material.orderId, values).messages);
      // Scenario-only adapter. Author source, three-part planning and literary preset remain byte-for-byte intact.
      const writing = r.writing.replace("承接药箱归来的本次实际结果", "承接当前步骤已有的实际事实与选择");
      push("user", `<scene_plan>\n${outline}\n</scene_plan>\n${writing}\n本場范围：${c.intent}。prose每个自然段须显式标注行首说话者；允许的标签为${["narrator", ...c.actorIds].map(id => directorActorNames[id]).join("／")}，格式如“角色名：正文”。这只是多人物归属标记，不改变双语或文学要求。只交付当前场景，在待选动作之前停下。`);
    }
  }
  const bytes = messages.reduce((sum, m) => sum + v.utf8Size(m.content), 0);
  if (bytes > LIMITS.inputBytes) v.invalid("director.input", "Input capacity exceeded; author text was not truncated", "airp-capacity");
  return {stage, messages, bytes, contextHash: directorHash(c), selectedMemoryIds: c.memories.map(m => m.id), diagnostics: [`当前场景${c.sceneId}／${c.role}`, "完整作者资料，前序仅已读原文；无未来分支代办"]};
}

function paragraphs(prose: string, actorIds: string[]) {
  return prose.split(/\r?\n/).filter(s => s.trim()).map(line => {
    const match = /^\s*([^：:]+)[：:]\s*(.+)$/.exec(line);
    const speaker = match && ["narrator", ...actorIds].find(id => match[1] === directorActorNames[id] || match[1] === id);
    if (!match || !speaker) v.invalid("director.prose", "Every paragraph needs an unambiguous authorized speaker label");
    if (speaker !== "narrator" && !/^「[^「」\r\n]+（[^「」\r\n]+）」$/.test(match[2].trim())) v.invalid("director.prose", "Dialogue requires Japanese and Chinese in the same quotation");
    return {speaker, text: match[2].trim()};
  });
}
export function validateDirectorWriting(output: string, material: DirectorMaterial, job: DirectorJob) {
  if (usesCreativeProtocol(material.resources.version)) return validateCreativeStage("writing", output.replace(/）\r?\n[\t ]*」/g, "）」"), directorOutput(job, "planning"), Object.fromEntries(job.scene!.actorIds.map(id => [id, directorActorNames[id]])), material.resources.version);
  const prose = readDirectorWriting(output, material.resources.version).prose;
  if (!paragraphs(prose, job.scene!.actorIds).length) v.invalid("director.prose", "Empty scene");
}
export function acceptDirectorText(raw: string, draft: string, actorIds: string[], version = 4): DirectorSceneText {
  const actors = Object.fromEntries(actorIds.map(id => [id, directorActorNames[id]]));
  const performance = usesPerformanceProtocol(version) ? performedParagraphs(draft, actors) : null;
  const r = v.record(JSON.parse(raw), "scene", ["creationRecord", "lines"]), expected = usesCreativeProtocol(version)
    ? (performance ?? bilingualParagraphs(draft, actors)).map(p => ({speaker: p.speaker, text: p.chinese})) : paragraphs(draft, actorIds);
  const lines = v.list(r.lines, "lines", 256).map((raw, index) => {
    const l = v.record(raw, "line", ["speaker", "emotion", "text"]);
    const speaker = v.choice(l.speaker, ["narrator", ...actorIds], "speaker"), emotion = v.choice(l.emotion, AIRP_TEXT_EMOTIONS, "emotion"), text = v.text(l.text, "text", 12000);
    if (speaker === "narrator" && emotion !== "neutral" || speaker !== expected[index]?.speaker || text.replace(/\s/gu, "") !== expected[index]?.text.replace(/\s/gu, "")) v.invalid("director.format", "Speaker or verbatim paragraph differs");
    if (performance && emotion !== performance[index]?.emotion) v.invalid("director.format", "Expression differs from literary editor output");
    return {speaker, emotion, text};
  });
  if (!lines.length || lines.length !== expected.length) v.invalid("director.format", "Paragraphs cannot be combined or omitted");
  return {creationRecord: v.text(r.creationRecord, "creationRecord", 1200), lines};
}
