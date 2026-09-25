import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';

/** @typedef {{role: string, content: string}} TextMessage */
/** @typedef {{identifier: string, name: string, role: string, content: string, marker: boolean, unsupported: string[]}} NativeModule */
/** @typedef {{identifier: string, before: string, after: string}} MicroEdit */
/** @typedef {{identifier: string, marker?: boolean, content: string}} SourcePrompt */
/** @typedef {{model?: string, usage?: Record<string, unknown>, choices?: {finish_reason?: string | null, delta?: VisibleMessage, message?: VisibleMessage}[]}} VisibleResponse */
/** @typedef {{content?: unknown, refusal?: unknown, tool_calls?: unknown[]}} VisibleMessage */

/** @param {string} text */
export const digest = text => createHash('sha256').update(text).digest('hex');

/** Literal, anchored edits inside existing modules. Never replace an entire preset or append rules. */
/** @template {{prompts: SourcePrompt[]}} T
 * @param {T} original
 * @param {MicroEdit[]} edits
 * @returns {T}
 */
export function applyNativeMicroEdits(original, edits) {
  assert(Array.isArray(original.prompts) && Array.isArray(edits) && edits.length);
  const preset = structuredClone(original);
  for (const edit of edits) {
    const matches = preset.prompts.filter(p => p.identifier === edit.identifier);
    assert.equal(matches.length, 1, 'Micro-edit module must exist exactly once');
    const module = matches[0];
    assert(!module.marker && typeof module.content === 'string');
    assert(typeof edit.before === 'string' && edit.before && typeof edit.after === 'string');
    assert(module.content.includes(edit.before), `Micro-edit source changed: ${edit.identifier}`);
    assert.equal(module.content.indexOf(edit.before), module.content.lastIndexOf(edit.before), 'Ambiguous micro-edit anchor');
    module.content = module.content.replace(edit.before, () => edit.after);
  }
  return preset;
}

/** Optional reading copy only. Raw output remains authoritative and is never overwritten. */
/** @param {string} raw */
export function originalBody(raw) {
  assert(raw.startsWith('<Interleaving>') && raw.trimEnd().endsWith('</Interleaving>'), 'Unexpected native wrapper; inspect raw output');
  const blocks = [...raw.matchAll(/<thinking>[\s\S]*?<\/thinking>/g)];
  assert.equal(blocks.length, 3, 'Expected three public creation-record blocks');
  const body = raw.slice('<Interleaving>'.length, raw.lastIndexOf('</Interleaving>')).replace(/<thinking>[\s\S]*?<\/thinking>/g, '').trim();
  assert(!/<\/?thinking>|<\/?Interleaving>/.test(body), 'Unrecognized nested tags');
  return body;
}

/** Experimental Plan is separate from, and does not replace, the three native ICOT blocks. */
/** @param {string} raw */
export function performancePlanBody(raw) {
  const match = /^\s*<planning>([\s\S]*?)<\/planning>\s*(<Interleaving>[\s\S]*)$/.exec(raw);
  assert(match && match[1].trim(), 'Missing leading performance Plan; inspect raw output');
  assert(!/<\/?planning>/.test(match[1]), 'Nested performance Plan');
  return {plan: match[1], body: originalBody(match[2])};
}

/** A single additive comparison: all parameters and all previous content stay byte-identical. */
/** @template {{messages: TextMessage[]}} T
 * @param {T} baseline
 * @param {string} addition
 * @returns {T}
 */
export function withPerformancePlan(baseline, addition) {
  assert(typeof addition === 'string' && addition.trim());
  const request = structuredClone(baseline);
  const last = request.messages.at(-1); assert(last);
  assert.equal(last.role, 'user');
  last.content += '\n\n' + addition;
  const restored = structuredClone(request);
  const restoredLast = restored.messages.at(-1); assert(restoredLast);
  restoredLast.content = restoredLast.content.slice(0, -addition.length - 2);
  assert.deepEqual(restored, baseline, 'More than the Plan block changed');
  return request;
}

/** Copy existing Chinese translations; do not retranslate, rewrite, split or merge paragraphs. */
/** @param {string} body @param {(text: string) => string} extractDialogue */
export function chineseReadingBody(body, extractDialogue) {
  const result = body.replace(/^([\t ]*)(「[^\r\n]*」)([\t ]*)$/gm, (_line, before, dialogue, after) => before + extractDialogue(dialogue) + after);
  assert(!/[\u3040-\u30ff]/u.test(result), 'Japanese remains outside translated dialogue; inspect raw output');
  return result;
}

/** Optional proposals are not performed dialogue. Preserve their text outside prose metrics. */
/** @param {string} body @param {{expectedCount?: number}} options */
export function splitNativeChoiceTail(body, {expectedCount} = {}) {
  const markers = [...body.matchAll(/^【可选回应】[\t ]*\r?$/gm)];
  if (!markers.length) {
    assert(expectedCount === undefined, 'Missing expected response options');
    return {body, choices: ''};
  }
  assert.equal(markers.length, 1, 'Repeated optional-response heading; inspect raw output');
  const index = markers[0].index, narrative = body.slice(0, index).trimEnd();
  const choices = body.slice(index).trim();
  const lines = choices.split(/\r?\n/).slice(1).map(s => s.trim()).filter(Boolean);
  assert(narrative && lines.length, 'Empty prose or optional responses');
  assert(lines.every(s => /^\d+[.、．)）]\s*\S/.test(s)), 'Unexpected content after optional responses; inspect raw output');
  if (expectedCount !== undefined) assert.equal(lines.length, expectedCount, 'Unexpected response-option count');
  assert(!/[\u3040-\u30ff]/u.test(choices), 'Optional responses must be Chinese');
  return {body: narrative, choices};
}

