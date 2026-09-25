import assert from 'node:assert/strict';
import test from 'node:test';
import { createWritingPlanInput, measureAvgProse } from './lib/airp-writing-plan-variants.mjs';

const guide = '【正文侧：角色演出校正】\n[拟态废案] [本音矫正] [定稿录入]\n【语言协议锁】复述并执行：台词严格使用「日本語原文（中文翻译）」。\n【正文响应封装】输出planning和prose。';
function fixture() {
  const messages = [
    { role: 'system', content: '正文按本阶段协议分开交付planning编辑记录与prose终稿，只有prose属于故事。' },
    { role: 'user', content: '<info>完整角色卡与世界书原文，不可改写。</info>' },
    { role: 'system', content: `原文风：通过角色的**大量**内心独白填充正文。\n下方正文侧角色演出校正另存为编辑作品，不与故事段落交错。\n正文；编辑记录按下方独立封装。\n大纲中的动机分析、事实检查和正文侧编辑记录不变成玩家阅读的旁白\n${guide}` },
    { role: 'user', content: '<scene_plan>第一段／第二段／第三段，冻结大纲。</scene_plan>\n最终响应严格为 <planning>逐角色本音校正与语言协议</planning> 然后 <prose>完整故事自然段</prose>，两个区块都必须完整闭合。无字数要求。' },
  ];
  return { messages, bytes: messages.reduce((n, m) => n + Buffer.byteLength(m.content), 0), diagnostics: ['原诊断'], contextHash: 'same-context', selectedMemoryIds: [] };
}
test('with-plan is an independent, byte-identical control', () => {
  const input = fixture(), result = createWritingPlanInput(input, 'with-plan', guide);
  assert.deepEqual(result, { input, changes: [] }); assert.notEqual(result.input, input);
});
test('without-plan only changes six editorial/delivery anchors and preserves full source and outline', () => {
  const input = fixture(), frozen = structuredClone(input), result = createWritingPlanInput(input, 'without-plan', guide);
  assert.deepEqual(input, frozen); assert.equal(result.changes.length, 6);
  const text = result.input.messages.map(m => m.content).join('\n');
  assert(!text.includes('<planning>')); assert(!text.includes('[拟态废案]'));
  assert(text.includes('台词严格使用「日本語原文（中文翻译）」'));
  assert(text.includes('<scene_plan>第一段／第二段／第三段，冻结大纲。</scene_plan>'));
  assert(text.includes('通过角色的**大量**内心独白填充正文'));
  assert.deepEqual(result.input.messages[1], input.messages[1]);
  assert.equal(result.input.contextHash, input.contextHash);
  assert.equal(result.input.bytes, result.input.messages.reduce((n, m) => n + Buffer.byteLength(m.content), 0));
  assert(result.input.bytes < input.bytes);
});
test('stale or duplicated anchors fail closed instead of silently mixing variants', () => {
  const absent = fixture(); absent.messages[0].content = 'changed';
  assert.throws(() => createWritingPlanInput(absent, 'without-plan', guide), /exact prompt anchor/);
  const duplicate = fixture(); duplicate.messages.push(structuredClone(duplicate.messages[0]));
  assert.throws(() => createWritingPlanInput(duplicate, 'without-plan', guide), /exact prompt anchor/);
  assert.throws(() => createWritingPlanInput(fixture(), 'unknown', guide), /Unknown/);
  assert.throws(() => createWritingPlanInput(fixture(), 'without-plan', 'no language block'), /bilingual/);
});
test('metrics count bilingual dialogue once and Unicode characters rather than code units', () => {
  const result = measureAvgProse('旁白。\n\n再一句。\n「はい。（好。）」\n「うん。（嗯。）」\n🌱');
  assert.deepEqual(result, { pages: 5, dialoguePages: 2, narratorPages: 3, dialoguePercent: 40,
    longestNarratorRun: 2, longestNarrator: 4, longestDialogue: 9, narratorCharacters: 8, dialogueCharacters: 18 });
  assert.equal(measureAvgProse('').pages, 0);
});
