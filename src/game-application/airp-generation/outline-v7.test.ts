import { describe, expect, it } from "vitest";
import { defaultModels, resolveGenerationModels } from "../../game-runtime/airp-generation";
import { outlineSpecificationV7 as defaultSpecification } from "../testing/airp-outline-specification";
import { compileInput } from "./context";
import { compilePreset } from "./preset";
import { outlineV7, proseV7 } from "../testing/airp-outline-fixture";
import { readScenePlan } from "./outline-output";
import { performedParagraphs, validateCreativeStage } from "./creative-output";
import { acceptGeneratedText } from "./scene";
import { acceptDirectorText } from "../airp-director/scene";
import { createRun } from "./run";

describe("v7 Sol outline / Gemini authorship", () => {
  it("accepts only three complete planning sections, not old creative bodies", () => {
    expect(readScenePlan(outlineV7)).toBe(outlineV7);
    expect(validateCreativeStage("planning", outlineV7, "", undefined, 7)).toBe(outlineV7);
  });
  it.each([
    "三段大纲", outlineV7.replace('id="2"', 'id="1"'), outlineV7.replace('</scene_plan>', ''),
    outlineV7.replace('承接本步的玩家输入', '「好了。（好了。）」'),
    outlineV7.replace('承接本步的玩家输入', '\n旁白：正文。\n'),
    outlineV7.replace('承接本步的玩家输入', '<thinking>记录</thinking>'),
    `${outlineV7}\n艾洛拉：「你好。」`, outlineV7.replace(/<part id="2">.*?<\/part>/, '<part id="2"> </part>'),
  ])("rejects malformed or explicitly dramatized plans", raw => expect(() => readScenePlan(raw)).toThrow());
  it("lets Gemini write more than three paragraphs and never uses the editor count restriction", () => {
    expect(performedParagraphs(proseV7)).toHaveLength(6);
    expect(validateCreativeStage("writing", `<prose>${proseV7}</prose>`, outlineV7, undefined, 7)).toBe(proseV7);
    expect(() => validateCreativeStage("writing", `<prose>${proseV7.replace('[smile]', '')}</prose>`, outlineV7, undefined, 7)).toThrow(/表情/);
  });
  it("gives both models full onstage cards, activated world documents and original approved modules", () => {
    const spec = defaultSpecification(); expect(spec.resources.version).toBe(7);
    const preset = compilePreset(spec.preset, spec.orderId, {思考内容: '{{思考内容}}', 正文内容: '{{正文内容}}', 可能要求的附加内容: ''});
    for (const stage of ["planning", "writing"] as const) {
      const input = compileInput(stage, spec, outlineV7);
      for (const source of spec.resources.sources) expect(input.messages.some(m => m.content.includes(source.text))).toBe(source.kind !== 'world' || source.activation!.always);
      expect(input.messages.slice(1, 1 + preset.messages.length)).toEqual(preset.messages);
      expect(input.messages.at(-1)).toEqual({role: "system", content: spec.resources[stage]});
      expect(input.messages.some(m => m.content.startsWith('<draft>'))).toBe(false);
    }
    const writing = compileInput("writing", spec, outlineV7);
    expect(writing.messages.some(m => m.content === outlineV7)).toBe(true);
    expect(writing.messages.at(-1)!.content).not.toMatch(/不添加新事件、事实、动作|不增加阅读段落|只编辑这份作品/);
    expect(writing.messages.at(-1)!.content).toContain('三段规划已由Sol交付');
    expect(spec.resources.planning).toContain('不写具体或候选台词');
    expect(spec.resources.writing).toContain('段数也不受大纲段数限制');
  });
  it("routes preset sampling to Gemini without overwriting explicit settings", () => {
    const spec = defaultSpecification(), models = defaultModels(); spec.preset.sampling = {temperature: 0.75, top_p: 0.8};
    expect(resolveGenerationModels(models, spec.preset, 7).writing).toMatchObject({temperature: 0.75, top_p: 0.8});
    expect(resolveGenerationModels(models, spec.preset, 7).planning).toEqual(models.planning);
    models.writing.temperature = 0.6;
    expect(resolveGenerationModels(models, spec.preset, 7).writing.temperature).toBe(0.6);
  });
  it("preflights writer presets before any billable call", () => {
    const spec = defaultSpecification(); spec.preset.modules[0].content += '{{unsupported_v7_macro}}';
    expect(() => createRun('preflight', 1, spec, defaultModels())).toThrow();
  });
  it("sends only Chinese extraction material to formatter and preserves writer expressions in both acceptors", () => {
    const spec = defaultSpecification(), input = compileInput('formatting', spec, outlineV7, proseV7);
    expect(JSON.stringify(input.messages)).not.toContain(outlineV7);
    for (const source of spec.resources.sources) expect(input.messages.some(m => m.content.includes(source.text))).toBe(false);
    const paragraphs = performedParagraphs(proseV7);
    const expected = {creationRecord: '测试封装', lines: paragraphs.map(p => ({speaker: p.speaker, emotion: p.emotion, text: p.chinese}))};
    expect(JSON.parse(input.messages.at(-1)!.content).paragraphMap).toEqual(paragraphs.map((p, index) => ({index, speaker: p.speaker, emotion: p.emotion})));
    expect(acceptGeneratedText(JSON.stringify(expected), proseV7, 7)).toEqual(expected);
    expect(acceptDirectorText(JSON.stringify(expected), proseV7, ['elora'], 7)).toEqual(expected);
    expected.lines[1].emotion = 'neutral';
    expect(() => acceptGeneratedText(JSON.stringify(expected), proseV7, 7)).toThrow(/表情/);
    expect(() => acceptDirectorText(JSON.stringify(expected), proseV7, ['elora'], 7)).toThrow();
  });
});
