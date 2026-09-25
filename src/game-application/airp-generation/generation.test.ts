import { describe, expect, it } from "vitest";
import { compileInput } from "./context";
import { createMacroCompiler, compilePreset, parsePreset } from "./preset";
import { acceptGeneratedText } from "./scene";
import { createRun, restoreRun } from "./run";
// Frozen v4 regression contract; current v5 coverage lives in creative-v5.test.ts.
import { legacyGenerationResources as generationResources, generationSamples, legacyBuiltinGenerationPreset as builtinGenerationPreset } from "../../content/presentation/airp/generation-resources";
import { type Specification, type Models } from "./contracts";
import { keminiOriginalModules, keminiPlanningChecklist } from "../../content/presentation/airp/kemini-profile";
import { writingPerformanceGuide } from "../../content/presentation/airp/writing-performance";
import { avgPlanningDirection, avgWritingFlow, avgWritingReminder } from "../../content/presentation/airp/avg-flow";

const spec = (): Specification => {
  const preset = parsePreset(JSON.stringify(builtinGenerationPreset));
  return { playerName: "林", sample: structuredClone(generationSamples[0]), resources: structuredClone(generationResources), preset, orderId: preset.orders[0].id };
};
const model = { baseUrl: "https://example.invalid/v1", model: "model", timeoutMs: 1000 };
const models: Models = { planning: model, writing: model, updater: model };
const draft = "旁白：箱子停在桌边。\n艾洛拉：回来就好。";
const scene = { creationRecord: "保留原文。", lines: [{ speaker: "narrator", emotion: "neutral", text: "箱子停在桌边。" }, { speaker: "elora", emotion: "smile", text: "回来就好。" }] };

