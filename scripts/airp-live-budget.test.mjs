import assert from 'node:assert/strict';
import test from 'node:test';
import { readAirpLiveBudget, reserveAirpLiveStep } from './airp-live-budget.mjs';

test('unused worst-case reservations do not consume the later real-call budget', () => {
  for (const [spent, kind, ceiling] of [[0, 'generate', 4], [3, 'control', 5], [4, 'generate', 8], [7, 'control', 9]]) {
    assert.equal(reserveAirpLiveStep({ modelCalls: spent, unfinishedRuns: [] }, kind, 11).reservedCeiling, ceiling);
  }
});
test('running work and an exhausted budget fail closed', () => {
  assert.throws(() => reserveAirpLiveStep({ modelCalls: 1, unfinishedRuns: ['pending'] }, 'generate', 11), /unfinished/);
  assert.throws(() => reserveAirpLiveStep({ modelCalls: 10, unfinishedRuns: [] }, 'control', 11), /exhausted/);
  assert.throws(() => reserveAirpLiveStep({ modelCalls: 0, unfinishedRuns: [] }, 'unknown', 11), /Unknown/);
  assert.throws(() => reserveAirpLiveStep({ modelCalls: -1, unfinishedRuns: [] }, 'generate', 11), /Invalid/);
  assert.throws(() => reserveAirpLiveStep({ modelCalls: 0, unfinishedRuns: [] }, 'generate', 13), /Invalid/);
});
test('all attempts count, including cancelled requests with unknown usage; repeated run IDs count once', async () => {
  const fetcher = async path => ({ ok: true, json: async () => ({ data: path.includes('/timeline?') ? {
    timeline: { nextCursor: null, floors: [{ checkpoint: { snapshot: { executions: [{ runId: 'r' }, { runId: 'r' }] } } }] },
  } : { run: { status: 'cancelled' }, invocations: [{ attempts: [{ status: 'aborted', usage: null }] }] } }) });
  assert.deepEqual(await readAirpLiveBudget('http://localhost/api/v1', { threadId: 't', branchId: 'b' }, fetcher), { modelCalls: 1, unfinishedRuns: [] });
});
test('running attempt is not released by a terminal-looking run', async () => {
  const fetcher = async path => ({ ok: true, json: async () => ({ data: path.includes('/timeline?') ? {
    timeline: { nextCursor: null, floors: [{ checkpoint: { snapshot: { executions: [{ runId: 'r' }] } } }] },
  } : { run: { status: 'completed' }, invocations: [{ attempts: [{ status: 'running', usage: null }] }] } }) });
  assert.deepEqual((await readAirpLiveBudget('http://localhost/api/v1', { threadId: 't', branchId: 'b' }, fetcher)).unfinishedRuns, ['r']);
});
test('unreadable native evidence does not release reserved budget', async () => {
  await assert.rejects(readAirpLiveBudget('http://localhost/api/v1', { threadId: 't', branchId: 'b' }, async () => ({ ok: false })), /budget/);
});
test('session creation has no model reservation and no budget reads', async () => {
  const budget = await readAirpLiveBudget('http://localhost/api/v1', null, () => assert.fail('No native session to read'));
  assert.deepEqual(reserveAirpLiveStep(budget, 'session', 11), { modelCallsBefore: 0, reservedCalls: 0, reservedCeiling: 0 });
});
test('retry attempts are counted across timeline pages', async () => {
  const fetcher = async path => ({ ok: true, json: async () => ({ data: path.includes('/timeline?') ? {
    timeline: { nextCursor: path.includes('cursor=1') ? null : 1, floors: [{ checkpoint: { snapshot: { executions: [{ runId: path.includes('cursor=1') ? 'second' : 'first' }] } } }] },
  } : { run: { status: 'completed' }, invocations: [{ attempts: [{ status: 'failed' }, { status: 'completed' }] }] } }) });
  assert.deepEqual(await readAirpLiveBudget('http://localhost/api/v1', { threadId: 't', branchId: 'b' }, fetcher), { modelCalls: 4, unfinishedRuns: [] });
});
test('missing checkpoints are not mistaken for a zero-cost session', async () => {
  const fetcher = async () => ({ ok: true, json: async () => ({ data: { timeline: { nextCursor: null, floors: [{ checkpoint: { snapshot: null } }] } } }) });
  await assert.rejects(readAirpLiveBudget('http://localhost/api/v1', { threadId: 't', branchId: 'b' }, fetcher), /evidence snapshot/);
});
