/** Check native provenance/recall; optionally replay only an already committed test run. */
import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { createAirpRpHttpClient } from '../src/game-infrastructure/airp/rp-http-client.ts';

const out = resolve(process.argv[2]);
const journal = JSON.parse(await readFile(resolve(out, 'journal.json'), 'utf8'));
const evidence = JSON.parse(await readFile(resolve(out, 'native-evidence.json'), 'utf8'));
assert.equal(journal.status, 'passed', 'Never replay an incomplete acceptance run');
const entries = journal.record.airpOnline.entries;
const floors = evidence.pages.flatMap(p => p.timeline.floors);
assert.equal(entries.length, 2); assert.equal(floors.length, 4);
const completed = evidence.runs.filter(r => r.execution.run.status === 'completed');
const failed = evidence.runs.filter(r => r.execution.run.status === 'failed');
assert.equal(completed.length, 8);
assert.equal(evidence.runs.length, completed.length + failed.length, 'No unfinished or unknown run status');
assert.ok(failed.length <= 4, 'At most one native retry per formatter or required updater');
assert.notEqual(journal.developmentBinding.sessionId, journal.record.airpOnline.connection.binding.sessionId);
assert.deepEqual(journal.record.snapshot.campaign.funds, journal.sourceFunds);
for (const floor of floors) {
  assert.equal(floor.lifecycle, 'committed');
  assert.equal(floor.checkpoint.snapshot.restorable, true);
  assert.deepEqual(floor.checkpoint.incompleteReasons, []);
}
const acceptedUpdaterIds = new Set();
const summaries = entries.map(entry => {
  assert.equal(entry.source, 'generated');
  const floor = floors.find(f => f.id === entry.controlReceipt.floorId);
  const step = floor.checkpoint.snapshot.stateLedger.steps.find(s => s.kind === 'proposal');
  assert.equal(step.outcome, 'accepted-change');
  acceptedUpdaterIds.add(step.updaterRunId);
  const run = evidence.runs.find(r => r.execution.run.id === step.updaterRunId);
  const patch = JSON.parse(run.execution.details.pipelineResult.outputText);
  assert.equal(patch.operations.length, 1);
  assert.equal(patch.operations[0].path, `/memories/${entry.ticket.request.requestId}/summary`);
  assert.ok(patch.operations[0].value.length > 0);
  return patch.operations[0].value;
});
for (const prior of failed) {
  const retry = completed.find(r => r.execution.run.retryOfRunId === prior.execution.run.id);
  assert.ok(retry, 'Every failure must have a successful native retry');
  assert.equal(prior.execution.run.errorCode, 'RUNTIME_INPUT_INVALID');
  const messages = r => r.contexts[0].details.evidence.request.prepared.messages;
  if (retry.execution.details.envelope.workflow?.nodeKey === 'formatting') {
    const user = r => messages(r).filter(m => m.role === 'user').map(m => JSON.parse(m.content));
    assert.deepEqual(user(retry).slice(0, 2), user(prior).slice(0, 2), 'Formatter repair retains the exact outline and frozen prose');
    const feedback = JSON.parse(user(retry)[2]);
    assert.equal(feedback.previous.previousRunId, prior.execution.run.id);
    assert.ok(feedback.previous.previousOutput.length > 0);
    assert.ok(feedback.previous.error.length > 0);
  } else {
    assert.ok(acceptedUpdaterIds.has(retry.execution.run.id));
    const user = r => messages(r).filter(m => m.role === 'user').map(m => JSON.parse(m.content));
    assert.deepEqual(user(retry).slice(0, 4), user(prior).slice(0, 4), 'Updater retry retains frozen state, trusted text and policy');
    const feedback = JSON.parse(user(retry)[4]);
    assert.equal(feedback.previous.previousRunId, prior.execution.run.id);
    assert.equal(feedback.previous.previousOutput, prior.execution.details.attemptPartials.at(-1).partialText);
    assert.equal(feedback.previous.error, prior.execution.run.errorMessage);
  }
}
const followup = floors.find(f => f.id === entries[1].accepted.result.origin.floorId);
const recalledBy = [];
for (const step of followup.checkpoint.snapshot.executions.filter(s => s.runId)) {
  const run = evidence.runs.find(r => r.execution.run.id === step.runId);
  if (!['outline', 'writing'].includes(run.execution.details.envelope.workflow?.nodeKey)) continue;
  for (const context of run.contexts) {
    const messages = context.details.evidence.request.prepared.messages;
    const task = messages.map(m => { try { return JSON.parse(m.content); } catch { return null; } }).find(x => x?.prepared);
    const prepared = JSON.parse(task.prepared);
    assert.deepEqual(prepared.selection.selectedIds, [entries[0].ticket.request.requestId]);
    assert.deepEqual(prepared.bond.confirmedMemoryIds, prepared.selection.selectedIds);
    assert.deepEqual(prepared.memories.map(m => ({ id: m.id, summary: m.summary })), [{ id: entries[0].ticket.request.requestId, summary: summaries[0] }]);
    recalledBy.push(run.execution.run.id);
  }
}
assert.equal(recalledBy.length, 2, 'Both outline and writer must receive the actual accepted summary');
for (const entry of entries) {
  const sceneRuns = completed.filter(r => r.execution.details.envelope.origin.floorId === entry.accepted.result.origin.floorId);
  const node = key => sceneRuns.find(r => r.execution.details.envelope.workflow?.nodeKey === key);
  assert.ok(node('outline') && node('writing') && node('formatting'));
  const formatter = node('formatting');
  const user = formatter.contexts[0].details.evidence.request.prepared.messages.filter(m => m.role === 'user').map(m => JSON.parse(m.content));
  assert.equal(user[0], node('outline').execution.details.pipelineResult.outputText);
  assert.equal(user[1], node('writing').execution.details.pipelineResult.outputText);
  const result = JSON.parse(formatter.execution.details.pipelineResult.outputText);
  const normalized = s => s.replace(/\s/gu, '');
  const source = user[1].split(/\r?\n/u).map(s => s.trim().replace(/^(旁白|艾洛拉)[:：]/u, '')).join('');
  assert.equal(normalized(result.lines.map(l => l.text).join('')), normalized(source));
}
const report = { status: 'passed', releaseId: journal.releaseId, committedFloors: 4, totalModelRuns: evidence.runs.length, completedModelRuns: 8, recoveredRetries: failed.map(r => ({ runId: r.execution.run.id, errorCode: r.execution.run.errorCode })), acceptedSummaries: 2, recalledBy, frozenProseVerified: 2, replay: null };
if (process.argv.includes('--replay-committed')) {
  const get = async path => {
    const response = await fetch(journal.baseUrl + path, { signal: AbortSignal.timeout(20000) });
    assert.equal(response.ok, true); return (await response.json()).data;
  };
  const binding = journal.record.airpOnline.connection.binding;
  const snapshot = async () => {
    const page = await get(`/conversation-threads/${binding.threadId}/timeline?branchId=${binding.branchId}&limit=50`);
    assert.equal(page.timeline.nextCursor, null, 'This verifier expects only the four acceptance floors');
    const current = page.timeline.floors;
    const runs = [...new Set(current.flatMap(f => f.checkpoint.snapshot.executions.map(s => s.runId).filter(Boolean)))];
    return {
      floors: current.map(f => ({ id: f.id, hash: f.checkpoint.snapshot.contentHash })),
      runs: await Promise.all(runs.map(async id => {
        const run = await get(`/runs/${id}/execution?detail=full`);
        return { id, status: run.run.status, invocations: run.invocations.map(i => ({ id: i.invocation.id, attempts: i.attempts.length })) };
      })),
    };
  };
  const before = await snapshot();
  assert.deepEqual(before.floors.map(f => f.id), floors.map(f => f.id));
  assert.equal(before.runs.length, evidence.runs.length);
  const client = createAirpRpHttpClient({ baseUrl: journal.baseUrl });
  const started = performance.now(), first = entries[0];
  const receipt = await client.submitGeneration(first.ticket);
  assert.equal(receipt.replayed, true);
  assert.deepEqual(await client.readResult(first.ticket, receipt), first.accepted.result);
  const control = await client.control(first.control);
  assert.equal(control.replayed, true);
  assert.deepEqual({ ...control, replayed: false }, first.controlReceipt);
  assert.deepEqual(await snapshot(), before, 'Replay must not create floors, runs or attempts');
  report.replay = { generation: true, confirmation: true, addedFloors: 0, addedModelRuns: 0, addedAttempts: 0, elapsedMs: Math.round(performance.now() - started) };
}
await writeFile(resolve(out, 'verification.json'), JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));
