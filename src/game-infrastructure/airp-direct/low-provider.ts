import { GenerationError, parseModel, type Completion, type ModelConfiguration, type Usage } from "../../game-application/airp-generation/contracts";
import type { LowRequest } from "../../game-application/airp-low/contracts";
import { completionUrl, createDirectProvider, invalidCompletionMessage } from "./provider";
import { redactCallText, type CallDiagnostics } from "../../game-application/airp-generation/diagnostics";
import { httpErrorDiagnostics, responseDiagnostics } from "./call-log";

/** Native r8 transport. Preserve frozen stream/sampling; read public content only. */
export function createLowProvider(transport: typeof fetch = fetch) {
  const direct = createDirectProvider(transport);
  return async (request: LowRequest, config: ModelConfiguration, key: string, signal: AbortSignal): Promise<Completion> => {
    if (request.stage === "formatting") return direct({ config, messages: request.messages }, key, signal);
    if (!key.trim() || /[\r\n]/.test(key)) throw new GenerationError("missing-key", "请前往设置填写并保存正文连接。");
    key = key.trim();
    const parsed = parseModel(config), url = completionUrl(parsed.baseUrl), sampling = request.sampling!;
    const controller = new AbortController(), abort = () => controller.abort(); let timedOut = false;
    if (signal.aborted) abort(); else signal.addEventListener("abort", abort, { once: true });
    const timer = setTimeout(() => { timedOut = true; abort(); }, parsed.timeoutMs);
    let dispatched = false, text = "", finish: string | null = null, refused = false, tools = false, nonText = false;
    let diagnostics: CallDiagnostics = { version: 1 };
    let usage: Usage = { inputTokens: null, outputTokens: null, totalTokens: null };
    try {
      controller.signal.throwIfAborted(); dispatched = true;
      const response = await transport(url, { method: "POST", mode: "cors", credentials: "omit", redirect: "error", cache: "no-store", signal: controller.signal,
        headers: { "Content-Type": "application/json", Accept: "text/event-stream", Authorization: `Bearer ${key.trim()}` }, body: JSON.stringify({ model: parsed.model, messages: request.messages, ...sampling }) });
      diagnostics = responseDiagnostics(response, key);
      if (!response.ok) { diagnostics = await httpErrorDiagnostics(response, key); throw new GenerationError("http-error", `正文端点返回HTTP ${response.status}，详情已保存在调用记录。`, response.status >= 500); }
      if (!response.body) throw new GenerationError("invalid-response", "正文响应为空。", true);
      const accept = (raw: any) => {
        if (!diagnostics.requestId && typeof raw?.id === "string") diagnostics.requestId = redactCallText(raw.id, [key]).slice(0, 500);
        if (raw?.error) { diagnostics.responseBody = redactCallText(JSON.stringify(raw.error), [key]).slice(0, 16000); throw new GenerationError("upstream-error", "上游在响应流中返回错误，详情见调用记录。", true, usage); }
        const choice = raw?.choices?.[0], m = choice?.delta ?? choice?.message;
        if (typeof m?.content === "string") text += m.content;
        else if (m?.content != null) nonText = true;
        finish = choice?.finish_reason ?? finish; refused ||= !!m?.refusal; tools ||= !!m?.tool_calls?.length;
        if (raw?.usage) { const count = (n: unknown) => typeof n === "number" && Number.isSafeInteger(n) && n >= 0 ? n : null; usage = { inputTokens: count(raw.usage.prompt_tokens), outputTokens: count(raw.usage.completion_tokens), totalTokens: count(raw.usage.total_tokens) }; }
      };
      const stream = response.headers.get("content-type")?.includes("text/event-stream"), reader = response.body.getReader(), decoder = new TextDecoder(); let size = 0, buffer = "";
      const line = (value: string) => { if (value.startsWith("data:")) { const data = value.slice(5).trim(); if (data && data !== "[DONE]") accept(JSON.parse(data)); } };
      try {
        for (;;) { const c = await reader.read(); if (c.done) break; size += c.value.byteLength; if (size > 4 * 1024 * 1024) throw new GenerationError("response-size", "正文响应超过容量。", true, usage); buffer += decoder.decode(c.value, { stream: true });
          if (stream) { let at; while ((at = buffer.indexOf("\n")) >= 0) { line(buffer.slice(0, at).replace(/\r$/, "")); buffer = buffer.slice(at + 1); } }
        }
        buffer += decoder.decode(); if (stream) { if (buffer.trim()) line(buffer); } else accept(JSON.parse(buffer));
      } finally { await reader.cancel().catch(() => {}); reader.releaseLock(); }
      if (text.includes(key.trim())) throw new GenerationError("credential-in-output", "正文响应包含凭据，拒绝保存。", true, usage);
      if (finish === "content_filter" || refused) throw new GenerationError("content-filter", "正文被接口内容过滤；未接纳为成功，也未自动重发。", false, usage);
      if (request.acceptPartialDraft && text.trim() && !tools && !nonText && (finish === "length" || finish === null)) {
        diagnostics.finishReason = finish ?? "missing";
        diagnostics.message = finish === "length" ? "正文达到输出上限；原稿已保留，交由后处理判断可用叙事，不自动续写。" : "响应缺少结束标记；已收到的原稿交给后处理，不重发正文。";
        controller.signal.throwIfAborted(); return { text, usage, finishReason: finish === "length" ? "length" : "unknown", diagnostics };
      }
      if (finish === "length") throw new GenerationError("truncated", "正文达到接口输出上限而截断；未自动修复或重发。", false, usage);
      if (finish !== "stop" || tools || nonText || !text.trim()) throw new GenerationError("invalid-response", invalidCompletionMessage(finish, text, tools, refused, nonText), false, usage);
      diagnostics.finishReason = finish;
      controller.signal.throwIfAborted(); return { text, usage, finishReason: "stop" as const, diagnostics };
    } catch (e) {
      diagnostics.finishReason = finish ?? "missing";
      if (text && !diagnostics.responseBody) diagnostics.responseBody = redactCallText(text, [key]).slice(0, 16000);
      if (controller.signal.aborted) throw new GenerationError(timedOut ? "timeout" : "cancelled", "正文请求中断，供应商结果可能未知。", dispatched, usage, diagnostics);
      if (e instanceof GenerationError) { e.diagnostics = diagnostics; throw e; }
      if (e instanceof SyntaxError) throw new GenerationError("invalid-response", "接口响应格式不正确，请查看调用记录并检查端点。", dispatched, usage, diagnostics);
      throw new GenerationError("network", "正文网络或响应协议错误；没有自动重试。", dispatched, usage, { ...diagnostics, message: redactCallText(String(e), [key]).slice(0, 16000) });
    } finally { clearTimeout(timer); signal.removeEventListener("abort", abort); }
  };
}
