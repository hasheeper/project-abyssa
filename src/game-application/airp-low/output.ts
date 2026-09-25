import * as v from "../../game-core/contracts";
import { check } from "../airp-generation/contracts";
import { chineseDialogue, readCreationOutput } from "../airp-generation/creative-output";
import type { LowFormatVersion, LowFrame, LowRequest, LowText } from "./contracts";
import { lowHash, validateLowFrame } from "./native";
import { LOW_POSTPROCESS_INSTRUCTION, LOW_SPEAKER_FORMAT_INSTRUCTION, LOW_FIELD_REPAIR_INSTRUCTION } from "./prompt";
import { lowFieldCatalog, normalizeLowEmotion } from "./field-protocol";

/** Historical readers remain deterministic. New drafts belong to the formatter, not a literary regex gate. */
export function acceptLowDraft(raw: string, frame: LowFrame, readerVersion = frame.readerVersion ?? 1): { warnings: string[] } {
  if (readerVersion < 5) return readLowWriting(raw, frame, readerVersion);
  check(raw.trim(), "正文响应为空，无法交给后处理");
  try { return { warnings: readLowWriting(raw, frame, 4).warnings }; }
  catch (error) { return { warnings: [`交给后处理修整：${error instanceof Error ? error.message : String(error)}`] }; }
}

