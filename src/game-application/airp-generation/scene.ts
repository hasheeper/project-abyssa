import { AIRP_TEXT_EMOTIONS, type AirpSceneText } from "../airp/contracts";
import { bytes, check, GenerationError, LIMITS } from "./contracts";
import * as v from "../../game-core/contracts";
import { bilingualParagraphs, performedParagraphs, usesCreativeProtocol, usesPerformanceProtocol } from "./creative-output";

/** Static preview's larger defensive bounds do not alter the external AIRP save protocol. */
function parsePreviewText(raw: unknown): AirpSceneText {
  v.assertJson(raw);
  const r = v.record(raw, "text", ["creationRecord", "lines"]);
  const lines = v.list(r.lines, "lines", 256).map(raw => {
    const l = v.record(raw, "line", ["speaker", "emotion", "text"]);
    const speaker = v.choice(l.speaker, ["narrator", "elora"], "speaker"), emotion = v.choice(l.emotion, AIRP_TEXT_EMOTIONS, "emotion");
    check(speaker !== "narrator" || emotion === "neutral", "旁白须为neutral", "invalid-scene");
    return { speaker, emotion, text: v.text(l.text, "text", 12000) };
  });
  check(lines.length > 0, "段落不能为空", "invalid-scene");
  return { creationRecord: v.text(r.creationRecord, "creationRecord", 1200), lines };
}

const normalized = (text: string) => text.replace(/\s/gu, "");
export function acceptGeneratedText(raw: string, draft: string, version = 4): AirpSceneText {
  check(bytes(raw) <= LIMITS.responseBytes, "格式化结果超过2 MiB防御上限，未截断正文。", "invalid-scene");
  let json: unknown; try { json = JSON.parse(raw); } catch { throw new GenerationError("invalid-scene", "输出不是严格 JSON，请返回完整对象且不含代码围栏。"); }
  let scene: AirpSceneText;
  try { scene = parsePreviewText(json); } catch { throw new GenerationError("invalid-scene", "JSON字段、非空文本、长度、说话者或14情绪不符合规范；旁白须为neutral。"); }
  check(scene.creationRecord.trim() && scene.lines.every(line => line.text.trim()), "创作记录与正文行不可为空白。", "invalid-scene");
  if (usesCreativeProtocol(version)) {
    const expected = usesPerformanceProtocol(version) ? performedParagraphs(draft) : bilingualParagraphs(draft);
    check(scene.lines.length === expected.length, "中文封装不得合并或遗漏自然段。", "invalid-scene");
    expected.forEach((p, i) => check(scene.lines[i].speaker === p.speaker && normalized(scene.lines[i].text) === normalized(p.chinese), "中文提取或说话者不符；不能保留日文、重译或改写。", "invalid-scene"));
    if (usesPerformanceProtocol(version)) performedParagraphs(draft).forEach((p, i) => check(scene.lines[i].emotion === p.emotion, "表情与文笔模型终稿不符，格式化不得重新判断。", "invalid-scene"));
    return scene;
  }
  const text = draft.replace(/^(?:[\t ]*)(?:旁白|艾洛拉)[:：][\t ]*/gm, "");
  check(normalized(text) === normalized(scene.lines.map(line => line.text).join("\n")), "正文保真检查失败：只能去掉行首角色标签与排版空白，文字、标点和顺序必须相同。", "invalid-scene");
  const paragraphs = draft.split(/\r?\n/).filter(line => line.trim());
  const tagged = paragraphs.map(line => /^[\t ]*(旁白|艾洛拉)[:：][\t ]*(.*)$/.exec(line));
  if (tagged.every(Boolean)) {
    const spans = tagged.map(match => ({ speaker: match![1] === "旁白" ? "narrator" : "elora", remaining: normalized(match![2]).length })).filter(span => span.remaining > 0);
    let cursor = 0;
    for (const line of scene.lines) {
      let remaining = normalized(line.text).length;
      while (remaining > 0) {
        const span = spans[cursor];
        check(span?.speaker === line.speaker, "说话者保真检查失败：不能把旁白与角色台词互换。", "invalid-scene");
        const used = Math.min(remaining, span.remaining); remaining -= used; span.remaining -= used;
        if (!span.remaining) cursor++;
      }
    }
  } else {
    check(scene.lines.length === paragraphs.length, "段落保真检查失败：每个正文自然段对应一个JSON段，不得合并或遗漏。", "invalid-scene");
    paragraphs.forEach((paragraph, index) => {
      const tag = tagged[index], text = tag ? tag[2] : paragraph;
      const speaker = tag ? tag[1] === "旁白" ? "narrator" : "elora" : /^「[\s\S]*」$/.test(paragraph.trim()) ? "elora" : "narrator";
      check(normalized(scene.lines[index].text) === normalized(text), "段落文字或顺序不一致。", "invalid-scene");
      check(scene.lines[index].speaker === speaker, "说话者保真检查失败：独立对白归艾洛拉，叙述与内心归旁白。", "invalid-scene");
    });
  }
  return scene;
}