describe("reviewed preset and limited template compiler", () => {
  it("handles trim and comments without interpreting comment bodies", () => {
    expect(createMacroCompiler({})("A \n{{trim}} \nB{{// ignore {{unknown}}}}C")).toBe("ABC");
  });
  it("expands only template macros, respects order and disabled assignments", () => {
    const preset = parsePreset(JSON.stringify({ prompts: [
      { identifier: "two", role: "assistant", content: "{{getvar::v}} / {{char}}" },
      { identifier: "off", content: "{{setvar::v::WRONG}}" },
      { identifier: "one", content: "{{setvar::v::你好{{user}}}}" },
    ], prompt_order: [{ character_id: 1, order: [{ identifier: "one", enabled: true }, { identifier: "off", enabled: false }, { identifier: "two", enabled: true }] }] }));
    expect(compilePreset(preset, "1", { user: "林", char: "{{getvar::secret}}" }).messages).toEqual([{ role: "assistant", content: "你好林 / {{getvar::secret}}" }]);
  });
  it.each(["{{getvar::missing}}", "{{random::a::b}}", "{{user", "{{not_supported}}"])("rejects unresolved template %s", template => {
    expect(() => createMacroCompiler({ user: "你" })(template)).toThrow();
  });
  it("bounds nesting, expansion and variable count", () => {
    expect(() => createMacroCompiler({})(Array.from({ length: 65 }, (_, i) => `{{setvar::v${i}::x}}`).join(""))).toThrow(/64/);
    expect(() => createMacroCompiler({ user: "长".repeat(800000) })("{{user}}")).toThrow(/2 MiB/);
    expect(() => createMacroCompiler({})("{{setvar::x::".repeat(10) + "x" + "}}".repeat(10))).toThrow(/8层/);
  });
  it("does not silently execute depth injections or unknown enabled markers", () => {
    const p = spec().preset;
    p.modules[0].unsupported.push("深度插入"); expect(() => compilePreset(p, p.orders[0].id, {})).toThrow(/深度插入/);
    p.modules[0].unsupported = []; p.modules[0].marker = true; expect(() => compilePreset(p, p.orders[0].id, {})).toThrow(/未知启用插槽/);
  });
  it.each(["missing", "duplicate"])("rejects %s order references", mode => {
    const raw = structuredClone(builtinGenerationPreset);
    if (mode === "missing") raw.prompt_order[0].order[0].identifier = "missing";
    else raw.prompt_order[0].order.push(raw.prompt_order[0].order[0]);
    expect(() => parsePreset(JSON.stringify(raw))).toThrow();
  });
  it("has distinct planning and writing prefixes without the raw interleaved format", () => {
    const s = spec(), planning = compileInput("planning", s), writing = compileInput("writing", s, "大纲样本"), formatting = compileInput("formatting", s, "大纲样本", draft);
    expect(planning.messages.some(m => m.content.includes("你负责大纲而非正文"))).toBe(true);
    for (const required of ["第一段、第二段、第三段", "分析前段的不足之处", "情景回顾", "回顾<char_guide>", "列出两者对比并取用后者", "出段状态与下一段接口"]) expect(planning.messages.some(m => m.content.includes(required))).toBe(true);
    expect(writing.messages.some(m => m.content.includes("你负责正文"))).toBe(true);
    const original = keminiOriginalModules.find(m => m.identifier === "fd9adcfd-bbbe-447e-8be6-4f1d87e50da7")!.content;
    expect(keminiPlanningChecklist).toBe(original.slice(original.indexOf("- 如果为"), original.indexOf("</thinking_format>")));
    expect(s.preset.planningPrefix).toContain(keminiPlanningChecklist);
    expect(s.preset.planningPrefix).not.toContain(writingPerformanceGuide);
    expect(s.preset.planningPrefix).toContain("不写具体台词、候选台词或台词定稿");
    expect(writing.messages.some(m => m.content.includes(writingPerformanceGuide))).toBe(true);
    for (const input of [planning, writing]) {
      const text = JSON.stringify(input.messages);
      expect(text).toContain("拒绝所有道德说教"); expect(text).toContain("减少 数/量词的使用"); expect(text).toContain("冬马和纱"); expect(text).not.toMatch(/<Interleaving>|ALL PREVIOUS PROMPT|1000字/);
    }
    expect(formatting.messages).toHaveLength(2);
    expect(JSON.stringify(formatting.messages)).not.toContain("拒绝所有道德说教"); expect(formatting.messages[1].content).not.toContain("大纲样本");
  });
  it("resolves the monologue-heavy preset at the writer boundary, without assigning performance to the planner or formatter", () => {
    const s = spec(), planning = compileInput("planning", s), writing = compileInput("writing", s, "三段规划"), formatting = compileInput("formatting", s, "三段规划", draft);
    const planText = planning.messages.map(m => m.content).join("\n"), writeText = writing.messages.map(m => m.content).join("\n");
    expect(s.preset.planningPrefix.includes(keminiPlanningChecklist)).toBe(true);
    // Only source macros expand; the surrounding original checklist text remains intact.
    for (const literal of keminiPlanningChecklist.split(/\{\{[^}]*\}\}/).filter(Boolean)) expect(planText.includes(literal)).toBe(true);
    expect(planText).toContain(avgPlanningDirection);
    expect(planText).not.toContain(avgWritingFlow);
    expect(planText).not.toContain(writingPerformanceGuide);
    const oldStyle = "通过角色的**大量**内心独白填充正文";
    expect(writeText).toContain(oldStyle); // Kept as original source, not silently rewritten.
    expect(writeText.indexOf(avgWritingFlow)).toBeGreaterThan(writeText.indexOf(oldStyle));
    expect(writeText.split(avgWritingFlow)).toHaveLength(2);
    expect(writing.messages.at(-1)?.content).toContain(avgWritingReminder);
    expect(writing.messages.at(-1)?.content).toContain("</prose>");
    const formatterText = JSON.stringify(formatting.messages);
    for (const instruction of [avgPlanningDirection, avgWritingFlow, avgWritingReminder]) expect(formatterText).not.toContain(instruction);
    expect(JSON.parse(formatting.messages[1].content)).toEqual({draft, feedback: null});
    expect(s.resources.version).toBe(4); // Prompt revision only; no new wire/save schema.
  });
});

