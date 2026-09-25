import { redactCallText, type CallDiagnostics } from "../../game-application/airp-generation/diagnostics";

export function responseDiagnostics(response: Response, key: string): CallDiagnostics {
  const requestId = response.headers.get("x-request-id") ?? response.headers.get("request-id") ?? response.headers.get("cf-ray");
  return { version: 1, httpStatus: response.status, ...(requestId ? { requestId: redactCallText(requestId, [key]).slice(0, 500) } : {}) };
}
export async function httpErrorDiagnostics(response: Response, key: string): Promise<CallDiagnostics> {
  const d = responseDiagnostics(response, key);
  if (!response.body) return d;
  const reader = response.body.getReader(), decoder = new TextDecoder(); let text = "", size = 0;
  try {
    for (;;) {
      const chunk = await reader.read(); if (chunk.done) break;
      const remaining = 16384 - size; text += decoder.decode(chunk.value.subarray(0, remaining), { stream: true }); size += chunk.value.length;
      if (size >= 16384) { text += "\n[错误正文已截至16KiB]"; break; }
    }
    text += decoder.decode();
  } catch { text += "\n[错误正文读取中断]"; }
  finally { await reader.cancel().catch(() => {}); reader.releaseLock(); }
  if (text.trim()) d.responseBody = redactCallText(text, [key]);
  return d;
}
