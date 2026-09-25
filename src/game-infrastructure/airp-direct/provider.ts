import { GenerationError, LIMITS, parseModel, type Completion, type CompletionRequest, type Usage } from "../../game-application/airp-generation/contracts";
import { redactCallText, type CallDiagnostics } from "../../game-application/airp-generation/diagnostics";
import { httpErrorDiagnostics, responseDiagnostics } from "./call-log";

export function completionUrl(baseUrl: string): string {
  let url: URL; try { url = new URL(baseUrl.trim()); } catch { throw new GenerationError("invalid-address", "请填写完整的 HTTP(S) API 地址。"); }
  if (!["https:", "http:"].includes(url.protocol) || url.username || url.password || url.search || url.hash)
    throw new GenerationError("invalid-address", "API 地址不能含凭据、查询参数或片段。");
  url.pathname = url.pathname.replace(/\/+$/, "");
  if (!url.pathname.endsWith("/chat/completions")) url.pathname += "/chat/completions";
  return url.href;
}
/** A failed response keeps its existing error code; explain which part was unusable. */
export function invalidCompletionMessage(finish: string | null, text: string, tools: boolean, refused = false, nonText = false): string {
  if (refused || finish === "content_filter") return "接口拒绝提供正文，请查看调用记录。";
  if (tools || finish === "tool_calls") return "接口返回了工具调用，没有可用正文；请检查模型设置后重试。";
  if (nonText) return "接口正文不是文本，请检查所选模型的文本输出支持。";
  if (!text.trim()) return "接口没有返回正文，请查看调用记录后重试。";
  return "接口未正常结束，请查看调用记录后重试。";
}
function usage(raw: unknown): Usage {
  const u = raw && typeof raw === "object" ? raw as Record<string, unknown> : {};
  const count = (n: unknown) => typeof n === "number" && Number.isSafeInteger(n) && n >= 0 ? n : null;
  return { inputTokens: count(u.prompt_tokens), outputTokens: count(u.completion_tokens), totalTokens: count(u.total_tokens) };
}
function upstreamHint(text: string): string {
    if (/context.length|maximum context|too many tokens|input.{0,30}too (long|large)|prompt.{0,30}too (long|large)|上下文.{0,15}(超|限)|token.{0,30}(exceed|limit)/i.test(text)) return "上游报告输入／上下文容量限制，未删减原文";
    if (/max_tokens|unsupported.parameter|invalid.parameter|temperature|top_p/i.test(text)) return "上游报告请求参数不兼容，未自动降额或重发";
    if (/insufficient.quota|insufficient.balance|余额不足|额度不足/i.test(text)) return "上游报告余额／额度不足";
    if (/rate.limit|too many requests|限流/i.test(text)) return "上游报告限流";
    if (/model.{0,30}(not found|not exist|unavailable)|无可用渠道|模型.{0,15}(不存在|不可用)/i.test(text)) return "上游报告模型／渠道不可用";
    return "上游错误详情见调用记录。";
}
export function createDirectProvider(transport: typeof fetch = fetch) {
  return async (request: CompletionRequest, key: string, external: AbortSignal): Promise<Completion> => {
    if (!key.trim() || /[\r\n]/.test(key)) throw new GenerationError("missing-key", "请前往设置填写并保存 API 连接。");
    key = key.trim();
    const config = parseModel(request.config), url = completionUrl(config.baseUrl);
    const controller = new AbortController(); let timedOut = false;
    const abort = () => controller.abort();
    if (external.aborted) abort(); else external.addEventListener("abort", abort, { once: true });
    const timeout = setTimeout(() => { timedOut = true; abort(); }, config.timeoutMs);
    let dispatched = false, diagnostics: CallDiagnostics = { version: 1 };
    try {
      controller.signal.throwIfAborted(); dispatched = true;
      const response = await transport(url, { method: "POST", mode: "cors", credentials: "omit", redirect: "error", cache: "no-store", signal: controller.signal,
        headers: { "Content-Type": "application/json", Accept: "application/json", Authorization: `Bearer ${key.trim()}` },
        body: JSON.stringify({ model: config.model, messages: request.messages, stream: false,
          ...(config.temperature === undefined ? {} : { temperature: config.temperature }), ...(config.top_p === undefined ? {} : { top_p: config.top_p }), ...(config.max_tokens === undefined ? {} : { max_tokens: config.max_tokens }) }),
      });
      if (!response.ok) {
        diagnostics = await httpErrorDiagnostics(response, key);
        const hint = upstreamHint(diagnostics.responseBody ?? "");
        const code = response.status === 401 || response.status === 403 ? "authentication" : response.status === 429 ? "rate-limit" : "http-error";
        throw new GenerationError(code, code === "authentication" ? "认证失败，请检查当前端点的 Key 和模型权限。" : code === "rate-limit" ? "端点限流，请稍后手动重试。" : `端点返回 HTTP ${response.status}。${hint}`, response.status >= 500);
      }
      diagnostics = responseDiagnostics(response, key);
      if (!response.body) throw new GenerationError("invalid-response", "端点返回了空响应。", true);
      const reader = response.body.getReader(), decoder = new TextDecoder(); let received = 0, text = "";
      try {
        while (true) { const item = await reader.read(); if (item.done) break; received += item.value.byteLength;
          if (received > LIMITS.responseBytes) { await reader.cancel(); throw new GenerationError("response-size", "响应超过2 MiB。", true); }
          text += decoder.decode(item.value, { stream: true }); }
        text += decoder.decode();
      } finally { reader.releaseLock(); }
      let raw: any; try { raw = JSON.parse(text); } catch { diagnostics.responseBody = redactCallText(text, [key]).slice(0, 16000) || "[空响应]"; throw new GenerationError("invalid-response", "端点未返回 Chat Completions JSON。", true); }
      const choice = raw?.choices?.[0];
      diagnostics.finishReason = String(choice?.finish_reason ?? "missing");
      if (!diagnostics.requestId && typeof raw?.id === "string") diagnostics.requestId = redactCallText(raw.id, [key]).slice(0, 500);
      diagnostics.responseBody = redactCallText(typeof choice?.message?.content === "string" ? choice.message.content : text, [key]).slice(0, 16000) || "[空响应]";
      const knownUsage = usage(raw?.usage);
      if (choice?.finish_reason === "length") throw new GenerationError("truncated", "模型输出被截断，请检查输出额度后开启新任务。", false, knownUsage);
      const content = choice?.message?.content;
      if (choice?.finish_reason !== "stop" || choice?.message?.tool_calls?.length || choice?.message?.refusal || typeof content !== "string" || !content.trim())
        throw new GenerationError("invalid-response", invalidCompletionMessage(choice?.finish_reason ?? null,
          typeof content === "string" ? content : "", !!choice?.message?.tool_calls?.length, !!choice?.message?.refusal,
          content != null && typeof content !== "string"), false, knownUsage);
      if (choice.message.content.includes(key.trim())) throw new GenerationError("invalid-response", "响应包含凭据，已拒绝保存。", true);
      controller.signal.throwIfAborted();
      delete diagnostics.responseBody;
      return { text: choice.message.content, usage: knownUsage, finishReason: "stop", diagnostics };
    } catch (error) {
      if (controller.signal.aborted) throw new GenerationError(timedOut ? "timeout" : "cancelled", timedOut ? "等待超时，供应商端结果未知。" : "调用已取消，供应商端可能仍在执行。", dispatched, undefined, diagnostics);
      if (error instanceof GenerationError) { error.diagnostics = diagnostics; throw error; }
      throw new GenerationError("network", "网络／跨域请求失败，请检查浏览器网络记录、HTTPS与端点CORS设置。", dispatched, undefined, { ...diagnostics, responseBody: redactCallText(String(error), [key]).slice(0, 16000) });
    } finally { clearTimeout(timeout); external.removeEventListener("abort", abort); }
  };
}
