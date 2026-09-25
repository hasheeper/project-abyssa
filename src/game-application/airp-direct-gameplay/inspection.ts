import type { D5GameRecord } from "../index";
import { check, hash } from "../airp-generation/contracts";
import { compileDirectInput, checkDirectInputHash } from "./compile";
import { readTextForUpdate } from "./reducer";

/** Reconstruct a historical attempt from immutable material, prior outputs and read proof. */
export function inspectDirectAttempt(record: D5GameRecord, sceneId: string, attemptId: string) {
  const direct = record.airpDirect, narrative = record.narrative;
  const task = direct?.tasks.find(t => t.sceneId === sceneId);
  check(direct && narrative?.version === 2 && task?.context && task.materialHash, "缺少完整冻结材料。");
  const index = task.attempts.findIndex(a => a.id === attemptId);
  check(index >= 0, "找不到阶段记录。");
  const attempt = task.attempts[index], material = direct.materials[task.materialHash];
  const input = compileDirectInput(material, task.context, {...task, attempts: task.attempts.slice(0, index)}, attempt.stage,
    attempt.stage === "updater" ? readTextForUpdate(narrative, task) : undefined);
  checkDirectInputHash(attempt.inputHash, input);
  return {attempt, input, inputHash: hash(input), materialHash: task.materialHash, source: task.context};
}

/** Shareable inspection, explicitly not a restorable archive after endpoint redaction. */
export function exportDirectDiagnostic(record: D5GameRecord) {
  return JSON.stringify({kind: "airp-direct-diagnostic", version: 1, restorable: false, head: record.head,
    contentRef: record.contentRef, direct: record.airpDirect,
    attempts: record.airpDirect?.tasks.flatMap(t => t.attempts.map(a => inspectDirectAttempt(record, t.sceneId, a.id)))},
  (key, value) => key === "baseUrl" ? "[configured-endpoint]" : value, 2);
}
