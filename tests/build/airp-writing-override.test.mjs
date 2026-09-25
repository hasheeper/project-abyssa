import { test } from 'node:test';
import assert from 'node:assert/strict';
import { verifiedWritingOverride } from '../../scripts/lib/airp-writing-override.mjs';

const config = { models: { writing: { baseUrl: 'https://writer.invalid/v1', model: 'gemini', timeoutMs: 180000, temperature: 1 },
  updater: { baseUrl: 'https://updater.invalid/prefix/v1/chat/completions', model: 'deepseek-flash', timeoutMs: 30000 } },
  keys: { writing: 'writer-fixture', updater: 'updater-fixture' } };
test('explicit model diagnostic uses the configured credential only for its own catalogue and preserves writer settings', async () => {
  const before = structuredClone(config); let calls = 0;
  const result = await verifiedWritingOverride(config, 'deepseek-flash', async (url, init) => {
    calls++; assert.equal(String(url), 'https://updater.invalid/prefix/v1/models');
    assert(init); assert.equal(new Headers(init.headers).get('Authorization'), 'Bearer updater-fixture'); assert.equal(init.redirect, 'error');
    return Response.json({ data: [{ id: 'deepseek-flash' }] });
  });
  assert.equal(calls, 1); assert.deepEqual(config, before);
  assert.deepEqual(result.config, { ...config.models.writing, baseUrl: config.models.updater.baseUrl, model: 'deepseek-flash' });
  assert.equal(result.key, config.keys.updater); assert.equal(result.proof.listed, true);
});
test('missing/wrong catalogue and errors do not dispatch chat or leak response text', async () => {
  await assert.rejects(verifiedWritingOverride(config, 'deepseek-falsh', () => { throw Error('must not call'); }), /authorized/);
  await assert.rejects(verifiedWritingOverride(config, 'deepseek-flash', async () => Response.json({ data: [] })), /not listed/);
  await assert.rejects(verifiedWritingOverride(config, 'deepseek-flash', async () => new Response('sensitive-upstream-body', { status: 500 })), e => e instanceof Error && !e.message.includes('sensitive-upstream-body') && e.message.includes('HTTP 500'));
});
