import type { AirpHead } from "../contracts/airp";
import { AIRP_SETTLEMENT_LIMITS, type SettlementActorState, type SettlementBatch, type SettlementCommitGate, type SettlementEffect, type SettlementEvidence, type SettlementGrant, type SettlementInput, type SettlementMemoryPoint, type SettlementPoint, type SettlementPreparation, type SettlementReceipt, type SettlementThread, type SettlementThreadUntil, type SettlementTimedState } from "../contracts/airp-settlement";
import { parseSettlementProposal, settlementHead, settlementItemRef, settlementUnique, validateSettlementInputShape } from "../contracts/airp-settlement-validation";
import { sha256 } from "../contracts/sha256";
import { assertJson, canonicalJson, freezeData, invalid } from "../contracts/validation";

const sameSave = (a: AirpHead, b: AirpHead) => a.saveId === b.saveId && a.epoch === b.epoch;
const copy = <T>(value: T): T => JSON.parse(canonicalJson(value)) as T;
const fail = (message: string): never => invalid("settlement", message, "airp-settlement");
const fingerprint = (value: unknown) => sha256(canonicalJson(value));

function identity(input: SettlementInput) {
  const { saveId, epoch } = input.state.head;
  return {
    taskId: `settlement:${fingerprint({ protocol: 1, saveId, epoch, scope: input.scope })}`,
    inputHash: fingerprint(input),
  };
}
/** The task survives retries; the input hash additionally freezes state, policy and source refs. */
export function settlementTaskIdentity(input: SettlementInput): { taskId: string; inputHash: string } {
  return identity(validateSettlementInputShape(input));
}
/** Never based on model-generated summary IDs or task IDs. */
export function settlementEffectId(head: AirpHead, grant: SettlementGrant): string {
  const owner = { saveId: head.saveId, epoch: head.epoch };
  const key = grant.kind === "affinity"
    ? { kind: grant.kind, actorId: grant.actorId, eventId: grant.eventId, accountId: grant.accountId }
    : grant.kind === "item"
      ? { kind: grant.kind, adapterId: grant.operation.adapterId, operationId: grant.operation.operationId }
      : { kind: grant.kind, actorId: grant.actorId, changeId: grant.changeId };
  return `effect:${fingerprint({ ...owner, ...key })}`;
}

/** Read-only expiry projection. It neither invents a destination nor resets a character every scene. */
export function projectSettlementActorState(actor: SettlementActorState, phase: number, fulfilledEndConditions: readonly string[] = []): SettlementActorState {
  const live = (s: SettlementTimedState) => phase < s.untilPhase && (s.endConditionId === null || !fulfilledEndConditions.includes(s.endConditionId));
  return copy({ ...actor, activity: actor.activity && live(actor.activity) ? actor.activity : null, conditions: actor.conditions.filter(live) });
}

function validateInput(input: SettlementInput): void {
  const { state, policy, scope } = input;
  if (state.policyId !== policy.id) fail("Policy identity mismatch; no implicit rebalance/migration");
  const actor = (id: string) => { if (!policy.actorIds.includes(id)) fail(`Unknown actor: ${id}`); };
  const knowledge = (ids: string[]) => { if (ids.some(id => !policy.observerIds.includes(id))) fail("Unknown knowledge identity"); };
  for (const row of state.affinity) {
    actor(row.actorId);
    if (row.value < policy.affinity.min || row.value > policy.affinity.max) fail("Stored affinity out of policy range");
  }
  for (const row of state.actors) {
    actor(row.actorId);
    if (row.locationId !== null && !policy.locationIds.includes(row.locationId)) fail("Unknown stored location");
    for (const [value, definitions] of [[row.activity ? [row.activity] : [], policy.activities], [row.conditions, policy.conditions]] as const) {
      for (const s of value) {
        const definition = definitions.find(d => d.id === s.id);
        if (!definition || (s.endConditionId !== null && !policy.endConditionIds.includes(s.endConditionId))) fail("Unknown stored activity/condition");
        if (definition && s.untilPhase - state.phase > definition.maxPhases) fail("Stored state exceeds its configured lifetime");
      }
    }
  }
  input.fullActorCards.forEach(card => actor(card.actorId));
  input.actorLocks.forEach(lock => actor(lock.actorId));
  for (const source of input.evidence) {
    if (!sameSave(source.head, state.head) || source.head.revision > state.head.revision || source.phase > state.phase) fail("Cross-save/epoch or future evidence");
    if (source.kind === "read-paragraph" && source.readAtRevision > state.head.revision) fail("Unread paragraph is not experience");
    if (source.role === "current" && (source.eventId !== scope.eventId || source.runId !== scope.runId || source.actionId !== scope.actionId)) fail("Current evidence belongs to another event/action/run");
    knowledge(source.knownBy);
    if (source.speakerId !== null) {
      if (!policy.observerIds.includes(source.speakerId) || !source.knownBy.includes(source.speakerId)) fail("Invalid claim speaker/knowledge");
    }
  }
  for (const grant of input.grants) {
    if (grant.kind === "item") continue;
    actor(grant.actorId);
    if (grant.kind === "affinity") {
      if (grant.eventId !== scope.eventId) fail("Affinity grant belongs to another event");
      if (grant.accountId === "event" && scope.kind !== "event") fail("Whole-event affinity cannot be settled at an action/run boundary");
    }
  }
  settlementUnique(input.grants, grant => settlementEffectId(state.head, grant), "input.effectSlots");
  for (const thread of input.openThreads) knowledge(thread.knownBy);
}

