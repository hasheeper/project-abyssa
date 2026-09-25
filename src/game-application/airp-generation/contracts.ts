import { canonicalJson, sha256, utf8Size } from "../../game-core/contracts";
import type { AirpSceneText } from "../airp/contracts";

export const STAGES = ["planning", "writing", "formatting"] as const;
export type GenerationStage = typeof STAGES[number];
export type ModelSlot = "planning" | "writing" | "updater";
export const stageSlot = (stage: GenerationStage): ModelSlot => stage === "formatting" ? "updater" : stage;
export type Message = { role: "system" | "user" | "assistant"; content: string };
export type Sampling = { temperature?: number; top_p?: number; max_tokens?: number };
/** Credentials deliberately have no representation in any application contract. */
export type ModelConfiguration = Sampling & { baseUrl: string; model: string; timeoutMs: number };
export type Models = Record<ModelSlot, ModelConfiguration>;
export type Usage = { inputTokens: number | null; outputTokens: number | null; totalTokens: number | null };
export type CallDiagnostics = { version: 1; model?: string; code?: string; message?: string; httpStatus?: number; requestId?: string; finishReason?: string; responseBody?: string };
export type Completion = { text: string; usage: Usage; finishReason: "stop" | "length" | "unknown"; diagnostics?: CallDiagnostics };
export type CompletionRequest = { config: ModelConfiguration; messages: Message[] };
export type ProbeRecord = {
  id: string; slot: ModelSlot; config: ModelConfiguration; configuration: string;
  status: "succeeded" | "failed" | "interrupted"; text: string | null; usage: Usage;
  error: string | null; outcomeUnknown: boolean; elapsedMs: number;
};
export type SourceDocument = { id: string; kind: "world" | "character" | "player" | "guideline"; path: string; sha256: string; text: string;
  activation?: {always: boolean; keywords: string[]}; brief?: string };
export type Resources = { version: number; sources: SourceDocument[]; planning: string; writing: string; formatting: string; writingTaskRole?: "system" | "user" };
export type SampleContext = {
  sourceKind: "sample"; id: string; version: number; title: string; phase: number;
  location: string; actorIds: string[]; selectedAction: string; outcome: "cleared" | "extracted";
  facts: { id: string; text: string; knownBy: string[] }[];
  memories: { id: string; summary: string; phase: number; actorIds: string[]; sourceId: string; read: boolean }[];
};
export type PresetStage = "planning" | "writing";
export type PresetOrigin = {moduleId: string; sourceSha256: string; fragmentSha256: string; ranges: {start: number; end: number}[]; macros: string[]; adaptation: string};
export type PresetModule = { identifier: string; name: string; role: Message["role"]; content: string; marker: boolean; unsupported: string[]; stages?: PresetStage[]; origin?: PresetOrigin };
export type Preset = { name: string; planningPrefix: string; modules: PresetModule[]; orders: { id: string; entries: { identifier: string; enabled: boolean }[] }[]; sampling: Sampling; notes: string[] };
export type CreativeInput = {
  stage: GenerationStage; material: {resources: Resources; preset: Preset; orderId: string};
  context: unknown; editorContext?: unknown; history: string; playerName: string;
  actors?: Record<string, string>; creation?: string; draft?: string; feedback?: unknown;
  selectedMemoryIds: string[];
};
export type Specification = { playerName: string; sample: SampleContext; resources: Resources; preset: Preset; orderId: string };
export type CompiledInput = { messages: Message[]; bytes: number; diagnostics: string[]; contextHash: string; selectedMemoryIds: string[] };
export type Attempt = {
  id: string; stage: GenerationStage; ordinal: number; startedAt: number; endedAt: number | null;
  input: CompiledInput; config: ModelConfiguration; status: "running" | "succeeded" | "failed" | "interrupted";
  output: string | null; usage: Usage; error: string | null; outcomeUnknown: boolean;
};
export type RunRecord = {
  version: 2; id: string; createdAt: number; spec: Specification; models: Models; inputHash: string;
  status: "running" | "ready" | "failed" | "interrupted"; stage: GenerationStage;
  attempts: Attempt[]; scene: AirpSceneText | null; cursor: number; error: string | null;
};
// Defensive file/request bounds, not a model token budget. Never truncate source material.
export const LIMITS = { inputBytes: 2097152, presetBytes: 2097152, cacheBytes: 4194304, responseBytes: 2097152, maxAttempts: 32 };
export const emptyUsage = (): Usage => ({ inputTokens: null, outputTokens: null, totalTokens: null });
export const hash = (value: unknown) => sha256(canonicalJson(value));
export const bytes = (value: string) => utf8Size(value);
export class GenerationError extends Error {
  constructor(public readonly code: string, message: string, public readonly outcomeUnknown = false, public readonly usage: Usage = emptyUsage(), public diagnostics?: CallDiagnostics) { super(message); this.name = "GenerationError"; }
}
export function check(condition: unknown, message: string, code = "invalid-input"): asserts condition {
  if (!condition) throw new GenerationError(code, message);
}
export function object(raw: unknown): Record<string, unknown> {
  check(!!raw && typeof raw === "object" && !Array.isArray(raw), "需要 JSON 对象。"); return raw as Record<string, unknown>;
}
export function string(raw: unknown, name: string, max = 65536): string {
  check(typeof raw === "string" && raw.length <= max, `${name} 必须是长度受限的文本。`); return raw;
}
export function parseSampling(raw: Record<string, unknown>): Sampling {
  const result: Sampling = {};
  for (const [key, max] of [["temperature", 2], ["top_p", 1], ["max_tokens", 65536]] as const) {
    if (raw[key] === undefined) continue;
    const value = raw[key];
    check(typeof value === "number" && Number.isFinite(value) && value >= 0 && value <= max && (key !== "max_tokens" || Number.isInteger(value) && value > 0), `${key} 数值无效。`);
    result[key] = value;
  }
  return result;
}
export function parseModel(raw: unknown): ModelConfiguration {
  const r = object(raw), baseUrl = string(r.baseUrl, "API 地址", 1000).trim(), model = string(r.model, "模型 ID", 200).trim();
  check(baseUrl && model, "请填写 API 地址和模型 ID。");
  check(typeof r.timeoutMs === "number" && Number.isSafeInteger(r.timeoutMs) && r.timeoutMs >= 1000 && r.timeoutMs <= 300000, "超时须为 1–300 秒。");
  return { baseUrl, model, timeoutMs: r.timeoutMs, ...parseSampling(r) };
}
