/** Read-only native evidence capture. Does not invoke models or access credentials. */
import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
const out = resolve(process.argv[2]);
const journal = JSON.parse(await readFile(resolve(out, 'journal.json'), 'utf8'));
const binding = journal.record.airpOnline.connection.binding;
const get = async path => {
  const response = await fetch(journal.baseUrl + path, { signal: AbortSignal.timeout(20000) });
  const envelope = await response.json();
  if (!response.ok) throw Error(`${response.status}: ${envelope.error?.code}`);
  return envelope.data;
};
const pages = [], seen = new Set();
let cursor = null;
do {
  const page = await get(`/conversation-threads/${binding.threadId}/timeline?branchId=${binding.branchId}&limit=50${cursor === null ? '' : `&cursor=${cursor}`}`);
  pages.push(page); cursor = page.timeline.nextCursor;
  if (cursor != null && seen.has(cursor)) throw Error('Repeated native cursor');
  seen.add(cursor);
} while (cursor != null);
const floors = pages.flatMap(p => p.timeline.floors);
const runIds = [...new Set(floors.flatMap(f => f.checkpoint.snapshot?.executions.map(e => e.runId).filter(Boolean) ?? []))];
const runs = await Promise.all(runIds.map(async id => {
  const execution = await get(`/runs/${id}/execution?detail=full`);
  const contexts = await Promise.all(execution.invocations.map(i => get(`/invocations/${i.invocation.id}/context?detail=full`)));
  return { execution, contexts };
}));
const summary = {
  capturedAt: new Date().toISOString(), baseUrl: journal.baseUrl, releaseId: journal.releaseId,
  playerSessionId: binding.sessionId, developmentSessionId: journal.developmentBinding.sessionId,
  floors: floors.map(f => ({ id: f.id, lifecycle: f.lifecycle, restorable: f.checkpoint.snapshot?.restorable, incompleteReasons: f.checkpoint.incompleteReasons })),
  runs: runs.map(({ execution: e, contexts }) => ({
    id: e.run.id, status: e.run.status, errorCode: e.run.errorCode,
    stage: e.details?.envelope?.stage?.key, retryOfRunId: e.run.retryOfRunId,
    elapsedMs: e.run.completedAt == null ? null : e.run.completedAt - e.run.startedAt,
    outputChars: e.details?.pipelineResult?.outputText.length ?? 0,
    attempts: e.invocations.flatMap(i => i.attempts.map(a => ({ modelTargetId: i.invocation.modelTargetId, status: a.status, usage: a.usage, finishReason: a.finishReason }))),
    inputs: contexts.map(c => ({ invocationId: c.invocation.id, inputTokensEstimate: c.details?.evidence?.request.estimatedInputTokens, roles: c.details?.evidence?.request.prepared.messages.map(m => m.role) })),
  })),
};
await writeFile(resolve(out, 'native-evidence.json'), JSON.stringify({ pages, runs }, null, 2));
await writeFile(resolve(out, 'native-summary.json'), JSON.stringify(summary, null, 2));
console.log(JSON.stringify(summary, null, 2));
