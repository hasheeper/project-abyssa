import { expect, it } from "vitest";
import { activatedDirectorDocuments } from "../../content/presentation/airp/director-documents";
import { selectSceneSources } from "./source-selection";
import { compileCreativeInput } from "./creative-input";
import { directorTestMaterial } from "../testing/airp-director-fixture";
import { outlineV7 } from "../testing/airp-outline-fixture";

it('onstage full card cannot be replaced with a brief; offstage cards only contribute identity excerpts', () => {
  const selected = selectSceneSources(activatedDirectorDocuments, {elora: '艾洛拉'}, {intent: '看窗边的花'}, '');
  expect(selected.full.filter(s => s.kind === 'character').map(s => s.id)).toEqual(['elora']);
  expect(selected.briefs.map(s => s.id)).toEqual(['eustice', 'norma', 'kororo']);
  for (const brief of selected.briefs) {
    const original = activatedDirectorDocuments.find(s => s.id === brief.id)!;
    expect(brief.text).toBe(original.brief);
    expect(brief.text.length).toBeLessThan(500);
    expect(brief.text).not.toContain('dialogue_examples');
  }
  expect(() => selectSceneSources(activatedDirectorDocuments.filter(s => s.id !== 'elora'), {elora: '艾洛拉'}, {}, '')).toThrow(/完整卡/);
});
it('world triggers use current context/read history, not character cards, the outline, future card or other loaded lore', () => {
  const baseline = selectSceneSources(activatedDirectorDocuments, {elora: '艾洛拉'}, {intent: '看窗边的花', card: {intent: '明暗骰和伪典圣战'}, unknown: ['金币价格未知']}, '');
  expect(baseline.full.filter(s => s.kind === 'world').map(s => s.id)).toEqual(['world', 'current']);
  const triggered = selectSceneSources(activatedDirectorDocuments, {elora: '艾洛拉'}, {intent: '商店买东西'}, '之前谈到明暗骰。');
  expect(triggered.full.filter(s => s.kind === 'world').map(s => s.id)).toEqual(['world', 'current', 'economy', 'dice']);
  for (const source of triggered.full) expect(source.text).toBe(activatedDirectorDocuments.find(s => s.id === source.id)!.text);
});
it('Gemini actually receives every onstage card in full, even multiple actors, and never offstage full text', () => {
  const material = directorTestMaterial(7), actors = {elora: '艾洛拉', kororo: '柯萝萝'};
  const input = compileCreativeInput({stage: 'writing', material, actors, context: {intent: '商店买东西'}, history: '', playerName: '林恩', creation: outlineV7, selectedMemoryIds: []});
  for (const source of material.resources.sources.filter(s => s.kind === 'character')) {
    expect(input.messages.some(m => m.content.includes(source.text))).toBe(Object.hasOwn(actors, source.id));
    if (!Object.hasOwn(actors, source.id)) expect(input.messages.some(m => m.content.includes(source.brief!))).toBe(true);
  }
  expect(input.diagnostics).toContain('elora：在场角色卡全文');
  expect(input.diagnostics).toContain('kororo：在场角色卡全文');
  expect(input.diagnostics.some(d => d.startsWith('economy：触发全文'))).toBe(true);
  expect(input.messages.some(m => m.content.includes(material.resources.sources.find(s => s.id === 'economy')!.text))).toBe(true);
});
