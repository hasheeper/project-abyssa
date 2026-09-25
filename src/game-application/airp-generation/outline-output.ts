import { bytes, check, LIMITS } from "./contracts";

export const OUTLINE_PREFLIGHT = '<scene_plan><part id="1">承接本次输入。</part><part id="2">推进眼前问题。</part><part id="3">停在本步收束处。</part></scene_plan>';

/** v7 carries three planning sections, never three prewritten story bodies. */
export function readScenePlan(output: string): string {
  check(bytes(output) <= LIMITS.responseBytes, "大纲响应超过容量，未截断原文。", "invalid-writing");
  const match = /^\s*<scene_plan>\s*<part id="1">([^<>]+)<\/part>\s*<part id="2">([^<>]+)<\/part>\s*<part id="3">([^<>]+)<\/part>\s*<\/scene_plan>\s*$/.exec(output);
  check(match && match.slice(1).every(part => part.trim()), "大纲须为scene_plan内按顺序排列的三个非空part，不交错正文。", "invalid-writing");
  // Catch explicit dialogue/body syntax. This is not a semantic guarantee about prose.
  check(!/[「」『』]|^\s*(?:旁白|narrator|[^\s：:]+\[[a-z]+\])[：:]/m.test(match.slice(1).join("\n")), "大纲不得包含具体台词或正文演出标签，交给正文模型创作。", "invalid-writing");
  return output.trim();
}
