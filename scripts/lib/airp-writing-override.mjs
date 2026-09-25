import assert from 'node:assert/strict';

/** Explicit test-only switch. Auth stays private; a catalogue GET is not a chat call. */
/** @param {{models: {writing: import('../../src/game-application/airp-generation/contracts').ModelConfiguration, updater: import('../../src/game-application/airp-generation/contracts').ModelConfiguration}, keys: {writing: string, updater: string}}} config
 * @param {string} model
 * @param {typeof fetch} transport
 */
export async function verifiedWritingOverride(config, model, transport = fetch) {
  assert.equal(model, 'deepseek-flash', 'Only the user-authorized DeepSeek Flash diagnostic is supported');
  const slots = /** @type {const} */ (['updater', 'writing']);
  const slot = slots.find(s => config.models[s].model === model);
  assert(slot && config.keys[slot]?.trim(), 'Requested model must already have a configured connection/key');
  const target = config.models[slot], url = new URL(target.baseUrl);
  assert(['https:', 'http:'].includes(url.protocol) && !url.username && !url.password && !url.search && !url.hash, 'Invalid catalogue endpoint');
  url.pathname = url.pathname.replace(/\/+$/, '').replace(/\/chat\/completions$/, '') + '/models';
  let response;
  try {
    response = await transport(url, { redirect: 'error', credentials: 'omit', cache: 'no-store',
      headers: { Authorization: `Bearer ${config.keys[slot].trim()}` }, signal: AbortSignal.timeout(15000) });
  } catch { throw new Error('Model catalogue request failed; endpoint and response withheld'); }
  assert(response.ok, `Model catalogue HTTP ${response.status}; response withheld`);
  /** @type {{data?: {id?: string}[]}} */
  let data;
  try { data = await response.json(); } catch { throw new Error('Invalid model catalogue; response withheld'); }
  assert(Array.isArray(data.data) && data.data.some(m => m?.id === model), 'Requested model not listed; no chat dispatched');
  return { config: { ...config.models.writing, baseUrl: target.baseUrl, model }, key: config.keys[slot],
    proof: { requested: model, listed: true, configuredSlot: slot, checkedAt: new Date().toISOString() } };
}
