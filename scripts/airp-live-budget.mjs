/** Read-only accounting for the opt-in acceptance runner; unknown usage still counts as an attempt. */
import assert from 'node:assert/strict';

export async function readAirpLiveBudget(baseUrl, binding, fetcher = fetch) {
  if (!binding) return { modelCalls: 0, unfinishedRuns: [] };
  const get = async path => {
    const response = await fetcher(baseUrl + path, { signal: AbortSignal.timeout(20000) });
    assert.equal(response.ok, true, 'Cannot establish native model-call budget');
    return (await response.json()).data;
  };
  const ids = new Set(), cursors = new Set();
  let cursor = null;
  for (let page = 0; ; page++) {
    assert.ok(page < 256, 'Native budget timeline exceeded page limit');
    const query = new URLSearchParams({ branchId: binding.branchId, limit: '50' });
    if (cursor !== null) query.set('cursor', String(cursor));
    const data = await get(`/conversation-threads/${encodeURIComponent(binding.threadId)}/timeline?${query}`);
    for (const floor of data.timeline.floors) {
      assert.ok(floor.checkpoint.snapshot, 'Cannot account for an incomplete native evidence snapshot');
      for (const execution of floor.checkpoint.snapshot.executions) if (execution.runId) ids.add(execution.runId);
    }
    cursor = data.timeline.nextCursor;
    if (cursor === null) break;
    assert.ok(!cursors.has(cursor), 'Repeated native budget timeline cursor');
    cursors.add(cursor);
  }
  let modelCalls = 0;
  const unfinishedRuns = [];
  for (const id of ids) {
    const execution = await get(`/runs/${encodeURIComponent(id)}/execution?detail=full`);
    const attempts = execution.invocations.flatMap(invocation => invocation.attempts);
    modelCalls += attempts.length;
    if (!['completed', 'failed', 'cancelled', 'interrupted'].includes(execution.run.status)
      || attempts.some(attempt => !['completed', 'failed', 'aborted', 'interrupted'].includes(attempt.status))) unfinishedRuns.push(id);
  }
  return { modelCalls, unfinishedRuns };
}

export function reserveAirpLiveStep(budget, kind, maximum) {
  assert.ok(['session', 'generate', 'control'].includes(kind), 'Unknown paid acceptance step');
  assert.ok(Number.isSafeInteger(maximum) && maximum > 0 && maximum <= 12, 'Invalid case budget');
  assert.ok(Number.isSafeInteger(budget.modelCalls) && budget.modelCalls >= 0, 'Invalid native attempt count');
  assert.deepEqual(budget.unfinishedRuns, [], 'Native model requests remain unfinished; inspect them before any continuation');
  const reservedCalls = kind === 'generate' ? 4 : kind === 'control' ? 2 : 0;
  assert.ok(budget.modelCalls + reservedCalls <= maximum, 'Paid acceptance call budget exhausted; inspect existing evidence before any continuation');
  return { modelCallsBefore: budget.modelCalls, reservedCalls, reservedCeiling: budget.modelCalls + reservedCalls };
}
