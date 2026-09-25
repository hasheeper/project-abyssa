import { compileInput } from "./context";
import { acceptGeneratedText } from "./scene";
import { readWritingOutput } from "./writing";
import { bytes, check, hash, LIMITS, parseModel, stageSlot, STAGES, type GenerationStage, type Models, type RunRecord, type Specification } from "./contracts";
import * as v from "../../game-core/contracts";
import { planningPreflight, usesCreativeProtocol, validateCreativeStage } from "./creative-output";

export function lastOutput(run: RunRecord, stage: GenerationStage): string {
  return run.attempts.filter(a => a.stage === stage && a.status === "succeeded").at(-1)?.output ?? "";
}
export function lastProse(run: RunRecord): string {
  const output = lastOutput(run, "writing");
  return output ? readWritingOutput(output, run.spec.resources.version).prose : "";
}
export function createRun(id: string, createdAt: number, spec: Specification, inputModels: Models): RunRecord {
  const models: Models = { planning: parseModel(inputModels.planning), writing: parseModel(inputModels.writing), updater: parseModel(inputModels.updater) };
  const frozen = structuredClone(spec);
  compileInput("planning", frozen);
  // Validate the selected imported preset before the first paid request.
  compileInput("writing", frozen, planningPreflight(frozen.resources.version));
  return { version: 2, id, createdAt, spec: frozen, models, inputHash: hash({ spec: frozen, models }), status: "running", stage: "planning", attempts: [], scene: null, cursor: 0, error: null };
}

/** Cache is a local preview, never an accepted game save or evidence of player action. */
export function restoreRun(text: string): RunRecord {
  check(bytes(text) <= LIMITS.cacheBytes, "试读缓存超过4 MiB。");
  const r = JSON.parse(text) as RunRecord;
  v.assertJson(r);
  v.record(r, "run", ["version", "id", "createdAt", "spec", "models", "inputHash", "status", "stage", "attempts", "scene", "cursor", "error"]);
  check(r && r.version === 2 && typeof r.id === "string" && typeof r.createdAt === "number" && Array.isArray(r.attempts) && r.attempts.length <= LIMITS.maxAttempts, "试读记录格式无效或属于旧摘要版。");
  check(STAGES.includes(r.stage) && ["running", "ready", "failed", "interrupted"].includes(r.status), "试读状态无效。");
  const validated = createRun(r.id, r.createdAt, r.spec, r.models);
  check(validated.inputHash === r.inputHash && hash(validated.models) === hash(r.models), "试读输入摘要不一致。");
  v.text(r.id, "run.id", 200); v.number(r.createdAt, "createdAt");
  if (r.error !== null) v.text(r.error, "run.error", 2000);
  check(Number.isSafeInteger(r.cursor) && r.cursor >= 0, "阅读位置无效。");
  const replay: RunRecord = { ...validated, attempts: [] };
  for (const a of r.attempts) {
    v.record(a, "attempt", ["id", "stage", "ordinal", "startedAt", "endedAt", "input", "config", "status", "output", "usage", "error", "outcomeUnknown"]);
    check(a && STAGES.includes(a.stage) && typeof a.id === "string" && Number.isFinite(a.startedAt) && (a.endedAt === null || Number.isFinite(a.endedAt)), "阶段记录无效。");
    parseModel(a.config);
    check(hash(a.config) === hash(r.models[stageSlot(a.stage)]), "阶段模型与冻结配置不一致。");
    const prior = replay.attempts.filter(p => p.stage === a.stage), previous = prior.at(-1);
    check(!replay.attempts.some(p => p.id === a.id) && a.ordinal === prior.length + 1 && !lastOutput(replay, a.stage), "阶段尝试身份或顺序无效。");
    check(a.stage !== "formatting" || prior.length < 2, "格式化尝试次数超限。");
    if (a.stage !== "planning") check(lastOutput(replay, "planning"), "缺少成功大纲。");
    if (a.stage === "formatting") check(lastOutput(replay, "writing"), "缺少成功正文。");
    check(["running", "succeeded", "failed", "interrupted"].includes(a.status) && (a.output === null || typeof a.output === "string") && Array.isArray(a.input?.messages), "阶段输出无效。");
    check(a.input.messages.every(m => ["system", "user", "assistant"].includes(m.role) && typeof m.content === "string") && a.input.messages.reduce((n, m) => n + bytes(m.content), 0) <= LIMITS.inputBytes, "阶段输入无效。");
    const expected = compileInput(a.stage, r.spec, lastOutput(replay, "planning"), lastProse(replay), a.stage === "formatting" && previous?.output ? { previousOutput: previous.output, error: previous.error ?? "请按严格JSON及原文保真规则修复。" } : undefined);
    check(hash(a.input) === hash(expected), "阶段消息与冻结输入不一致。");
    v.record(a.usage, "usage", ["inputTokens", "outputTokens", "totalTokens"]);
    check(a.usage && Object.values(a.usage).every(v => v === null || Number.isSafeInteger(v) && v >= 0), "用量记录无效。");
    v.boolean(a.outcomeUnknown, "outcomeUnknown"); if (a.error !== null) v.text(a.error, "attempt.error", 2000);
    if (a.status === "succeeded") check(a.output?.trim() && a.endedAt !== null && a.error === null, "成功阶段缺少完整输出。");
    if (a.status === "succeeded" && usesCreativeProtocol(r.spec.resources.version) && a.stage !== "formatting") validateCreativeStage(a.stage, a.output!, lastOutput(replay, "planning"), undefined, r.spec.resources.version);
    else if (a.status === "succeeded" && a.stage === "writing") readWritingOutput(a.output!, r.spec.resources.version);
    check(a.endedAt === null || a.endedAt >= a.startedAt, "阶段时间无效。");
    replay.attempts.push(a);
  }
  if (r.status === "ready" || r.scene !== null) {
    const scene = acceptGeneratedText(lastOutput(r, "formatting"), lastProse(r), r.spec.resources.version);
    check(hash(scene) === hash(r.scene) && r.cursor < scene.lines.length, "冻结场景或阅读位置损坏。");
  }
  if (r.status === "running") {
    r.status = "interrupted"; r.error = "页面在生成时离开，供应商端结果未知；不会自动重发。";
    r.attempts.forEach(a => { if (a.status === "running") { a.status = "interrupted"; a.outcomeUnknown = true; a.error = r.error; } });
  }
  return r;
}