/** Extract existing Chinese only. Raw Plan/ICOT stays in the attempt, never in the AVG archive. */
export function readLowWriting(raw: string, frame: LowFrame, readerVersion = frame.readerVersion ?? 1): { prose: string; text: LowText; warnings: string[] } {
  const warnings: string[] = [];
  const match = /^\s*<planning>([\s\S]+?)<\/planning>\s*(<Interleaving>[\s\S]+<\/Interleaving>)\s*$/.exec(raw);
  let interleaving: string;
  if (match) {
    check(!/<\/?planning>/.test(match[1]), "Missing or nested native performance Plan"); interleaving = match[2];
  } else {
    // One complete leading Plan inside the outer wrapper is unambiguous. Do
    // not accept scattered/nested plans or drop text before/between blocks.
    const inside = readerVersion >= 3 && /^\s*<Interleaving>\s*<planning>([\s\S]+?)<\/planning>\s*([\s\S]+)<\/Interleaving>\s*$/.exec(raw);
    check(inside && !/<\/?(?:planning|Interleaving|thinking)\b/.test(inside[1]), "Missing or nested native performance Plan");
    interleaving = `<Interleaving>${inside[2]}</Interleaving>`; warnings.push("performance-plan-inside-wrapper");
  }
  const body = readCreationOutput(interleaving).prose, markers = [...body.matchAll(/^【可选回应】[\t ]*\r?$/gm)];
  check(markers.length === 1, "Exactly one response-options tail is required");
  const prose = body.slice(0, markers[0].index).trim(), tail = body.slice(markers[0].index! + markers[0][0].length).trim().split(/\r?\n/).map(s => s.trim()).filter(Boolean);
  check(tail.length === 3, "Exactly three attitude candidates are required");
  const alphabetic = readerVersion >= 4 && tail.every((line, i) => new RegExp(`^${"ABC"[i]}[.、．)）]\\s*\\S`).test(line));
  const choices = tail.map((line, i) => { const m = (alphabetic ? /^([ABC])[.、．)）]\s*(\S.*)$/ : /^(\d+)[.、．)）]\s*(\S.*)$/).exec(line); check(m && (alphabetic ? m[1] === "ABC"[i] : Number(m[1]) === i + 1) && !/[\u3040-\u30ff]/u.test(m[2]), "Invalid Chinese attitude option"); return m[2]; });
  if (alphabetic) warnings.push("alphabetic-response-markers");
  check(new Set(choices).size === 3, "Duplicate attitude candidates");
  const actors = [...frame.expressions.actors, { ...frame.expressions.player, specials: [] }];
  const lines = prose.split(/\r?\n\s*\r?\n/).filter(p => p.trim()).map((part, index) => {
    let paragraph = part.trim();
    if (readerVersion >= 4) {
      // The player uses a static portrait: a missing expression has no visual
      // choice to invent. Named NPCs still require an explicit allowed tag.
      const player = /^([^\r\n：:\[\]]+?)[\t ]*[：:][\t ]*(「[^\r\n]*」)$/.exec(paragraph);
      if (player && [frame.expressions.player.id, frame.expressions.player.name].includes(player[1].trim())) {
        paragraph = `${player[1]}[neutral]：${player[2]}`;
        warnings.push(`static-player-expression-default:${index}`);
      }
      // A single adjacent Japanese quote + Chinese parenthesis is lossless.
      // Do not infer translations or discard trailing prose/extra alternatives.
      const outside = /^([^\r\n：:\[\]]+?)\[([^\]\r\n]+)\][\t ]*[：:][\t ]*「([^「」\r\n（）]+)」[\t ]*（([^「」\r\n（）]+)）$/.exec(paragraph);
      if (outside && /[\u3040-\u30ff]/u.test(outside[3]) && /\p{Script=Han}/u.test(outside[4]) && !/[\u3040-\u30ff]/u.test(outside[4])) {
        paragraph = `${outside[1]}[${outside[2]}]：「${outside[3]}（${outside[4]}）」`;
        warnings.push(`translation-outside-dialogue-wrapper:${index}:${outside[1].trim()}`);
      }
    }
    const m = /^([^\r\n：:\[\]]+?)\[([^\]\r\n]+)\][\t ]*[：:][\t ]*(「[^\r\n]*」)$/.exec(paragraph);
    if (!m) {
      check(!/「|」|\[[^\r\n]*\]|[\u3040-\u30ff]|<\/?(?:planning|thinking|Interleaving)\b/u.test(paragraph), "Malformed dialogue/tag in narration");
      return { speaker: "narrator", emotion: "neutral", text: paragraph };
    }
    const actor = actors.find(a => a.id === m[1].trim() || a.name === m[1].trim());
    check(actor && (Object.hasOwn(frame.expressions.common, m[2]) || actor.specials.includes(m[2])), "Absent speaker or unauthorized expression");
    if (readerVersion >= 3 && /^「「[^「」]*」」$/.test(m[3])) {
      m[3] = m[3].slice(1, -1); warnings.push(`duplicate-dialogue-wrapper:${index}:${actor.id}`);
    }
    // r8 is a prose baseline, not a guaranteed bilingual protocol. Already-Chinese
    // dialogue is usable without inventing a translation, but the deviation is
    // exposed and archived. Japanese/mixed or ambiguous pairs still fail closed.
    if (!/[\u3040-\u30ff（）]/u.test(m[3]) && /\p{Script=Han}/u.test(m[3])) {
      warnings.push(`chinese-only-dialogue:${index}:${actor.id}`);
      return { speaker: actor.id, emotion: m[2], text: m[3] };
    }
    const reversed = readerVersion >= 2 && /^「([^（）]+)（([^（）]+)）」$/.exec(m[3]);
    if (reversed && !/[\u3040-\u30ff]/u.test(reversed[1]) && /\p{Script=Han}/u.test(reversed[1]) && /[\u3040-\u30ff]/u.test(reversed[2])) {
      warnings.push(`reversed-bilingual-dialogue:${index}:${actor.id}`);
      return { speaker: actor.id, emotion: m[2], text: `「${reversed[1]}」` };
    }
    return { speaker: actor.id, emotion: m[2], text: chineseDialogue(m[3]) };
  });
  check(lines.length > 0 && lines.length <= 256 && lines.some(l => l.speaker !== "narrator"), "Empty or excessive AVG scene");
  return { prose, text: { lines, choices }, warnings };
}
export function compileLowRequest(frame: LowFrame, writing?: string, readerVersion = frame.readerVersion ?? 1, formatVersion?: LowFormatVersion): LowRequest {
  validateLowFrame(frame);
  if (writing === undefined) return { stage: "writing", messages: frame.messages, sampling: frame.sampling, requestHash: frame.requestHash, ...(readerVersion >= 5 ? { acceptPartialDraft: true as const } : {}) };
  if (readerVersion >= 5) {
    acceptLowDraft(writing, frame, readerVersion);
    const instruction = (frame.readerVersion ?? 0) >= 5 ? frame.formatInstruction : LOW_POSTPROCESS_INSTRUCTION;
    const fieldInstruction = formatVersion === 2 ? LOW_FIELD_REPAIR_INSTRUCTION : formatVersion === 1 ? LOW_SPEAKER_FORMAT_INSTRUCTION : null;
    const messages = [{ role: "system" as const, content: instruction + (fieldInstruction ? `\n${fieldInstruction}` : "") }, { role: "user" as const, content: v.canonicalJson({ rawDraft: writing, expressions: frame.expressions, ...(formatVersion === 2 ? {fieldCatalog: lowFieldCatalog(frame.expressions)} : {}), ...(readerVersion === 6 ? {canonicalChinese: lowCanonicalChinese(writing, frame), ...(frame.scene.dialogue?.gmManaged ? {} : {stageContext: frame.scene.dialogue})} : {}) }) }];
    return { stage: "formatting", messages, requestHash: lowHash(messages) };
  }
  const body = readLowWriting(writing, frame, readerVersion), messages = [{ role: "system" as const, content: frame.formatInstruction }, { role: "user" as const, content: v.canonicalJson({ draft: body.prose, expressions: frame.expressions, expected: body.text }) }];
  return { stage: "formatting", messages, requestHash: lowHash(messages) };
}
export function acceptLowText(raw: string, writing: string, frame: LowFrame, readerVersion = frame.readerVersion ?? 1, formatVersion?: LowFormatVersion): LowText {
  if (readerVersion === 6) return readPostprocessedText(raw, frame, lowCanonicalChinese(writing, frame), !frame.scene.dialogue?.gmManaged, formatVersion, true);
  if (readerVersion >= 5) return readPostprocessedText(raw, frame, null, false, formatVersion);
  const r = v.record(v.parseJson(raw), "low.text", ["lines", "choices"]);
  const text = { lines: v.list(r.lines, "lines", 256).map(raw => { const l = v.record(raw, "line", ["speaker", "emotion", "text"]); return { speaker: v.text(l.speaker, "speaker", 100), emotion: v.text(l.emotion, "emotion", 100), text: v.text(l.text, "text", 12000) }; }), choices: v.list(r.choices, "choices", 3).map(c => v.text(c, "choice", 2000)) };
  check(lowHash(text) === lowHash(readLowWriting(writing, frame, readerVersion).text), "Formatter changed, omitted or merged frozen Chinese paragraphs/options"); return text;
}

