import {setTimeout as delay} from 'node:timers/promises';
import {encodeRequest, decodeResponse} from './adapters.mjs';
import {validateProfile} from './config.mjs';
import {LlmError, requireValue} from './errors.mjs';

export async function readBoundedBody(response, maxBytes = 2 * 1024 * 1024) {
  requireValue(response.body, 'Empty HTTP response.', 'PROTOCOL');
  const reader = response.body.getReader(), chunks = []; let size = 0;
  try {
    for (;;) {
      const {done,value} = await reader.read(); if (done) break;
      size += value.byteLength;
      if (size > maxBytes) {await reader.cancel(); throw new LlmError('RESPONSE_SIZE', 'Provider response exceeded the size limit.');}
      chunks.push(Buffer.from(value));
    }
    return Buffer.concat(chunks).toString('utf8');
  } finally {reader.releaseLock();}
}
/** Text-only, explicit provider format; no automatic fallback, no raw upstream logs. */
export async function generate({profile, apiKey, request, signal, fetchImpl = fetch}) {
  const p = validateProfile(profile);
  requireValue(p.auth === 'none' || typeof apiKey === 'string' && apiKey.trim() && !/[\r\n]/.test(apiKey), 'Missing or invalid API key.', 'AUTH_CONFIG');
  const wire = encodeRequest(p, apiKey, request);
  const started = Date.now(), timeout = AbortSignal.timeout(p.timeoutMs);
  const combined = signal ? AbortSignal.any([signal,timeout]) : timeout;
  let attempts = 0;
  try {
    for (;;) {
      combined.throwIfAborted(); attempts++;
      const response = await fetchImpl(wire.url, {method:'POST',headers:wire.headers,body:JSON.stringify(wire.body),redirect:'error',signal:combined});
      if (!response.ok) {
        await response.body?.cancel();
        if ([429,502,503,504].includes(response.status) && attempts <= p.maxRetries) {
          const retryAfter = response.headers.get('retry-after');
          const seconds = retryAfter && /^\d+(\.\d+)?$/.test(retryAfter) ? Number(retryAfter) * 1000 : retryAfter ? Date.parse(retryAfter) - Date.now() : NaN;
          // Do not retry before a provider's requested delay if it exceeds our retry budget.
          if (Number.isFinite(seconds) && seconds > 10000) throw new LlmError('HTTP', 'Provider asked for a longer cooldown; retry later.', {status:response.status});
          const wait = Number.isFinite(seconds) ? Math.max(0,seconds) : Math.min(8000,500 * 2 ** (attempts-1));
          await delay(wait, undefined, {signal:combined}); continue;
        }
        throw new LlmError('HTTP', 'Provider rejected the HTTP request. Check the profile, credentials or provider status.', {status:response.status});
      }
      const body = await readBoundedBody(response);
      let json; try {json = JSON.parse(body);} catch {throw new LlmError('PROTOCOL', 'Expected a JSON response; check the API format and proxy root.');}
      const result = decodeResponse(p.format,json);
      return {...result, format:p.format, model:result.model ?? p.model, attempts, durationMs:Date.now()-started};
    }
  } catch (error) {
    if (signal?.aborted) throw new LlmError('CANCELLED', 'Request was cancelled.');
    if (timeout.aborted) throw new LlmError('TIMEOUT', 'Request timed out; no automatic retry was sent.');
    if (error instanceof LlmError) throw error;
    throw new LlmError('NETWORK', 'Network request failed; no automatic retry was sent.');
  }
}
