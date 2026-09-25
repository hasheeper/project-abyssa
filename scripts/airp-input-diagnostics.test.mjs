import assert from 'node:assert/strict';
import test from 'node:test';
import { buildInputDiagnostic } from './lib/airp-input-diagnostics.mjs';

const run = () => ({ spec: { resources: { sources: [{ path: 'world.txt', sha256: 'fixture', text: '完整设定原文{{user}}' }] }, sample: { memories: [] } }, attempts: [{ stage: 'planning', config: { model: 'test', max_tokens: 8192 }, input: { bytes: 100, messages: [
  { role: 'system', content: '应用规则' },
  { role: 'system', content: '创作原则原文\n在写作前，你通常需要进行周密的思考，旧调度<thinking_format>\n【Kemini 三段式规划核心：原文检查要求】\n三段检查原文\n【AIRP 阶段适配与扩展：大纲】\n三段扩展' },
  { role: 'user', content: '{"context":"真实情境"}' },
  { role: 'user', content: '【原文】\n完整设定原文{{user}}' },
  { role: 'user', content: '仅交付三段大纲' },
] } }] });

test('tag diagnostic retains original source and checklist, removes only legacy format dispatch', () => {
  const input = run(), before = JSON.stringify(input), candidate = buildInputDiagnostic(input, 'tags');
  assert.equal(JSON.stringify(input), before);
  assert(candidate.request.messages[0].content.includes('创作原则原文'));
  assert(candidate.request.messages[0].content.includes('<thinking_format>\n三段检查原文\n</thinking_format>'));
  assert(candidate.request.messages[1].content.includes('完整设定原文{{user}}'));
  assert(!candidate.request.messages[0].content.includes('旧调度'));
  assert.equal(candidate.request.max_tokens, 8192);
  assert.equal(candidate.request.stream, true);
});
test('parameter comparison changes only max_tokens', () => {
  const a = buildInputDiagnostic(run(), 'tags').request, b = buildInputDiagnostic(run(), 'no-output-limit').request;
  delete a.max_tokens; assert.deepEqual(a, b);
});
test('no-preset control retains complete author sources and stage task', () => {
  const a = buildInputDiagnostic(run(), 'no-output-limit'), b = buildInputDiagnostic(run(), 'without-preset');
  assert.equal(a.request.messages[1].content, b.request.messages[1].content);
  assert(!b.request.messages[0].content.includes('创作原则原文'));
  assert.equal(b.audit.productionPresetChanged, false);
});
test('unexpected source/template changes abort before any network call', () => {
  const input = run(); input.attempts[0].input.messages[1].content = '未知模板';
  assert.throws(() => buildInputDiagnostic(input, 'tags'));
});
test('synthetic size control matches roles and per-message content byte lengths without altering author sources', () => {
  const input = run(), before = JSON.stringify(input);
  const a = buildInputDiagnostic(input, 'no-output-limit'), b = buildInputDiagnostic(input, 'neutral-size-control');
  assert.equal(JSON.stringify(input), before);
  assert.deepEqual(b.request.messages.map(m => [m.role, Buffer.byteLength(m.content)]), a.request.messages.map(m => [m.role, Buffer.byteLength(m.content)]));
  assert(!b.request.messages.some(m => m.content.includes('完整设定原文')));
  assert.equal(b.audit.syntheticControlOnly, true);
  assert.equal(b.audit.fullSourcesPreserved, false);
  assert.equal(b.request.max_tokens, undefined);
  assert(b.request.messages[1].content.endsWith('测试指令：只回复“长输入连接成功。”'));
});
test('plain task sends exactly one ordinary user message and no preset or optional generation parameters', () => {
  const input = run(), before = JSON.stringify(input), candidate = buildInputDiagnostic(input, 'plain-task');
  assert.equal(JSON.stringify(input), before);
  assert.deepEqual(candidate.request, { model: 'test', messages: [{ role: 'user', content: '写三句咖啡馆里的日常对白。' }], stream: true });
  assert.equal(candidate.audit.sourceCount, 0);
  assert.equal(candidate.audit.productionPresetChanged, false);
});