describe("frozen, source-bounded context", () => {
  it("uses the same context hash and facts in planning/writing, not a world dump in formatting", () => {
    const s = spec(), a = compileInput("planning", s), b = compileInput("writing", s, "大纲"), c = compileInput("formatting", s, "大纲", draft);
    expect(a.contextHash).toBe(b.contextHash); expect(a.messages.find(m => m.role === "user")).toEqual(b.messages.find(m => m.role === "user"));
    for (const source of s.resources.sources) {
      expect(a.messages.some(m => m.content.includes(source.text))).toBe(true);
      expect(b.messages.some(m => m.content.includes(source.text))).toBe(true);
      expect(c.messages.some(m => m.content.includes(source.text))).toBe(false);
    }
    expect(a.selectedMemoryIds).toEqual([]);
  });
  it("defines each stage input block once, preserves the full checklist and keeps XML out of the formatter", () => {
    const s = spec();
    for (const stage of ["planning", "writing"] as const) {
      const input = compileInput(stage, s, "本次创作计划");
      const lines = input.messages.flatMap(m => m.content.split("\n"));
      for (const name of ["interactive_input", "info", "interaction_history", "Interaction_history", "thinking_format", ...(stage === "writing" ? ["scene_plan"] : [])]) {
        expect(lines.filter(l => l === `<${name}>`), name).toHaveLength(1);
        expect(lines.filter(l => l === `</${name}>`), name).toHaveLength(1);
      }
      expect(input.messages.some(m => m.content.includes("本场没有符合条件的已读历史"))).toBe(true);
      expect(JSON.stringify(input.messages)).not.toMatch(/<Interleaving>|<thinking>/);
    }
    expect(JSON.stringify(compileInput("formatting", s, "本次创作计划", draft).messages)).not.toMatch(/<thinking_format>|<info>|本次创作计划/);
  });
  it("projects the same explicit unknowns to planning and writing and distinguishes extracted from cleared", () => {
    const s = spec(); s.sample = structuredClone(generationSamples[1]);
    const a = compileInput("planning", s), b = compileInput("writing", s, "大纲");
    expect(a.contextHash).toBe(b.contextHash);
    for (const input of [a, b]) {
      const text = JSON.stringify(input.messages);
      expect(text).toContain("空箱不等于完好或受损");
      expect(text).toContain("侧门撤离成功不等于全清或完成巡路");
    }
    const cleared = compileInput("planning", spec());
    expect(cleared.contextHash).not.toBe(a.contextHash);
    expect(JSON.stringify(cleared.messages)).not.toContain("侧门撤离成功不等于全清或完成巡路");
  });
  it("retains the version-2 assembly for frozen records instead of silently replacing it", () => {
    const s = spec(); s.resources.version = 2;
    const input = compileInput("planning", s);
    expect(input.messages).toHaveLength(s.resources.sources.length + 4);
    const context = JSON.parse(input.messages[2].content).context;
    expect(context.agenda).not.toHaveProperty("unknown");
    for (const source of s.resources.sources) expect(input.messages.some(m => m.content.endsWith(source.text))).toBe(true);
    expect(input.messages.some(m => m.content.startsWith("<info>"))).toBe(false);
    const run = createRun("legacy", 1, s, models);
    expect(restoreRun(JSON.stringify(run)).spec.resources.version).toBe(2);
    s.resources.version = 9; expect(() => compileInput("planning", s)).toThrow(/版本/);
  });
  it("selects only read, sourced, common and past memories and reports omissions", () => {
    const s = spec(), memory = { id: "past", summary: "确已读过", sourceId: "sample.source", phase: 8, actorIds: ["kael", "elora"], read: true };
    s.sample.memories = [memory, { ...memory, id: "future", phase: 15 }, { ...memory, id: "unread", read: false }, { ...memory, id: "secret", actorIds: ["elora"] }, { ...memory, id: "unsourced", sourceId: "" }];
    const input = compileInput("planning", s); expect(input.selectedMemoryIds).toEqual(["past"]); expect(input.diagnostics.join(" ")).toContain("未选4条");
  });
  it("does not silently drop required facts when over budget", () => {
    const s = spec(); s.resources.sources[0].text += "意外删改";
    expect(() => compileInput("planning", s)).toThrow(/原文与摘要不符/);
  });
  it("rejects private facts, extra actors and unrecognized fields", () => {
    const s = spec(); s.sample.facts[0].knownBy = ["elora"];
    expect(() => compileInput("planning", s)).toThrow();
    s.sample.actorIds.push("unknown"); expect(() => compileInput("planning", s)).toThrow();
    expect(() => compileInput("planning", { ...spec(), apiKey: "not-a-valid-field" } as Specification)).toThrow();
  });
  it("freezes caller-owned specification and never autocompletes a restored running task", () => {
    const s = spec(), run = createRun("test", 100, s, models); s.playerName = "后来改名";
    expect(run.spec.playerName).toBe("林"); expect(restoreRun(JSON.stringify(run)).status).toBe("interrupted");
  });
  it("does not replace frozen custom prompts with the new AVG defaults on restore", () => {
    const old = spec(); old.preset.planningPrefix = "冻结旧大纲提示词";
    old.preset.modules[0].content = "冻结旧正文提示词";
    old.resources.planning = "冻结旧大纲任务"; old.resources.writing = "冻结旧正文任务";
    const run = createRun("frozen-prompts", 100, old, models);
    const restored = restoreRun(JSON.stringify(run));
    expect(restored.spec).toEqual(old);
    const input = compileInput("writing", restored.spec, "原任务的大纲");
    expect(input.messages.some(m => m.content === "冻结旧正文提示词")).toBe(true);
    expect(JSON.stringify(input.messages)).not.toContain(avgWritingFlow);
    expect(spec().resources.writing).toContain(avgWritingReminder);
  });
  it("rejects corrupted hashes and cache credentials even when recomputed from a clean model", () => {
    const run = createRun("test", 100, spec(), models);
    expect(() => restoreRun(JSON.stringify({ ...run, inputHash: "bad" }))).toThrow();
    (run.models.planning as any).apiKey = "must-not-restore";
    expect(() => restoreRun(JSON.stringify(run))).toThrow();
  });
});

