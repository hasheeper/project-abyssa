import { bytes, check, LIMITS } from "./contracts";
import { AIRP_TEXT_EMOTIONS, type AirpTextEmotion } from "../airp/contracts";
import { OUTLINE_PREFLIGHT, readScenePlan } from "./outline-output";

export const defaultActorNames = {elora: "艾洛拉"};
export const usesOutlineProtocol = (version: number) => version === 7 || version === 8;
export const usesCreativeProtocol = (version: number) => version === 5 || version === 6 || usesOutlineProtocol(version);
export const usesPerformanceProtocol = (version: number) => version === 6 || usesOutlineProtocol(version);
export const CREATION_PREFLIGHT = `<Interleaving>${[1, 2, 3].map(i => `<thinking>预检记录${i}</thinking>\n旁白：预检占位${i}。\n`).join("")}</Interleaving>`;
export const planningPreflight = (version: number) => usesOutlineProtocol(version) ? OUTLINE_PREFLIGHT : usesCreativeProtocol(version) ? CREATION_PREFLIGHT : "（预检占位：实际运行时替换成成功大纲）";
const reserved = /<\/?(?:Interleaving|thinking|planning|prose)\b/i;

/** v5 only. Preserve the raw paid response; pass only the three authored bodies on. */
export function readCreationOutput(output: string) {
  check(bytes(output) <= LIMITS.responseBytes, "创作响应超过容量，未截断原文。", "invalid-writing");
  const outer = /^\s*<Interleaving>\s*([\s\S]*?)\s*<\/Interleaving>\s*$/.exec(output);
  check(outer, "创作响应需要完整的Interleaving区块。", "invalid-writing");
  const groups = [...outer[1].matchAll(/<thinking>([\s\S]*?)<\/thinking>([\s\S]*?)(?=<thinking>|$)/g)];
  check(groups.length === 3 && groups.map(g => g[0]).join("") === outer[1], "须保留三组创作记录与正文的原交错结构。", "invalid-writing");
  check(groups.every(g => g[1].trim() && g[2].trim() && !reserved.test(g[1]) && !reserved.test(g[2])), "三组记录与正文必须非空，不能嵌套或混入其他响应容器。", "invalid-writing");
  return {editorial: groups.map(g => g[1].trim()).join("\n\n"), prose: groups.map(g => g[2].trim()).join("\n\n")};
}

/** Locate the final balanced translation pair; keep parentheses inside Chinese intact. */
export function chineseDialogue(text: string): string {
  check(text.startsWith("「") && text.endsWith("）」"), "台词须包含日文和同一引号内的中文译文。", "invalid-writing");
  const body = text.slice(1, -1);
  let depth = 0, opening = -1;
  for (let i = body.length - 1; i >= 0; i--) {
    if (body[i] === "）") depth++;
    if (body[i] === "（" && --depth === 0) { opening = i; break; }
  }
  check(opening > 0 && body.slice(0, opening).trim() && body.slice(opening + 1, -1).trim(), "台词的原句与中文译文均不可缺失。", "invalid-writing");
  let prefixDepth = 0;
  for (const char of body.slice(0, opening)) {
    if (char === "（") prefixDepth++;
    if (char === "）") prefixDepth--;
    check(prefixDepth >= 0, "台词括号未配对，不能猜测译文边界。", "invalid-writing");
  }
  check(prefixDepth === 0, "台词括号未配对，不能猜测译文边界。", "invalid-writing");
  const chinese = body.slice(opening + 1, -1);
  check(!/[\u3040-\u30ff]/u.test(chinese), "中文译文仍含日文假名，请在编辑阶段完成中文稿。", "invalid-writing");
  return `「${chinese}」`;
}

export function bilingualParagraphs(prose: string, actors: Record<string, string> = defaultActorNames) {
  const names = {narrator: "旁白", ...actors};
  const paragraphs = prose.split(/\r?\n/).filter(p => p.trim()).map(line => {
    const match = /^\s*([^：:]+)[：:]\s*(.+)$/.exec(line);
    const speaker = match && Object.keys(names).find(id => match[1] === names[id as keyof typeof names] || match[1] === id);
    check(match && speaker, "每个中间稿自然段须使用本场合法说话者标签。", "invalid-writing");
    const text = match[2].trim();
    check(!reserved.test(text), "正文不能包含创作记录或协议区块。", "invalid-writing");
    if (speaker === "narrator") check(!/[\u3040-\u30ff]/u.test(text), "旁白应使用中文。", "invalid-writing");
    return {speaker, text, chinese: speaker === "narrator" ? text : chineseDialogue(text)};
  });
  check(paragraphs.length > 0, "正文不能为空。", "invalid-writing");
  return paragraphs;
}

export function readEditedOutput(output: string) {
  check(bytes(output) <= LIMITS.responseBytes, "编辑响应超过容量，未截断原文。", "invalid-writing");
  const match = /^\s*<prose>\s*([\s\S]*?)\s*<\/prose>\s*$/.exec(output);
  check(match && match[1].trim() && !reserved.test(match[1]), "编辑响应只能包含一个完整的prose正文区块。", "invalid-writing");
  return {editorial: null, prose: match[1]};
}

/** v6: the literary editor owns expressions; metadata never becomes displayed prose. */
export function performedParagraphs(prose: string, actors: Record<string, string> = defaultActorNames) {
  const names = {narrator: "旁白", ...actors};
  const annotated = prose.split(/\r?\n/).filter(line => line.trim()).map(line => {
    const match = /^\s*([^：:\[\]]+?)(?:\[([a-z]+)\])?[：:]\s*(.+)$/.exec(line);
    const speaker = match && Object.keys(names).find(id => match[1].trim() === id || match[1].trim() === names[id as keyof typeof names]);
    check(match && speaker, "终稿每段须有合法说话者与明确表情标记。", "invalid-writing");
    const emotion = speaker === "narrator" ? "neutral" : match[2];
    check(speaker !== "narrator" || !match[2], "旁白不标注角色表情，固定neutral。", "invalid-writing");
    check(AIRP_TEXT_EMOTIONS.includes(emotion as AirpTextEmotion), "角色对白缺少或使用了不支持的表情ID，不能替文笔模型猜测。", "invalid-writing");
    return {...bilingualParagraphs(`${speaker}：${match[3]}`, actors)[0], emotion: emotion as AirpTextEmotion};
  });
  check(annotated.length > 0, "终稿不能为空。", "invalid-writing");
  return annotated;
}

export function validateCreativeStage(stage: "planning" | "writing", output: string, creation: string, actors = defaultActorNames as Record<string, string>, version = 5) {
  check(usesCreativeProtocol(version), "不支持的创作协议版本。", "invalid-writing");
  if (usesOutlineProtocol(version)) {
    if (stage === "planning") return readScenePlan(output);
    readScenePlan(creation);
    const prose = readEditedOutput(output).prose;
    performedParagraphs(prose, actors);
    return prose;
  }
  const prose = stage === "planning" ? readCreationOutput(output).prose : readEditedOutput(output).prose;
  const paragraphs = version === 6 && stage === "writing" ? performedParagraphs(prose, actors) : bilingualParagraphs(prose, actors);
  // A structural guard, not a claim that semantic invention can be detected by count.
  if (stage === "writing") check(paragraphs.length <= bilingualParagraphs(readCreationOutput(creation).prose, actors).length,
    "编辑增加了阅读段落，请核对初稿与编辑稿。", "invalid-writing");
  return prose;
}
