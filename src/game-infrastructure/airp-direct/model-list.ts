import { completionUrl } from "./provider";

export function modelsUrl(baseUrl: string): string {
  return completionUrl(baseUrl).replace(/\/chat\/completions$/, "/models");
}

/** Explicit OpenAI-compatible discovery; never sends a generation request. */
export async function fetchModelIds(baseUrl: string, key: string, signal: AbortSignal, transport: typeof fetch = fetch): Promise<string[]> {
  const url = modelsUrl(baseUrl);
  key = key.trim();
  if (!key || /[\r\n]/.test(key)) throw Error("请先填写当前连接的 API Key。");
  const controller = new AbortController();
  let timedOut = false;
  const abort = () => controller.abort();
  if (signal.aborted) abort(); else signal.addEventListener("abort", abort, { once: true });
  const timeout = setTimeout(() => { timedOut = true; abort(); }, 15000);
  try {
    controller.signal.throwIfAborted();
    let response: Response;
    try {
      response = await transport(url, { method: "GET", mode: "cors", credentials: "omit", redirect: "error", cache: "no-store",
        headers: { Accept: "application/json", Authorization: `Bearer ${key}` }, signal: controller.signal });
    } catch {
      if (controller.signal.aborted) throw Error(timedOut ? "获取模型列表超时，请稍后重试。" : "已取消获取模型列表。");
      throw Error("无法获取模型列表，请检查网络、API 地址及接口跨域支持；也可手动填写模型 ID。");
    }
    if (response.status === 401 || response.status === 403) throw Error("无法读取模型列表，请检查当前连接的 Key 和权限。");
    if (response.status === 404 || response.status === 405) throw Error("此接口未提供模型列表，请手动填写模型 ID。");
    if (!response.ok) throw Error(`获取模型列表失败（HTTP ${response.status}），请稍后重试或手动填写。`);
    if (!response.body) throw Error("接口没有返回模型列表。");
    const reader = response.body.getReader(), decoder = new TextDecoder();
    let text = "", bytes = 0;
    try {
      for (;;) {
        const chunk = await reader.read();
        if (chunk.done) break;
        bytes += chunk.value.byteLength;
        if (bytes > 2 * 1024 * 1024) throw Error("模型列表过大，请手动填写模型 ID。");
        text += decoder.decode(chunk.value, { stream: true });
      }
      text += decoder.decode();
    } catch (error) {
      if (controller.signal.aborted) throw Error(timedOut ? "获取模型列表超时，请稍后重试。" : "已取消获取模型列表。");
      if (bytes > 2 * 1024 * 1024) throw error;
      throw Error("模型列表读取中断，请重试。");
    } finally { await reader.cancel().catch(() => {}); reader.releaseLock(); }
    let raw: unknown;
    try { raw = JSON.parse(text); } catch { throw Error("接口未返回有效的模型列表，请手动填写模型 ID。"); }
    const data = raw && typeof raw === "object" && "data" in raw ? raw.data : undefined;
    if (!Array.isArray(data)) throw Error("接口未提供兼容的模型列表，请手动填写模型 ID。");
    const ids = data.flatMap(item => {
      const id = item && typeof item.id === "string" ? item.id.trim() : "";
      return id && id.length <= 200 && !/[\u0000-\u001f\u007f]/.test(id) && !id.includes(key) ? [id] : [];
    });
    return [...new Set(ids)].sort((a, b) => a.localeCompare(b));
  } finally { clearTimeout(timeout); signal.removeEventListener("abort", abort); }
}