describe("strict JSON and original-text preservation", () => {
  it("preserves unlabelled quoted dialogue and long paragraphs without the old short-scene cap", () => {
    const text = "「" + "回来就好。".repeat(160) + "」";
    const result = { creationRecord: "完整封装", lines: Array.from({ length: 40 }, () => ({ speaker: "elora", emotion: "neutral", text })) };
    expect(acceptGeneratedText(JSON.stringify(result), result.lines.map(l => l.text).join("\n\n"))).toEqual(result);
  });
  it("rejects merged natural paragraphs or a quotation assigned to narration", () => {
    const text = "箱子在桌边。\n\n「回来就好。」";
    expect(() => acceptGeneratedText(JSON.stringify({ creationRecord: "检查", lines: [{ speaker: "narrator", emotion: "neutral", text: "箱子在桌边。「回来就好。」" }] }), text)).toThrow(/段落/);
    expect(() => acceptGeneratedText(JSON.stringify({ creationRecord: "检查", lines: [{ speaker: "narrator", emotion: "neutral", text: "箱子在桌边。" }, { speaker: "narrator", emotion: "neutral", text: "「回来就好。」" }] }), text)).toThrow(/说话者/);
  });
  it("accepts known line-start labels and layout whitespace", () => {
    expect(acceptGeneratedText(JSON.stringify(scene), draft)).toEqual(scene);
    expect(acceptGeneratedText(JSON.stringify(scene), " 旁白: 箱子停在桌边。\n艾洛拉： 回来就好。 ")).toEqual(scene);
  });
  it.each(["omit", "reorder", "punctuation", "extra", "actor", "emotion", "narrator-emotion", "blank", "swapped-speaker"])("rejects %s", mode => {
    const bad: any = structuredClone(scene);
    if (mode === "omit") bad.lines.pop();
    if (mode === "reorder") bad.lines.reverse();
    if (mode === "punctuation") bad.lines[0].text = "箱子停在桌边！";
    if (mode === "extra") bad.reward = 10;
    if (mode === "actor") bad.lines[1].speaker = "kael";
    if (mode === "emotion") bad.lines[1].emotion = "happy";
    if (mode === "narrator-emotion") bad.lines[0].emotion = "smile";
    if (mode === "blank") bad.creationRecord = " ";
    if (mode === "swapped-speaker") bad.lines[0].speaker = "elora";
    expect(() => acceptGeneratedText(JSON.stringify(bad), draft)).toThrow();
  });
  it("rejects fenced output and mid-sentence label deletion", () => {
    expect(() => acceptGeneratedText("```json\n" + JSON.stringify(scene) + "\n```", draft)).toThrow();
    expect(() => acceptGeneratedText(JSON.stringify(scene), "请听旁白：箱子停在桌边。\n艾洛拉：回来就好。")).toThrow();
  });
});
