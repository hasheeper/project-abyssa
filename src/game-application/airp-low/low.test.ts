import { describe, expect, it } from "vitest";
import { lowR8Source } from "../../content/presentation/airp/low-r8-source";
import { cloneLow, compileLowFrame, lowStrictMessages } from "./native";
import { acceptLowText, compileLowRequest, readLowWriting } from "./output";
import { mockNodeWriting } from "../testing/airp-node-fixture";

const scene = { id: "test-scene", actors: { elora: "艾洛拉" }, player: { id: "kael", name: "凯尔" }, scenario: "旧庄园入口的当前场景。", userInput: "玩家尚未决定下一步。" };
const frame = () => compileLowFrame(lowR8Source, scene);
describe("CL-D frozen r8 Low", () => {
  it("keeps full present cards, absent briefs, the native order and sampling", () => {
    const f = frame(); expect(f.trace).toHaveLength(34); expect(f.sources.find(s => s.id === "elora")?.text.length).toBe(4947);
    expect(f.briefs.map(s => s.id)).toEqual(expect.arrayContaining(["eustice", "norma", "kororo"]));
    expect(f.sources.some(s => s.id === "kororo")).toBe(false); expect(f.expressions.actors.map(a => a.id)).toEqual(["elora"]);
    expect(f.sampling).toEqual({ stream: true, temperature: 1, top_p: 1, max_tokens: 65535, frequency_penalty: 0, presence_penalty: 0, reasoning_effort: "low", n: 1 });
    expect(compileLowRequest(f).stage).toBe("writing"); expect(f.messages.map(m => m.role)).toEqual(["user", "assistant", "user"]);
  });
  it("fails rather than trimming missing/changed cards or altering r8", () => {
    const m = cloneLow(lowR8Source); m.sources = m.sources.filter(s => s.id !== "elora"); expect(() => compileLowFrame(m, scene)).toThrow();
    const changed = cloneLow(lowR8Source); changed.preset = changed.preset.replace("600", "601"); expect(() => compileLowFrame(changed, scene)).toThrow();
    const bad = cloneLow(lowR8Source); bad.sources.find(s => s.id === "elora")!.text += "changed"; expect(() => compileLowFrame(bad, scene)).toThrow();
  });
  it("extracts only existing Chinese, with expressions and three pending attitudes separate", () => {
    const f = frame(), raw = mockNodeWriting(), read = readLowWriting(raw, f);
    expect(read.text.lines).toHaveLength(4); expect(read.text.lines[1]).toEqual({ speaker: "elora", emotion: "serious", text: "「门就在前面，要走了吗？」" });
    expect(read.text.choices).toHaveLength(3); expect(JSON.stringify(read.text)).not.toMatch(/thinking|planning|行こう|Interleaving/);
    expect(acceptLowText(JSON.stringify(read.text), raw, f)).toEqual(read.text);
    const request = compileLowRequest(f, raw); expect(request.messages[1].content).not.toContain("测试用公开创作占位"); expect(request.messages[0].content).not.toContain("ICOT");
  });
  it.each(["absent", "emotion", "missing-translation", "changed-text", "merged-lines"])("rejects %s without rewriting", kind => {
    const f = frame(), raw = mockNodeWriting();
    if (kind === "absent") expect(() => readLowWriting(raw.replaceAll("艾洛拉", "诺玛"), f)).toThrow();
    else if (kind === "emotion") expect(() => readLowWriting(raw.replaceAll("[serious]", "[wink]"), f)).toThrow();
    else if (kind === "missing-translation") expect(() => readLowWriting(raw.replace("行こうか？（门就在前面，要走了吗？）", "行こうか？"), f)).toThrow();
    else { const value = readLowWriting(raw, f).text; if (kind === "changed-text") value.lines[0].text += "新编写"; else value.lines.splice(1, 1); expect(() => acceptLowText(JSON.stringify(value), raw, f)).toThrow(); }
  });
  it("merges adjacent native roles without changing text/order", () => {
    expect(lowStrictMessages([{ role: "user", content: "a" }, { role: "system", content: "b" }, { role: "assistant", content: "c" }, { role: "user", content: "d" }])).toEqual([{ role: "user", content: "a\n\nb" }, { role: "assistant", content: "c" }, { role: "user", content: "d" }]);
  });
  it("copies unambiguous existing Chinese but reports the missing Japanese without rewriting", () => {
    const raw = mockNodeWriting().replace("行こうか？（门就在前面，要走了吗？）", "门就在前面，要走了吗？");
    const result = readLowWriting(raw, frame()); expect(result.text.lines[1].text).toBe("「门就在前面，要走了吗？」");
    expect(result.warnings).toEqual(["chinese-only-dialogue:1:elora"]);
  });
  it("version 2 extracts an unambiguous reversed pair without translating or changing historical version 1", () => {
    const f = frame(), raw = mockNodeWriting().replace("行こうか？（门就在前面，要走了吗？）", "门就在前面，要走了吗？（行こうか？）");
    expect(() => readLowWriting(raw, f)).toThrow();
    const read = readLowWriting(raw, f, 2);
    expect(read.text.lines[1].text).toBe("「门就在前面，要走了吗？」");
    expect(read.warnings).toContain("reversed-bilingual-dialogue:1:elora");
    expect(acceptLowText(JSON.stringify(read.text), raw, f, 2)).toEqual(read.text);
    expect(() => readLowWriting(raw.replace("门就在前面，要走了吗？（行こうか？）", "そうだね（行こうか？）"), f, 2)).toThrow();
  });
  it("version 3 reads one leading Plan inside Interleaving, without dropping text or altering old readers", () => {
    const raw = mockNodeWriting(), inside = raw.replace(/^(<planning>[\s\S]*?<\/planning>)<Interleaving>/, "<Interleaving>$1");
    expect(() => readLowWriting(inside, frame(), 2)).toThrow(/Plan/);
    expect(readLowWriting(inside, frame(), 3).text).toEqual(readLowWriting(raw, frame(), 2).text);
    expect(readLowWriting(inside, frame(), 3).warnings).toContain("performance-plan-inside-wrapper");
    for (const bad of [inside.replace("<planning>", "前置正文。<planning>"), inside.replace("</planning>", "</planning>遗漏的正文。"), inside.replace("</planning>", "</planning><planning>重复</planning>"), inside.replace("<thinking>测试占位二。</thinking>", "")]) {
      expect(() => readLowWriting(bad, frame(), 3)).toThrow();
    }
  });
  it("version 3 unwraps only a redundant enclosing dialogue pair and preserves a quoted phrase inside", () => {
    const raw = mockNodeWriting().replace("行こうか？（门就在前面，要走了吗？）", "「门就在前面，要走了吗？」");
    expect(readLowWriting(raw, frame(), 2).text.lines[1].text).toBe("「「门就在前面，要走了吗？」」");
    const read = readLowWriting(raw, frame(), 3);
    expect(read.text.lines[1].text).toBe("「门就在前面，要走了吗？」");
    expect(read.warnings).toContain("duplicate-dialogue-wrapper:1:elora");
    const quoted = mockNodeWriting().replace("行こうか？（门就在前面，要走了吗？）", "你说的「门」就在前面。");
    expect(readLowWriting(quoted, frame(), 3).text.lines[1].text).toBe("「你说的「门」就在前面。」");
  });
  it("version 4 extracts an adjacent outside translation without dropping extra content or changing old readers", () => {
    const raw = mockNodeWriting().replace("「行こうか？（门就在前面，要走了吗？）」", "「行こうか？」（门就在前面，要走了吗？）");
    expect(() => readLowWriting(raw, frame(), 3)).toThrow(/Malformed dialogue/);
    const read = readLowWriting(raw, frame(), 4);
    expect(read.text).toEqual(readLowWriting(mockNodeWriting(), frame(), 3).text);
    expect(read.warnings).toContain("translation-outside-dialogue-wrapper:1:艾洛拉");
    expect(acceptLowText(JSON.stringify(read.text), raw, frame(), 4)).toEqual(read.text);
    for (const suffix of ["她站了起来。", "（另一个译法）", "日文かな"]) {
      expect(() => readLowWriting(raw.replace("（门就在前面，要走了吗？）", `（门就在前面，要走了吗？）${suffix}`), frame(), 4)).toThrow();
    }
    expect(() => readLowWriting(raw.replace("（门就在前面，要走了吗？）", "（行こうか？）"), frame(), 4)).toThrow();
  });
  it("version 4 tolerates complete A/B/C markers, never changes their order/text or accepts missing translations", () => {
    const raw = mockNodeWriting().replace(/([\n])([123])\./g, (_, prefix, n) => `${prefix}${"ABC"[Number(n) - 1]}.`);
    expect(() => readLowWriting(raw, frame(), 3)).toThrow(/attitude option/);
    expect(readLowWriting(raw, frame(), 4).text).toEqual(readLowWriting(mockNodeWriting(), frame(), 3).text);
    expect(readLowWriting(raw, frame(), 4).warnings).toContain("alphabetic-response-markers");
    expect(() => readLowWriting(raw.replace("B.", "2."), frame(), 4)).toThrow();
    expect(() => readLowWriting(raw.replace("（门就在前面，要走了吗？）", ""), frame(), 4)).toThrow();
  });
  it("version 4 only supplies neutral for the static player, never an NPC expression or translation", () => {
    const raw = mockNodeWriting().replace("艾洛拉[serious]", "kael");
    expect(() => readLowWriting(raw, frame(), 3)).toThrow();
    const read = readLowWriting(raw, frame(), 4);
    expect(read.text.lines[1]).toEqual({ speaker: "kael", emotion: "neutral", text: "「门就在前面，要走了吗？」" });
    expect(read.warnings).toContain("static-player-expression-default:1");
    expect(() => readLowWriting(raw.replace("kael：", "艾洛拉："), frame(), 4)).toThrow();
    expect(() => readLowWriting(raw.replace("（门就在前面，要走了吗？）", ""), frame(), 4)).toThrow();
  });
});
