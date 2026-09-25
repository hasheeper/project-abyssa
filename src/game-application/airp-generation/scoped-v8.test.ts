import { describe, expect, it } from "vitest";
import { defaultSpecification, defaultModels, importPreset, builtinPresetFile } from "../../game-runtime/airp-generation";
import source from "../../content/presentation/airp/kemini-source.json";
import { keminiCreationModules } from "../../content/presentation/airp/kemini-profile";
import { scopedKeminiModules } from "../../content/presentation/airp/scoped-kemini";
import { compileInput } from "./context";
import { compilePreset, parsePreset } from "./preset";
import { createRun } from "./run";
import { sha256 } from "../../game-core/contracts";
import { outlineV7, proseV7 } from "../testing/airp-outline-fixture";
import { compileCreativeInput } from "./creative-input";
import { directorTestMaterial } from "../testing/airp-director-fixture";

describe("v8 source-preserving stage routing", () => {
  it("records exact source slices, original order, roles and macro dependencies", () => {
    let previous = -1;
    for (const fragment of scopedKeminiModules) {
      const origin = fragment.airp_origin, index = source.modules.findIndex(m => m.identifier === origin.moduleId), original = source.modules[index];
      expect(index).toBeGreaterThanOrEqual(previous); previous = index;
      expect(origin.sourceSha256).toBe(original.sha256);
      expect(fragment.content).toBe(origin.ranges.map(r => original.content.slice(r.start, r.end)).join(""));
      expect(origin.fragmentSha256).toBe(sha256(fragment.content));
      expect(fragment.role).toBe(keminiCreationModules.find(m => m.identifier === origin.moduleId)!.role);
      expect(origin.macros).toEqual([...new Set([...fragment.content.matchAll(/\{\{(?:getvar|setvar)::([^:}]+)/g)].map(m => m[1]))]);
    }
  });
  it("compiles two independent module sets, with no active competing output template", () => {
    const spec = defaultSpecification(); expect(spec.resources.version).toBe(8);
    const values = {思考内容: '{{思考内容}}', 正文内容: '{{正文内容}}', 可能要求的附加内容: ''};
    const planning = compilePreset(spec.preset, spec.orderId, values, "planning"), writing = compilePreset(spec.preset, spec.orderId, values, "writing");
    const p = planning.messages.map(m => m.content).join('\n'), w = writing.messages.map(m => m.content).join('\n');
    expect(p).toContain('错误'); expect(p).not.toMatch(/writing_techniques|日本語原文|<SETTING>|<writingstyle>/);
    expect(w).toContain('<writing_techniques>'); expect(w).toContain('<style>');
    expect(p + w).not.toMatch(/<\/?Interleaving>|<\/?thinking>|<\/?thinking_format>|不少于1000字|\{\{(?:getvar|setvar)::/);
    const reference = scopedKeminiModules.find(m => m.name.includes('完整文风参考'))!;
    expect(writing.messages).toContainEqual({role: reference.role, content: reference.content});
    expect(p).not.toContain(reference.content);
    for (const stage of ["planning", "writing"] as const) {
      const input = compileInput(stage, spec, outlineV7);
      const expected = stage === "planning" ? planning : writing;
      expect(input.messages.slice(1, 1 + expected.messages.length)).toEqual(expected.messages);
      expect(input.messages.at(-1)).toEqual({role: stage === "writing" ? "user" : "system", content: spec.resources[stage]});
    }
  });
  it("keeps full onstage cards and triggered world text; only writer gets voice-guide", () => {
    const material = directorTestMaterial(8);
    for (const stage of ["planning", "writing"] as const) {
      const input = compileCreativeInput({stage, material, actors: {elora: '艾洛拉'}, playerName: '林恩', context: {location: '旧洋馆', text: '大空洞'}, history: '', creation: outlineV7, selectedMemoryIds: []});
      for (const s of material.resources.sources) {
        if (s.kind === 'character') {
          expect(input.messages.some(m => m.content.includes(s.text))).toBe(s.id === 'elora');
          if (s.id !== 'elora') expect(input.messages.some(m => m.content.includes(s.brief!))).toBe(true);
        } else if (s.kind === 'world' && (s.activation!.always || s.activation!.keywords.includes('大空洞'))) {
          expect(input.messages.some(m => m.content.includes(s.text))).toBe(true);
        } else if (s.id === 'voice-guide') expect(input.messages.some(m => m.content.includes(s.text))).toBe(stage === 'writing');
      }
    }
    material.resources.sources = material.resources.sources.filter(s => s.id !== 'elora');
    expect(() => compileCreativeInput({stage: 'writing', material, actors: {elora: '艾洛拉'}, playerName: '林恩', context: {}, history: '', creation: outlineV7, selectedMemoryIds: []})).toThrow(/完整卡/);
  });
  it("does not send creative sources or the outline to the formatter", () => {
    const spec = defaultSpecification(), input = compileInput('formatting', spec, outlineV7, proseV7);
    expect(input.messages).toHaveLength(3);
    expect(JSON.stringify(input.messages)).not.toContain(outlineV7);
    for (const s of spec.resources.sources) expect(input.messages.some(m => m.content.includes(s.text))).toBe(false);
  });
  it("freezes writer task placement without changing original module roles or old v8 inputs", () => {
    const spec = defaultSpecification(), optedIn = compileInput('writing', spec, outlineV7);
    delete spec.resources.writingTaskRole;
    const historical = compileInput('writing', spec, outlineV7);
    expect(historical.messages.at(-1)!.role).toBe('system');
    expect(optedIn.messages.at(-1)!.role).toBe('user');
    expect(optedIn.messages.slice(0, -1)).toEqual(historical.messages.slice(0, -1));
    expect(optedIn.messages.at(-1)!.content).toBe(historical.messages.at(-1)!.content);
  });
  it("requires explicit routing for custom presets and rejects tampered source fragments before a call", () => {
    const models = defaultModels(); for (const model of Object.values(models)) model.baseUrl = 'https://example.invalid/v1';
    const plain = {prompts: [{identifier: 'custom', role: 'system', content: '自定义原则'}], prompt_order: [{character_id: 'one', order: [{identifier: 'custom', enabled: true}]}]};
    const spec = defaultSpecification(); spec.preset = parsePreset(JSON.stringify(plain)); spec.orderId = 'one';
    expect(() => createRun('custom', 1, spec, models)).toThrow(/airp_stages/);
    spec.preset.modules[0].stages = ['planning', 'writing'];
    expect(() => createRun('custom', 1, spec, models)).not.toThrow();
    const tampered = defaultSpecification(); tampered.preset.modules[0].content += 'changed';
    expect(() => createRun('tampered', 1, tampered, models)).toThrow(/摘要/);
    const raw = JSON.parse(builtinPresetFile()); raw.prompts[0].airp_stages = ['writing', 'writing'];
    expect(() => importPreset(JSON.stringify(raw))).toThrow();
    raw.prompts[0].airp_stages = ['formatting']; expect(() => importPreset(JSON.stringify(raw))).toThrow();
  });
});