export function lowCanonicalChinese(writing: string, frame: LowFrame): LowText["lines"] | null {
  try { return readLowWriting(writing, frame, 4).text.lines; } catch { return null; }
}
function readPostprocessedText(raw: string, frame: LowFrame, canonical: LowText["lines"] | null = null, interactive = false, formatVersion?: LowFormatVersion, reportFidelity = interactive): LowText {
  const json = raw.trim().replace(/^```(?:json)?\s*\n([\s\S]*?)\n```$/i, "$1");
  const value = v.record(v.parseJson(json), "后处理结果");
  if (typeof value.error === "string") check(false, `后处理报告：${value.error}`);
  const r = v.record(value, "后处理结果", ["lines", "choices", ...(interactive ? ["phase"] : [])], frame.scene.dialogue?.gmManaged ? ["phase"] : []);
  const p = interactive ? v.record(r.phase, "phase", ["complete", "reason"]) : null;
  const phase = p ? {complete: v.boolean(p.complete, "phase.complete"), reason: v.text(p.reason, "phase.reason", 2000)} : undefined;
  // The opening must actually offer a response before it can conclude. This is
  // not permission to accept or execute a task on behalf of the player.
  if (phase && frame.scene.dialogue?.role === "offer" && frame.scene.dialogue.turn === 0) phase.complete = false;
  const actors = [...frame.expressions.actors, { ...frame.expressions.player, specials: [] }];
  const formatWarnings: string[] = [];
  const lines = v.list(canonical ?? r.lines, "lines", 256).map((raw, index) => {
    const l = v.record(raw, `lines[${index}]`, ["speaker", "text"], ["emotion"]);
    const label = v.text(l.speaker, "speaker", 100);
    // Exact narrator aliases only: never turn an unknown/absent actor into narration.
    const speaker = formatVersion !== undefined && /^(?:旁白|narrator)$/i.test(label.trim()) ? "narrator" : label;
    const actor = actors.find(a => a.id === speaker || a.name === speaker);
    check(speaker === "narrator" || actor, `第${index + 1}段说话者不在本场角色目录：${speaker}`);
    const emotion = formatVersion === 2 ? normalizeLowEmotion(l.emotion, frame.expressions.common, actor?.specials ?? [], speaker === "narrator")
      : l.emotion === undefined ? "neutral" : v.text(l.emotion, "emotion", 100);
    if (formatVersion === 2 && l.emotion !== undefined && l.emotion !== emotion)
      formatWarnings.push(`第${index + 1}段表情标记已规范为 ${emotion}；正文未改动。`);
    check(emotion === "neutral" || speaker !== "narrator" && (Object.hasOwn(frame.expressions.common, emotion) || actor?.specials.includes(emotion)), `第${index + 1}段表情不在角色目录：${emotion}`);
    const text = v.text(l.text, "text", 12000);
    check(!/[\u3040-\u30ff]|<\/?(?:planning|thinking|Interleaving)\b/i.test(text), `第${index + 1}段仍含日文或创作标签`);
    return { speaker: actor?.id ?? speaker, emotion, text };
  });
  const choices = v.list(r.choices, "choices", 3).map(c => v.text(c, "choice", 2000));
  check(lines.length > 0, "后处理没有输出可播放段落");
  check((phase?.complete || choices.length === 3) && new Set(choices).size === choices.length && choices.every(c => !/[\u3040-\u30ff]|<\/?(?:planning|thinking|Interleaving)\b/i.test(c)), "未结束的对话须给出三个不同的中文态度选项");
  return { lines, choices: phase?.complete ? [] : choices, ...(phase ? {phase} : {}), ...(formatWarnings.length ? {formatWarnings} : {}), ...(reportFidelity ? {fidelity: {mode: canonical ? "canonical" as const : "model-extracted" as const, restored: !!canonical && lowHash(r.lines) !== lowHash(canonical)}} : {}) };
}