/** Receipts are internal, validated replay data. A model proposal cannot supply this ledger. */
function validateLedger(receipts: SettlementReceipt[], head: AirpHead): void {
  settlementUnique(receipts, r => r.id, "ledger.receipts");
  settlementUnique(receipts, r => r.taskId, "ledger.tasks");
  for (const r of receipts) {
    settlementHead(r.committedHead, "ledger.head");
    if (!sameSave(r.committedHead, head) || r.committedHead.revision > head.revision) fail("Foreign/future applied receipt");
  }
  settlementUnique(receipts.flatMap(r => r.effects), e => e.id, "ledger.effects");
}

/**
 * Pure prepare only. NOT a state writer or a reward grant.
 * CL-B must recheck CAS + asset operations, then commit effects, memory and one receipt atomically.
 * On any failure no partial batch is returned, and the already-saved program action stays intact.
 */
export function prepareAirpSettlement(rawInput: SettlementInput, rawProposal: unknown, gate: SettlementCommitGate): SettlementPreparation {
  const input = validateSettlementInputShape(rawInput), proposal = parseSettlementProposal(rawProposal);
  validateInput(input);
  assertJson(gate);
  const liveHead = settlementHead(gate.head, "gate.head"), expected = input.state.head;
  if (!sameSave(expected, liveHead)) fail("Cross-save/epoch result");
  validateLedger(gate.receipts, liveHead);
  validateLedger(input.priorReceipts, expected);
  const task = identity(input);
  if (proposal.taskId !== task.taskId || proposal.inputHash !== task.inputHash) fail("Wrong task or changed frozen input");
  const already = gate.receipts.find(r => r.taskId === task.taskId);
  if (already) {
    if (already.inputHash !== task.inputHash) fail("Task already committed with different input");
    return freezeData({ status: "already-applied", receipt: copy(already) });
  }
  if (liveHead.revision !== expected.revision) fail("Stale state revision; do not silently rebase model output");
  for (const r of input.priorReceipts) {
    const applied = gate.receipts.find(a => a.id === r.id);
    if (!applied || canonicalJson(applied) !== canonicalJson(r)) fail("Missing/changed previously applied receipt");
  }
  const sources = new Map(input.evidence.map(s => [s.id, s]));
  function basis(ids: string[], current = false): SettlementEvidence[] {
    const found = ids.map(id => sources.get(id) ?? fail(`Missing source: ${id}`));
    if (current && !found.some(s => s.role === "current")) fail("History alone cannot authorize a new change");
    return found;
  }
  function factual(ids: string[]): void {
    if (!basis(ids, true).some(s => s.role === "current" && s.authority === "fact")) fail("A claim/plan alone cannot change actual state or assets");
  }
  const endings = input.lifecycle ?? [];
  for (const end of endings) {
    if (basis(end.basisIds).some(s => s.kind !== "program-fact" || s.authority !== "fact")) fail("Scope endings require actual program sources");
  }
  const endedThread = (thread: Pick<SettlementThread, "scope" | "until">) => endings.find(end =>
    thread.until === "run-end" && end.kind === "run" && thread.scope.runId === end.id ||
    thread.until === "event-end" && end.kind === "event" && thread.scope.eventId === end.id);
  const threadOwner = (until: SettlementThreadUntil) => {
    if (until === "run-end" && !input.scope.runId || until === "event-end" && !input.scope.eventId) fail("Thread lifetime needs its actual owning run/event");
    return until === "run-end" ? { runId: input.scope.runId } : until === "event-end" ? { eventId: input.scope.eventId }
      : input.scope.eventId ? { eventId: input.scope.eventId } : input.scope.runId ? { runId: input.scope.runId } : { boundaryId: input.scope.boundaryId };
  };
  function memoryPoint(point: SettlementPoint, needsCurrent = false): SettlementMemoryPoint {
    const evidence = basis(point.basisIds, needsCurrent);
    if (point.knownBy.some(id => !input.policy.observerIds.includes(id) || evidence.some(s => !s.knownBy.includes(id)))) fail("Memory widens source knowledge");
    const claims = evidence.filter(s => s.authority === "claim").map(s => ({ sourceId: s.id, speakerId: s.speakerId! }));
    if (point.kind === "fact" ? claims.length > 0 : !claims.some(c => c.speakerId === point.speakerId)) {
      // Citation classification is not an asset transaction failure. Do not discard a useful
      // scene summary, delete its citations, or attribute mixed narration to a single speaker.
      return { ...point, kind: "record", speakerId: null, claims };
    }
    return point; // Preserve existing accepted batches byte-for-byte for saved replay.
  }
  const effects: SettlementEffect[] = [];
  const appliedEffects = gate.receipts.flatMap(r => r.effects);
  function authorized(id: string, kind: SettlementGrant["kind"]): SettlementGrant {
    const grant = input.grants.find(g => g.id === id);
    if (!grant || grant.kind !== kind) return fail("Unknown or wrong-kind program grant");
    const effectId = settlementEffectId(expected, grant);
    if (appliedEffects.some(e => e.id === effectId) || effects.some(e => e.id === effectId)) fail("Effect already applied; reference its receipt instead");
    return grant;
  }
  for (const change of proposal.affinity) {
    const grant = authorized(change.grantId, "affinity");
    if (grant.kind !== "affinity") return fail("Wrong affinity grant");
    if (!input.fullActorCards.some(card => card.actorId === grant.actorId)) fail("Affinity requires the complete affected actor card");
    const evidence = basis(change.basisIds, true);
    if (evidence.some(s => !s.knownBy.includes(grant.actorId))) fail("Actor cannot react to unknown information");
    if (effects.some(e => e.kind === "affinity" && e.actorId === grant.actorId)) fail("One affinity assessment per actor in this settlement");
    const grade = input.policy.affinity.grades.find(g => g.id === change.gradeId);
    if (!grade) return fail("Unknown affinity grade");
    const used = appliedEffects.filter(e => e.kind === "affinity" && e.eventId === grant.eventId && e.actorId === grant.actorId)
      .reduce((sum, e) => sum + (e.kind === "affinity" ? Math.abs(e.delta) : 0), 0);
    if (!Number.isSafeInteger(used) || Math.abs(grade.delta) > input.policy.affinity.eventAbsLimit - used) fail("Event affinity budget exceeded");
    const before = input.state.affinity.find(a => a.actorId === grant.actorId)?.value ?? input.policy.affinity.initial;
    const after = Math.min(input.policy.affinity.max, Math.max(input.policy.affinity.min, before + grade.delta));
    effects.push({ id: settlementEffectId(expected, grant), kind: "affinity", actorId: grant.actorId, eventId: grant.eventId, accountId: grant.accountId,
      gradeId: grade.id, requestedDelta: grade.delta, delta: after - before, before, after, reason: change.reason, basisIds: change.basisIds });
  }
  for (const change of proposal.items) {
    const grant = authorized(change.grantId, "item");
    if (grant.kind !== "item") return fail("Wrong item grant");
    factual(change.basisIds);
    // The asset domain may already have applied this operation without an AIRP receipt.
    for (const raw of gate.appliedItemOperations) {
      const item = settlementItemRef(raw, "gate.appliedItemOperations");
      if (item.adapterId === grant.operation.adapterId && item.operationId === grant.operation.operationId) fail("Asset operation already applied; do not issue it again");
    }
    effects.push({ id: settlementEffectId(expected, grant), kind: "item", operation: grant.operation, basisIds: change.basisIds });
  }
  function checkTimed(value: SettlementTimedState, definitions: { id: string; maxPhases: number }[]): void {
    const definition = definitions.find(d => d.id === value.id);
    if (!definition || value.untilPhase <= input.state.phase || value.untilPhase - input.state.phase > definition.maxPhases) fail("Unknown/expired/overlong activity or condition");
    if (value.endConditionId !== null && !input.policy.endConditionIds.includes(value.endConditionId)) fail("Unknown state end condition");
  }
  for (const change of proposal.actors) {
    const grant = authorized(change.grantId, "actor");
    if (grant.kind !== "actor") return fail("Wrong actor grant");
    factual(change.basisIds);
    if (effects.some(e => e.kind === "actor" && e.actorId === grant.actorId)) fail("Conflicting actor patches in one settlement");
    const requested = [
      ...(change.locationId !== undefined ? ["location" as const] : []),
      ...(change.activity !== undefined ? ["activity" as const] : []),
      ...(change.conditions !== undefined ? ["conditions" as const] : []),
    ];
    const locks = input.actorLocks.find(l => l.actorId === grant.actorId)?.fields ?? [];
    if (requested.some(f => !grant.fields.includes(f) || locks.includes(f))) fail("Actor field is unauthorized or locked by program movement/combat/occupancy");
    const before = copy(input.state.actors.find(a => a.actorId === grant.actorId) ?? { actorId: grant.actorId, locationId: null, activity: null, conditions: [] });
    const after = copy(before);
    if (change.locationId !== undefined) {
      if (!input.policy.locationIds.includes(change.locationId)) fail("Unknown actual location");
      after.locationId = change.locationId;
    }
    if (change.activity !== undefined) {
      if (change.activity) checkTimed(change.activity, input.policy.activities);
      after.activity = change.activity;
    }
    if (change.conditions) {
      const { add, removeIds } = change.conditions;
      if (removeIds.some(id => !before.conditions.some(c => c.id === id))) fail("Cannot remove an absent condition");
      for (const value of add) {
        checkTimed(value, input.policy.conditions);
        if (before.conditions.some(c => c.id === value.id) || removeIds.includes(value.id)) fail("Cannot implicitly renew or replace an existing condition");
      }
      after.conditions = [...before.conditions.filter(c => !removeIds.includes(c.id)), ...add];
      if (after.conditions.length > AIRP_SETTLEMENT_LIMITS.changes) fail("Resulting actor condition capacity exceeded");
    }
    if (canonicalJson(before) === canonicalJson(after)) fail("Actor patch changes nothing; omit it");
    effects.push({ id: settlementEffectId(expected, grant), kind: "actor", actorId: grant.actorId, changeId: grant.changeId, before, after, basisIds: change.basisIds });
  }
  const points = proposal.memory.points.map(p => memoryPoint(p));
  for (const close of proposal.memory.close) {
    const thread = input.openThreads.find(t => t.id === close.id) ?? fail("Missing unresolved thread");
    const ended = endings.find(e => (e.kind === "run" ? thread.scope.runId === e.id : thread.scope.eventId === e.id) && e.basisIds.every(id => close.basisIds.includes(id)));
    if (thread.scope.eventId !== null && thread.scope.eventId !== input.scope.eventId && !ended) fail("Unrelated unresolved thread");
    if (ended) basis(close.basisIds); else factual(close.basisIds);
    // A hidden resolution cannot silently become known to everyone who heard the request.
    if (!ended && basis(close.basisIds).some(s => thread.knownBy.some(id => !s.knownBy.includes(id)))) fail("Thread closure widens knowledge");
  }
  for (const id of proposal.memory.priorReceiptIds) {
    if (!input.priorReceipts.some(r => r.id === id)) fail("Summary references an unknown prior receipt");
  }
  // Require a sourced short record for each new effect; actual mapped values are attached below.
  for (const effect of effects) {
    if (!proposal.memory.points.some(p => effect.basisIds.every(id => p.basisIds.includes(id)))) fail("Variable change is missing its matching memory record");
  }
  const memoryId = `memory:${fingerprint(task.taskId)}`;
  const opened = proposal.memory.open.map(({ key, until, ...point }) => ({ ...memoryPoint(point, true),
    id: `thread:${fingerprint(until ? { saveId: expected.saveId, epoch: expected.epoch, owner: threadOwner(until), until, key } : { taskId: task.taskId, key })}`, scope: input.scope,
    ...(until ? { until, topicKey: key } : {}) })).filter(thread => !thread.until || !endedThread(thread) && !input.openThreads.some(existing => existing.id === thread.id));
  if (opened.some(t => input.openThreads.some(existing => existing.id === t.id))) fail("Unresolved thread already exists");
  // Administrative expiry removes pending work; it does not grant any character new narrative knowledge.
  // Explicit cross-scope commitments (resolved) and old unclassified threads remain untouched.
  const closed = [...proposal.memory.close, ...input.openThreads.flatMap(thread => {
    const end = endedThread(thread);
    return end && !proposal.memory.close.some(c => c.id === thread.id) ? [{ id: thread.id, basisIds: end.basisIds }] : [];
  })];
  const usedSources = new Set([
    ...effects.flatMap(e => e.basisIds), ...proposal.memory.points.flatMap(p => p.basisIds),
    ...opened.flatMap(t => t.basisIds), ...closed.flatMap(t => t.basisIds),
  ]);
  const batch: SettlementBatch = {
    protocol: 1, ...task, expectedHead: expected, policyId: input.policy.id, effects,
    memory: { id: memoryId, phase: input.state.phase, scope: input.scope, points, opened, closed,
      effectIds: effects.map(e => e.id), priorReceiptIds: proposal.memory.priorReceiptIds, sources: input.evidence.filter(s => usedSources.has(s.id)) },
  };
  return freezeData({ status: "prepared", batch });
}
