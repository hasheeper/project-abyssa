import {LlmError, onlyKeys, requireValue} from './errors.mjs';

export function validateRequest(request, maxInputChars = 120000) {
  onlyKeys(request, ['messages','maxOutputTokens','temperature','topP','stop'], 'Request', 'REQUEST');
  requireValue(Array.isArray(request.messages) && request.messages.length > 0 && request.messages.length <= 1000, 'messages must contain 1–1000 text messages.', 'REQUEST');
  let nonSystem = false, chars = 0;
  for (const m of request.messages) {
    onlyKeys(m, ['role','content'], 'Message', 'REQUEST');
    requireValue(['system','user','assistant'].includes(m.role) && typeof m.content === 'string' && m.content.trim(), 'Invalid text message.', 'REQUEST');
    requireValue(!(m.role === 'system' && nonSystem), 'System messages must precede conversation history.', 'REQUEST');
    if (m.role !== 'system') nonSystem = true;
    chars += m.content.length;
  }
  requireValue(request.messages.some(m => m.role === 'user') && request.messages.at(-1).role === 'user', 'The final message must be a user request.', 'REQUEST');
  requireValue(chars <= maxInputChars, 'Input exceeds the configured character budget; assemble a smaller context.', 'CONTEXT_BUDGET');
  if (request.maxOutputTokens !== undefined) requireValue(Number.isInteger(request.maxOutputTokens) && request.maxOutputTokens > 0 && request.maxOutputTokens <= 131072, 'Invalid output token limit.', 'REQUEST');
  for (const [k,max] of [['temperature',2],['topP',1]]) if (request[k] !== undefined) requireValue(Number.isFinite(request[k]) && request[k]>=0 && request[k]<=max, `Invalid ${k}.`, 'REQUEST');
  if (request.stop !== undefined) requireValue(Array.isArray(request.stop) && request.stop.length <= 4 && request.stop.every(s => typeof s === 'string' && s.length > 0 && s.length <= 256), 'Invalid stop sequences.', 'REQUEST');
  return request;
}
function conversation(messages, mapRole) {
  const result = [];
  for (const m of messages.filter(m => m.role !== 'system')) {
    const role = mapRole(m.role);
    if (result.at(-1)?.role === role) result.at(-1).parts.push({text:m.content});
    else result.push({role, parts:[{text:m.content}]});
  }
  return result;
}
export function encodeRequest(profile, key, request) {
  validateRequest(request, profile.maxInputChars);
  const max = request.maxOutputTokens ?? profile.maxOutputTokens;
  requireValue(max <= profile.maxOutputTokens, 'Requested output limit exceeds the profile limit.', 'REQUEST');
  const temperature = request.temperature ?? profile.temperature, topP = request.topP ?? profile.topP;
  requireValue(profile.format !== 'anthropic' || temperature === undefined || temperature <= 1, 'Anthropic temperature must be at most 1.', 'REQUEST');
  const generation = {...(temperature === undefined ? {} : {temperature}), ...(topP === undefined ? {} : {top_p:topP})};
  const system = request.messages.filter(m => m.role === 'system').map(m => m.content).join('\n\n');
  const headers = {'content-type':'application/json', accept:'application/json'};
  if (profile.auth === 'bearer') headers.authorization = `Bearer ${key}`;
  else if (profile.auth !== 'none') headers[profile.auth] = key;
  let path, body;
  switch (profile.format) {
    case 'oai':
      path = '/chat/completions';
      body = {model:profile.model, messages:request.messages, stream:false, [profile.outputTokenField ?? 'max_completion_tokens']:max, ...generation, ...(request.stop?.length ? {stop:request.stop} : {})};
      break;
    case 'oai-res':
      requireValue(!request.stop?.length, 'Responses does not support stop sequences in this adapter.', 'REQUEST');
      path = '/responses';
      body = {model:profile.model, ...(system ? {instructions:system} : {}), input:request.messages.filter(m => m.role !== 'system').map(m => ({role:m.role, content:m.content})), max_output_tokens:max, store:false, stream:false, ...generation};
      break;
    case 'anthropic':
      path = '/messages'; headers['anthropic-version'] = profile.anthropicVersion ?? '2023-06-01';
      body = {model:profile.model, ...(system ? {system} : {}), messages:conversation(request.messages, r => r).map(m => ({role:m.role,content:m.parts.map(p => ({type:'text',text:p.text}))})), max_tokens:max, stream:false, ...generation, ...(request.stop?.length ? {stop_sequences:request.stop} : {})};
      break;
    case 'google':
      path = `/models/${encodeURIComponent(profile.model.replace(/^models\//, ''))}:generateContent`;
      body = {...(system ? {systemInstruction:{parts:[{text:system}]}} : {}), contents:conversation(request.messages, r => r === 'assistant' ? 'model' : 'user'), generationConfig:{maxOutputTokens:max, ...(temperature === undefined ? {} : {temperature}), ...(topP === undefined ? {} : {topP}), ...(request.stop?.length ? {stopSequences:request.stop} : {})}};
      break;
    default: throw new LlmError('CONFIG', 'Unsupported API format.');
  }
  return {url:profile.baseUrl.replace(/\/+$/, '') + path, headers, body};
}
function usage(input, output, total) {
  const safe = n => Number.isFinite(n) && n >= 0 ? n : null;
  const i = safe(input), o = safe(output);
  return {inputTokens:i, outputTokens:o, totalTokens:safe(total) ?? (i !== null && o !== null ? i + o : null)};
}
export function decodeResponse(format, data) {
  requireValue(data && typeof data === 'object' && !data.error, 'Provider returned an invalid response.', 'PROTOCOL');
  let text = '', finishReason, complete = false, u, id = data.id ?? null, model = data.model ?? data.modelVersion ?? null;
  switch (format) {
    case 'oai': {
      const c = data.choices?.[0];
      if (c?.message?.refusal || c?.finish_reason === 'content_filter') throw new LlmError('REFUSED', 'Provider declined the request.');
      requireValue(!c?.message?.tool_calls?.length, 'Tool calls are not supported by this text adapter.', 'PROTOCOL');
      text = typeof c?.message?.content === 'string' ? c.message.content : '';
      finishReason = c?.finish_reason; complete = finishReason === 'stop';
      u = usage(data.usage?.prompt_tokens, data.usage?.completion_tokens, data.usage?.total_tokens); break;
    }
    case 'oai-res': {
      const output = Array.isArray(data.output) ? data.output : [];
      const blocks = output.filter(o => o?.type === 'message').flatMap(o => Array.isArray(o.content) ? o.content : []);
      if (blocks.some(c => c?.type === 'refusal')) throw new LlmError('REFUSED', 'Provider declined the request.');
      text = blocks.filter(c => c?.type === 'output_text' && typeof c.text === 'string').map(c => c.text).join('\n');
      finishReason = data.status === 'incomplete' ? data.incomplete_details?.reason ?? 'incomplete' : data.status;
      complete = data.status === 'completed';
      u = usage(data.usage?.input_tokens, data.usage?.output_tokens, data.usage?.total_tokens); break;
    }
    case 'anthropic':
      requireValue(Array.isArray(data.content), 'Provider response has no content blocks.', 'PROTOCOL');
      if (data.stop_reason === 'refusal') throw new LlmError('REFUSED', 'Provider declined the request.');
      requireValue(!data.content.some(c => c?.type === 'tool_use'), 'Tool calls are not supported by this text adapter.', 'PROTOCOL');
      text = data.content.filter(c => c?.type === 'text' && typeof c.text === 'string').map(c => c.text).join('\n');
      finishReason = data.stop_reason; complete = ['end_turn','stop_sequence'].includes(finishReason);
      u = usage(data.usage?.input_tokens, data.usage?.output_tokens); break;
    case 'google': {
      const c = data.candidates?.[0];
      if (data.promptFeedback?.blockReason || ['SAFETY','RECITATION','BLOCKLIST','PROHIBITED_CONTENT','SPII'].includes(c?.finishReason)) throw new LlmError('REFUSED', 'Provider declined the request.');
      const parts = c?.content?.parts ?? [];
      requireValue(Array.isArray(parts), 'Invalid Google content parts.', 'PROTOCOL');
      requireValue(!parts.some(p => p?.functionCall), 'Tool calls are not supported by this text adapter.', 'PROTOCOL');
      text = parts.filter(p => p && !p.thought && typeof p.text === 'string').map(p => p.text).join('');
      finishReason = c?.finishReason; complete = finishReason === 'STOP';
      u = usage(data.usageMetadata?.promptTokenCount, data.usageMetadata?.candidatesTokenCount, data.usageMetadata?.totalTokenCount);
      id = data.responseId ?? null; break;
    }
    default: throw new LlmError('CONFIG', 'Unsupported API format.');
  }
  requireValue(text.trim(), 'Provider returned no visible text.', 'EMPTY_OUTPUT');
  return {text, complete, finishReason:typeof finishReason === 'string' ? finishReason : 'unknown', usage:u, id:typeof id === 'string' ? id : null, model:typeof model === 'string' ? model : null};
}