/** Literal prompt-manager order. Only the supplied macro compiler and marker bindings run. */
/** @param {{modules: NativeModule[], orders: {id: string, entries: {identifier: string, enabled: boolean}[]}[]}} preset
 * @param {string} orderId
 * @param {(text: string) => string} expand
 * @param {Record<string, TextMessage[]>} slots
 */
export function compileNativeOrder(preset, orderId, expand, slots) {
  const order = preset.orders.find(o => o.id === orderId);
  assert(order, 'Missing native order');
  /** @type {TextMessage[]} */
  const messages = [];
  const trace = [];
  for (const entry of order.entries) {
    if (!entry.enabled) continue;
    const module = preset.modules.find(m => m.identifier === entry.identifier);
    assert(module && module.unsupported.length === 0, 'Unsupported native module');
    const start = messages.length;
    if (module.marker) {
      assert(Object.hasOwn(slots, module.identifier), `Unbound marker: ${module.identifier}`);
      for (const message of slots[module.identifier]) {
        assert(['system', 'user', 'assistant'].includes(message.role) && typeof message.content === 'string');
        if (message.content.trim()) messages.push({...message});
      }
    } else {
      const content = expand(module.content);
      if (content.trim()) messages.push({role: module.role, content});
    }
    trace.push({id: module.identifier, name: module.name, role: module.role, marker: module.marker,
      originalSha256: digest(module.content), originalCharacters: module.content.length,
      messageIndices: Array.from({length: messages.length - start}, (_, i) => start + i)});
  }
  assert(messages.length, 'Empty native prompt');
  return {messages, trace};
}

/** Text-only equivalent of SillyTavern mergeMessages(strict=true, tools=false).
 * Reference: https://github.com/SillyTavern/SillyTavern/blob/release/src/prompt-converters.js
 * No names, tools, media or placeholder injection are needed by this fixture.
 * Never reorder content: merge equal adjacent roles; convert mid-prompt system; merge again.
 */
/** @param {TextMessage[]} messages */
export function strictTextMessages(messages) {
  assert(messages.length);
  /** @param {TextMessage[]} input */
  const merge = input => input.reduce((output, message) => {
    assert.deepEqual(Object.keys(message).sort(), ['content', 'role']);
    assert(['system', 'user', 'assistant'].includes(message.role) && typeof message.content === 'string' && message.content.length);
    const previous = output.at(-1);
    if (previous?.role === message.role) previous.content += '\n\n' + message.content;
    else output.push({...message});
    return output;
  }, /** @type {TextMessage[]} */ ([]));
  const first = merge(messages);
  assert(first[0].role === 'user' || first[0].role === 'system', 'Fixture would require a synthetic placeholder');
  if (first[0].role === 'system') assert(first[1]?.role === 'user', 'Fixture would require a synthetic placeholder');
  return merge(first.map((m, i) => i > 0 && m.role === 'system' ? {...m, role: 'user'} : m));
}

/** Keep public assistant content only; never inspect/save provider-private reasoning fields. */
/** @param {Response} response @param {(characters: number) => void} onProgress */
export async function readVisibleResponse(response, onProgress = () => {}) {
  let text = '', refused = false, toolCalls = false, received = 0;
  /** @type {string | null} */ let finishReason = null;
  /** @type {string | null} */ let model = null;
  /** @type {Record<string, unknown> | null} */ let usage = null;
  /** @param {VisibleResponse} raw */
  const accept = raw => {
    model = raw.model ?? model; usage = raw.usage ?? usage;
    const choice = raw.choices?.[0];
    finishReason = choice?.finish_reason ?? finishReason;
    const message = choice?.delta ?? choice?.message;
    if (typeof message?.content === 'string') text += message.content;
    refused ||= !!message?.refusal; toolCalls ||= !!message?.tool_calls?.length;
    onProgress(text.length);
  };
  if (!response.headers.get('content-type')?.includes('text/event-stream')) {
    const raw = await response.text();
    assert(Buffer.byteLength(raw) <= 4 * 1024 * 1024, 'Oversized response');
    accept(JSON.parse(raw));
  } else {
    assert(response.body, 'Missing stream');
    const reader = response.body.getReader(), decoder = new TextDecoder();
    let pending = '';
    /** @param {string} line */
    const consume = line => {
      if (!line.startsWith('data:')) return;
      const data = line.slice(5).trim();
      if (data && data !== '[DONE]') accept(JSON.parse(data));
    };
    try {
      for (;;) {
        const chunk = await reader.read(); if (chunk.done) break;
        received += chunk.value.byteLength;
        assert(received <= 4 * 1024 * 1024, 'Oversized stream');
        pending += decoder.decode(chunk.value, {stream: true});
        let newline;
        while ((newline = pending.indexOf('\n')) >= 0) {
          consume(pending.slice(0, newline).replace(/\r$/, '')); pending = pending.slice(newline + 1);
        }
      }
      pending += decoder.decode(); if (pending.trim()) consume(pending);
    } finally {await reader.cancel().catch(() => {}); reader.releaseLock();}
  }
  return {text, finishReason, model, usage, refused, toolCalls};
}
