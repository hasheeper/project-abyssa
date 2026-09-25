import * as v from "../../game-core/contracts";
import { GenerationError, type CallDiagnostics } from "./contracts";

/** Local call record. Never contains request headers, keys or endpoint addresses. */
export type { CallDiagnostics } from "./contracts";
export function redactCallText(text: string, secrets: string[] = []): string {
  for (const secret of secrets.filter(Boolean)) text = text.split(secret).join("[凭据已隐藏]");
  return text.replace(/(?:https?:\/\/)[^\s<>"']+/gi, "[地址已隐藏]")
    .replace(/\bBearer\s+[^\s"',;}]+/gi, "Bearer [已隐藏]")
    .replace(/\bsk-[\w-]+/g, "[凭据已隐藏]")
    .replace(/((?:api[_-]?key|authorization|access[_-]?token|password)["']?\s*[:=]\s*["']?)[^\s"',;}]+/gi, "$1[已隐藏]");
}
export function parseCallDiagnostics(raw: unknown): CallDiagnostics {
  const r = v.record(raw, "callLog", ["version"], ["model", "code", "message", "httpStatus", "requestId", "finishReason", "responseBody"]);
  const result: CallDiagnostics = { version: v.choice(r.version, [1] as const, "callLog.version") };
  for (const key of ["model", "code", "message", "requestId", "finishReason", "responseBody"] as const) if (r[key] !== undefined) result[key] = v.text(r[key], `callLog.${key}`, 20000);
  if (r.httpStatus !== undefined) result.httpStatus = v.number(r.httpStatus, "callLog.httpStatus", 100, 599);
  return result;
}
export function callDiagnostics(error: unknown, model: string, secrets: string[] = []): CallDiagnostics {
  const detail = error instanceof GenerationError ? error.diagnostics?.message : undefined;
  const d: CallDiagnostics = { version: 1, ...(error instanceof GenerationError ? error.diagnostics : {}), model,
    ...(error == null ? {} : { code: error instanceof GenerationError ? error.code : "unexpected-error", message: (error instanceof Error ? error.message : String(error)) + (detail ? `\n${detail}` : "") }) };
  for (const key of ["model", "code", "message", "requestId", "finishReason", "responseBody"] as const) if (d[key]) d[key] = redactCallText(d[key], secrets).slice(0, 20000);
  return d;
}
