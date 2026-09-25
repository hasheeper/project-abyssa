// Explicit, one-request browser diagnostic. Never run from tests or app startup.
// Usage: node scripts/diagnose-airp-input.mjs <mode> <expected-spent-calls>
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { chromium } from 'playwright';
import { buildInputDiagnostic } from './lib/airp-input-diagnostics.mjs';

const [mode, expectedText] = process.argv.slice(2);
const expected = Number(expectedText);
assert(expectedText && Number.isSafeInteger(expected), 'Explicit expected call count required');
const root = process.cwd();
const reports = path.join(root, 'dist/reports/airp-live');
const ledgerPath = path.join(reports, 'call-ledger.json');
const ledger = JSON.parse(await fs.readFile(ledgerPath, 'utf8'));
assert(ledger.calls === expected && Number.isSafeInteger(ledger.limit) && ledger.limit >= 12 && expected < ledger.limit, 'Budget changed or exhausted');
const frozenPath = path.join(reports, '2026-09-22T14-51-48-836Z/stopped.json');
const { run } = JSON.parse(await fs.readFile(frozenPath, 'utf8'));
const { request, audit } = buildInputDiagnostic(run, mode);
for (const source of run.spec.resources.sources) {
  assert.equal(createHash('sha256').update(source.text).digest('hex'), source.sha256);
  assert.equal(await fs.readFile(path.join(root, source.path), 'utf8'), source.text, `Changed source: ${source.path}`);
}
const config = JSON.parse(await fs.readFile(path.join(root, 'config/airp-test.local.json'), 'utf8'));
const connection = { ...config.connection, ...config.models.planning };
assert(connection.baseUrl && connection.apiKey && connection.model === request.model, 'Configuration differs from frozen model');
const endpoint = new URL(connection.baseUrl);
assert(['https:', 'http:'].includes(endpoint.protocol) && !endpoint.username && !endpoint.password);
endpoint.pathname = endpoint.pathname.replace(/\/+$/, '').replace(/\/chat\/completions$/, '') + '/chat/completions';
const redactions = [connection.apiKey.trim(), connection.baseUrl, endpoint.href, endpoint.origin].filter(Boolean);
const sanitize = value => {
  let text = typeof value === 'string' ? value : JSON.stringify(value, null, 2);
  for (const secret of redactions) text = text.replaceAll(secret, '[redacted]');
  return text;
};
const folder = path.join(reports, `input-${mode}-${new Date().toISOString().replace(/[:.]/g, '-')}`);
await fs.mkdir(folder, { recursive: true });
await fs.writeFile(path.join(folder, 'request.json'), sanitize(request));
await fs.writeFile(path.join(folder, 'audit.json'), sanitize({ ...audit, currentSourcesMatch: true, frozenPath, expectedCallNumber: expected + 1 }));
const browser = await chromium.launch({ headless: true });
let posted = 0;
const network = [];
try {
  const page = await browser.newPage();
  page.on('request', outgoing => {
    if (outgoing.method() !== 'POST' || outgoing.url() !== endpoint.href) return;
    posted += 1;
    writeFileSync(ledgerPath, JSON.stringify({ ...ledger, calls: expected + posted }));
    network.push({ event: 'request', method: 'POST', origin: outgoing.headers().origin ?? null, authorizationPresent: Boolean(outgoing.headers().authorization) });
  });
  page.on('response', response => {
    if (response.url() !== endpoint.href) return;
    network.push({ event: 'response', status: response.status(), allowedOrigin: response.headers()['access-control-allow-origin'] ?? null });
  });
  await page.goto('http://127.0.0.1:5195/airp.html');
  const result = await page.evaluate(async ({ url, apiKey, body, timeoutMs }) => {
    const started = performance.now();
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    const result = { status: null, contentType: null, events: 0, done: false, finishReason: null, usage: null, output: '', reasoningCharacters: 0, errors: [], elapsedMs: 0 };
    const errorText = value => typeof value === 'string' ? value : value?.message ?? value?.error?.message ?? JSON.stringify(value);
    const accept = (payload, eventName = '') => {
      result.events++;
      if (payload.error || eventName === 'error') result.errors.push(errorText(payload.error ?? payload));
      if (payload.usage) result.usage = payload.usage;
      for (const choice of payload.choices ?? []) {
        if (choice.finish_reason) result.finishReason = choice.finish_reason;
        const item = choice.delta ?? choice.message ?? {};
        if (typeof item.content === 'string') result.output += item.content;
        if (typeof item.reasoning_content === 'string') result.reasoningCharacters += item.reasoning_content.length;
        if (item.refusal) result.errors.push(errorText(item.refusal));
      }
    };
    try {
      const response = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey.trim()}` }, body: JSON.stringify(body), mode: 'cors', credentials: 'omit', redirect: 'error', cache: 'no-store', signal: controller.signal });
      result.status = response.status;
      result.contentType = response.headers.get('content-type');
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let raw = '', bytes = 0;
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        bytes += value.byteLength;
        if (bytes > 2 * 1024 * 1024) { await reader.cancel(); throw Error('diagnostic-response-limit'); }
        raw += decoder.decode(value, { stream: true });
      }
      raw += decoder.decode();
      if (result.contentType?.includes('text/event-stream')) {
        for (const event of raw.replaceAll('\r\n', '\n').split('\n\n')) {
          const lines = event.split('\n');
          const eventName = lines.find(line => line.startsWith('event:'))?.slice(6).trim() ?? '';
          const data = lines.filter(line => line.startsWith('data:')).map(line => line.slice(5).trimStart()).join('\n');
          if (!data) continue;
          if (data.trim() === '[DONE]') { result.done = true; continue; }
          try { accept(JSON.parse(data), eventName); } catch { result.errors.push(eventName === 'error' ? data : 'unparseable-sse-data'); }
        }
      } else {
        try { accept(JSON.parse(raw)); } catch { result.errors.push(raw.slice(0, 2000)); }
      }
      if (!response.ok && !result.errors.length) result.errors.push(`http-${response.status}`);
    } catch (error) {
      result.errors.push(controller.signal.aborted ? 'timeout' : error.message === 'diagnostic-response-limit' ? error.message : 'browser-network-or-read-error');
    } finally { clearTimeout(timer); }
    result.elapsedMs = Math.round(performance.now() - started);
    return result;
  }, { url: endpoint.href, apiKey: connection.apiKey, body: request, timeoutMs: connection.timeoutMs ?? 180000 });
  result.errors = result.errors.map(error => sanitize(error).replace(/[A-Za-z0-9_+/=-]{80,}/g, '[opaque-value]'));
  const { output, ...details } = result;
  const verdict = result.errors.length ? 'upstream-or-transport-error' : result.finishReason === 'length' ? 'output-truncated' : output.length ? 'returned-content-needs-review' : 'empty-output';
  const summary = { mode, model: request.model, ...details, outputCharacters: output.length, verdict, network, calls: expected + posted, limit: ledger.limit, evidenceFolder: folder };
  await fs.writeFile(path.join(folder, 'output.txt'), sanitize(output));
  await fs.writeFile(path.join(folder, 'result.json'), sanitize(summary));
  console.log(sanitize(summary));
} catch {
  await fs.writeFile(path.join(folder, 'runner-error.json'), JSON.stringify({ error: 'diagnostic-runner-failed', posted, calls: expected + posted }));
  console.log(JSON.stringify({ error: 'diagnostic-runner-failed', calls: expected + posted, evidenceFolder: folder }));
  process.exitCode = 1;
} finally {
  await browser.close();
}
