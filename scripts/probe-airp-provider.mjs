/** Opt-in diagnostic through rp's existing gateway/credential boundary; never logs headers or keys. */
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
const option = name => process.argv[process.argv.indexOf(name) + 1];
if (!process.argv.includes('--allow-live')) throw Error('Pass --allow-live');
const root = resolve(option('--rp-root'));
const moduleAt = path => import(pathToFileURL(resolve(root, path)).href);
const { loadServerConfig } = await moduleAt('server/src/config/env.ts');
const { ProviderCatalogRepository } = await moduleAt('server/src/providers/catalog/repository.ts');
const { ProviderGatewayResolver } = await moduleAt('server/src/providers/gateway-resolver.ts');
const { KeychainCredentialStore } = await moduleAt('server/src/providers/keychain-credential-store.ts');
const { default: Database } = await moduleAt('server/node_modules/better-sqlite3/lib/index.js');
const sqlite = new Database(loadServerConfig().databasePath, { readonly: true });
const repository = new ProviderCatalogRepository({ sqlite });
const providerId = option('--provider-id'), modelTargetId = option('--model-target-id');
const target = repository.findProvider(providerId, false)?.modelTargets.find(t => t.id === modelTargetId);
if (!target) throw Error('Unknown selected target');
const summaries = [];
function shape(value, depth = 0) {
  if (value === null) return 'null';
  if (depth > 4) return typeof value;
  if (Array.isArray(value)) return value.slice(0, 2).map(v => shape(v, depth + 1));
  if (typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, shape(v, depth + 1)]));
  return typeof value;
}
const pending = [];
const gateway = await new ProviderGatewayResolver(repository, new KeychainCredentialStore(), {
  fetch: async (...args) => {
    const response = await fetch(...args);
    const summary = { status: response.status, contentType: response.headers.get('content-type') };
    summaries.push(summary);
    pending.push(response.clone().text().then(body => {
      const items = body.startsWith('data:') ? body.split('\n').filter(l => l.startsWith('data:')).map(l => l.slice(5).trim()).filter(l => l && l !== '[DONE]') : [body];
      summary.shapes = [...new Set(items.map(item => { try { return JSON.stringify(shape(JSON.parse(item))); } catch { return 'non-JSON'; } }))].slice(0, 8);
      // Only recognized, non-sensitive diagnostic phrases; never arbitrary upstream text.
      summary.emptyContentsError = /contents (?:is not specified|must not be empty)|at least one.*(?:message|content)/i.test(body);
      summary.usagePresent = /"(?:prompt_tokens|completion_tokens)"\s*:/.test(body);
    }).catch(() => { summary.bodyUnavailable = true; }));
    return response;
  },
}).resolveGateway({ providerId, modelTargetId, modelId: target.remoteModelId });
try {
  const invocationId = process.argv.includes('--invocation-id') ? option('--invocation-id') : null;
  const prepared = invocationId ? (await (await fetch(`http://127.0.0.1:8787/api/v1/invocations/${encodeURIComponent(invocationId)}/context?detail=full`)).json()).data.details.evidence.request.prepared : null;
  for (const role of prepared ? ['invocation'] : ['system', 'user']) {
    let chars = 0;
    let output = '';
    const started = performance.now();
    try {
      for await (const event of gateway.stream({ modelId: target.remoteModelId, messages: prepared ? prepared.messages.map(({ role, content }) => ({ role, content })) : [{ role, content: 'Reply with only OK.' }], maxOutputTokens: process.argv.includes('--max-output-tokens') ? Number(option('--max-output-tokens')) : 1024, ...(process.argv.includes('--reasoning-effort') ? { reasoningEffort: option('--reasoning-effort') } : {}), abortSignal: AbortSignal.timeout(60000) })) {
        if (event.type === 'text-delta') { chars += event.textDelta.length; output += event.textDelta; }
        else if (event.type === 'finish') console.log(JSON.stringify({ role, finishReason: event.finishReason, usage: event.usage }));
      }
      console.log(JSON.stringify({ role, chars, elapsedMs: Math.round(performance.now() - started), ...(prepared ? { output: output.replace(/<span data-scylla-hidden[\s\S]*/, '[upstream hidden metadata]') } : {}) }));
    } catch (error) {
      const causes = [];
      for (let e = error; e && causes.length < 5; e = e.cause) causes.push({ name: e.name, code: e.code, valueShape: shape(e.value) });
      console.log(JSON.stringify({ role, chars, elapsedMs: Math.round(performance.now() - started), causes }));
    }
  }
  await Promise.all(pending); console.log(JSON.stringify({ remoteModelId: target.remoteModelId, responses: summaries }));
} finally { sqlite.close(); }
