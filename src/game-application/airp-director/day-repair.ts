import * as v from "../../game-core/contracts";
import { validateDirectorPlan, directorHash } from "../../game-core/session";
import { LIMITS } from "../airp-generation/contracts";
import type { DirectorJob, DirectorPreparedInput } from "./contracts";
import { correctionEnvelope } from "../airp-memory/effective";

// model-consult/Fable t-e7221051: only technical retry, not a new narrative policy.
const instruction = "上次日程未通过程序校验，原提案与具体校验错误随后作为独立数据块给出。保留其中仍合法的安排及其依据，只修正导致失败的字段，重新交付完整日程JSON。focus是重点容量槽，只指向load=focus的重点安排，不表示当日最想安排的事项；若本日只安排light小景，且没有已有重点或必要剧情，focus填null。不为修正focus字段新增事件。";

/** Explicit, versioned attempt: keep every original message and the rejected proposal. */
export function compileDayRepair(input: DirectorPreparedInput, job: DirectorJob): DirectorPreparedInput {
  const previous = job.attempts.filter(a => a.stage === "director" && a.status !== "running").at(-1);
  if (job.kind !== "day" || input.stage !== "director" || !job.planning || previous?.error !== "invalid-output" || !previous.output)
    v.invalid("director.repair", "Repair needs a stored invalid day proposal");
  let issue: { path: string; message: string } | null = null;
  try {
    const proposal = v.parseDirectorPlan(correctionEnvelope(JSON.parse(previous.output), !!job.gmContext?.memoryContext));
    if (!proposal.entries.some(e => e.source.kind === "free")) validateDirectorPlan({ ...job.planning, proposal });
  } catch (error) {
    const path = (error as { path?: unknown })?.path;
    issue = { path: typeof path === "string" ? path : "director.json", message: error instanceof SyntaxError ? "Invalid JSON syntax" : error instanceof Error ? error.message : "Invalid day proposal" };
  }
  if (!issue) v.invalid("director.repair", "Stored rejection has no reproducible proposal error; inspect instead of resending");
  const data = { previousAttemptId: previous.id, previousProposal: previous.output, validation: issue };
  const messages = [...input.messages, { role: "user" as const, content: `${instruction}\n${v.canonicalJson(data)}` }];
  const bytes = messages.reduce((n, m) => n + v.utf8Size(m.content), 0);
  if (bytes > LIMITS.inputBytes) v.invalid("director.repair", "Full retry input exceeds capacity; nothing was trimmed", "airp-capacity");
  return { ...input, messages, bytes, contextHash: directorHash([input.contextHash, 1, data]), diagnostics: [...input.diagnostics, "日度JSON显式技术修复v1；原资料与前次失败保留"] };
}
