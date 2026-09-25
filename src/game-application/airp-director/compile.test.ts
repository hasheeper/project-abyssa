import { expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { utf8Size } from "../../game-core/contracts/validation";
import { sha256 } from "../../game-core/contracts/sha256";
import { DIRECTOR_RUNTIME_LIMITS } from "./contracts";
import { compileDirectorInput } from "./compile";
import { directorTestContext, directorTestMaterial } from "../testing/airp-director-fixture";

it("compiles all world documents and all four entire character cards without changing original files", () => {
  const material = directorTestMaterial(), context = directorTestContext();
  const before = JSON.stringify({material, context}), input = compileDirectorInput(material, context);
  expect(input.stage).toBe("director"); expect(material.resources.sources).toHaveLength(16);
  for (const source of material.resources.sources) {
    expect(source.text).toBe(readFileSync(resolve(source.path), "utf8"));
    expect(source.sha256).toBe(sha256(source.text));
    expect(input.messages.some(m => m.content === `完整作者资料：${source.path}\n${source.text}`)).toBe(true);
  }
  expect(JSON.stringify({material, context})).toBe(before);
  expect(input.messages.some(m => m.content === material.resources.planning)).toBe(false);
  expect(input.messages.some(m => m.content === material.preset.planningPrefix)).toBe(false);
});
it("rejects missing complete actors, altered sources, missing author cards and future memories", () => {
  const material = directorTestMaterial(), context = directorTestContext();
  material.resources.sources = material.resources.sources.filter(s => s.id !== "norma");
  expect(() => compileDirectorInput(material, context)).toThrow(/norma/);
  const changed = directorTestMaterial(); changed.resources.sources[0].text += "伪造";
  expect(() => compileDirectorInput(changed, context)).toThrow();
  context.authorSources = []; expect(() => compileDirectorInput(directorTestMaterial(), context)).toThrow(/source/);
  const future = directorTestContext(); future.memories = [{id: "fact:1", phase: 99, text: "未来", knownBy: ["kael"], evidenceIds: ["fact:1"]}];
  expect(() => compileDirectorInput(directorTestMaterial(), future)).toThrow(/future/);
});
it("theme review is a separate request, comparing both libraries without loading the literary preset", () => {
  const input = compileDirectorInput(directorTestMaterial(), directorTestContext(), {version: 1, day: 1, reason: "留白", focus: null, entries: []});
  expect(input.stage).toBe("review"); expect(input.messages).toHaveLength(2);
  expect(input.messages[1].content).toContain("themes"); expect(input.messages[1].content).toContain("fixedCards");
  expect(input.messages.some(m => m.content.includes("完整作者资料："))).toBe(false);
});
it("measures the actual full-material input and a multi-scene envelope without reusing the two-scene cap", () => {
  const material = directorTestMaterial(), context = directorTestContext(), input = compileDirectorInput(material, context);
  const prose = Array.from({length: 20}, (_, i) => `第${i + 1}段：` + "仅容量样本，不是作者正文。".repeat(12)).join("\n");
  const outline = "仅容量样本的三段规划。".repeat(700);
  // One four-action event plus acceptance/result/followup, each retaining three independent outputs.
  const scenes = Array.from({length: 12}, (_, i) => ({id: `capacity:${i}`, planning: outline, writing: prose,
    formatting: JSON.stringify({creationRecord: "容量测量", lines: prose.split("\n").map(text => ({speaker: "narrator", emotion: "neutral", text}))})}));
  const materialBytes = utf8Size(JSON.stringify(material)), envelopeBytes = utf8Size(JSON.stringify({material, context, scenes}));
  expect(input.bytes).toBeGreaterThan(100_000); expect(input.bytes).toBeLessThan(2 * 1024 * 1024);
  expect(envelopeBytes).toBeLessThan(DIRECTOR_RUNTIME_LIMITS.stateBytes);
  console.info(JSON.stringify({kind: "GM-A/B synthetic capacity, not live or full save replay", sources: 16, materialBytes, directorInputBytes: input.bytes, scenes: scenes.length, envelopeBytes}));
});
