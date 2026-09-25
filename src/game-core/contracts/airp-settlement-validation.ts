import type { AirpHead } from "./airp";
import { AIRP_SETTLEMENT_LIMITS as L, type SettlementActorProposal, type SettlementActorState, type SettlementEvidence, type SettlementGrant, type SettlementInput, type SettlementItemRef, type SettlementMemoryPoint, type SettlementPoint, type SettlementPolicy, type SettlementProposal, type SettlementScope, type SettlementState, type SettlementTimedState } from "./airp-settlement";
import * as v from "./validation";

const signed = (raw: unknown, p: string) => v.number(raw, p, -Number.MAX_SAFE_INTEGER);
const nullableId = (raw: unknown, p: string) => raw === null ? null : v.id(raw, p);
function prose(raw: unknown, p: string): string {
  const result = v.text(raw, p, L.text);
  if (!result.trim()) v.invalid(p, "Empty prose");
  return result; // Never rewrite original wording.
}
export function settlementDigest(raw: unknown, p: string): string {
  const digest = v.text(raw, p, 64);
  if (!/^[a-f0-9]{64}$/.test(digest)) v.invalid(p, "Expected SHA-256 digest");
  return digest;
}
export function settlementHead(raw: unknown, p: string): AirpHead {
  const r = v.record(raw, p, ["saveId", "epoch", "revision"]);
  return { saveId: v.id(r.saveId, `${p}.saveId`), epoch: v.id(r.epoch, `${p}.epoch`), revision: v.number(r.revision, `${p}.revision`) };
}
export function settlementUnique<T>(items: T[], key: (item: T) => string, p: string): T[] {
  if (new Set(items.map(key)).size !== items.length) v.invalid(p, "Duplicate identity");
  return items;
}
export function settlementScope(raw: unknown, p: string): SettlementScope {
  const r = v.record(raw, p, ["kind", "boundaryId", "eventId", "actionId", "runId"]);
  const result = {
    kind: v.choice(r.kind, ["action", "event", "run"], `${p}.kind`), boundaryId: v.id(r.boundaryId, `${p}.boundaryId`),
    eventId: nullableId(r.eventId, `${p}.eventId`), actionId: nullableId(r.actionId, `${p}.actionId`), runId: nullableId(r.runId, `${p}.runId`),
  };
  if (!result[`${result.kind}Id`]) v.invalid(p, "Boundary requires its own event/action/run identity");
  return result;
}
function timed(raw: unknown, p: string): SettlementTimedState {
  const r = v.record(raw, p, ["id", "untilPhase", "endConditionId"]);
  return { id: v.id(r.id, `${p}.id`), untilPhase: v.number(r.untilPhase, `${p}.untilPhase`), endConditionId: nullableId(r.endConditionId, `${p}.endConditionId`) };
}
function actor(raw: unknown, p: string): SettlementActorState {
  const r = v.record(raw, p, ["actorId", "locationId", "activity", "conditions"]);
  return {
    actorId: v.id(r.actorId, `${p}.actorId`), locationId: nullableId(r.locationId, `${p}.locationId`),
    activity: r.activity === null ? null : timed(r.activity, `${p}.activity`),
    conditions: settlementUnique(v.list(r.conditions, `${p}.conditions`, L.changes).map((x, i) => timed(x, `${p}.conditions.${i}`)), x => x.id, `${p}.conditions`),
  };
}
export function parseSettlementPolicy(raw: unknown): SettlementPolicy {
  v.assertJson(raw);
  const p = "settlement.policy", r = v.record(raw, p, ["id", "actorIds", "observerIds", "locationIds", "endConditionIds", "affinity", "activities", "conditions"]);
  const a = v.record(r.affinity, `${p}.affinity`, ["initial", "min", "max", "eventAbsLimit", "grades"]);
  const min = signed(a.min, `${p}.min`), max = v.number(a.max, `${p}.max`, min);
  const grades = settlementUnique(v.list(a.grades, `${p}.grades`, 32).map((x, i) => {
    const g = v.record(x, `${p}.grades.${i}`, ["id", "delta"]);
    return { id: v.id(g.id, `${p}.grades.${i}.id`), delta: signed(g.delta, `${p}.grades.${i}.delta`) };
  }), x => x.id, `${p}.grades`);
  if (!grades.some(g => g.delta === 0)) v.invalid(`${p}.grades`, "Explicit no-change grade required");
  const activities = settlementUnique(v.list(r.activities, `${p}.activities`, 64).map((x, i) => {
    const at = `${p}.activities.${i}`, g = v.record(x, at, ["id", "busy", "maxPhases"]);
    return { id: v.id(g.id, `${at}.id`), busy: v.boolean(g.busy, `${at}.busy`), maxPhases: v.number(g.maxPhases, `${at}.maxPhases`, 1) };
  }), x => x.id, `${p}.activities`);
  const conditions = settlementUnique(v.list(r.conditions, `${p}.conditions`, 64).map((x, i) => {
    const at = `${p}.conditions.${i}`, g = v.record(x, at, ["id", "maxPhases"]);
    return { id: v.id(g.id, `${at}.id`), maxPhases: v.number(g.maxPhases, `${at}.maxPhases`, 1) };
  }), x => x.id, `${p}.conditions`);
  const result: SettlementPolicy = {
    id: v.id(r.id, `${p}.id`), actorIds: v.ids(r.actorIds, `${p}.actorIds`, 128), observerIds: v.ids(r.observerIds, `${p}.observerIds`, 129),
    locationIds: v.ids(r.locationIds, `${p}.locationIds`, 256), endConditionIds: v.ids(r.endConditionIds, `${p}.endConditionIds`, 64),
    affinity: { initial: v.number(a.initial, `${p}.initial`, min, max), min, max, eventAbsLimit: v.number(a.eventAbsLimit, `${p}.eventAbsLimit`), grades }, activities, conditions,
  };
  if (result.actorIds.some(id => !result.observerIds.includes(id))) v.invalid(p, "Actor missing from knowledge identities");
  return result;
}
export function parseSettlementState(raw: unknown): SettlementState {
  v.assertJson(raw);
  const p = "settlement.state", r = v.record(raw, p, ["protocol", "policyId", "head", "phase", "affinity", "actors"]);
  return {
    protocol: v.choice(r.protocol, [1], `${p}.protocol`), policyId: v.id(r.policyId, `${p}.policyId`), head: settlementHead(r.head, `${p}.head`), phase: v.number(r.phase, `${p}.phase`),
    affinity: settlementUnique(v.list(r.affinity, `${p}.affinity`, 128).map((x, i) => {
      const at = `${p}.affinity.${i}`, a = v.record(x, at, ["actorId", "value"]);
      return { actorId: v.id(a.actorId, `${at}.actorId`), value: signed(a.value, `${at}.value`) };
    }), x => x.actorId, `${p}.affinity`),
    actors: settlementUnique(v.list(r.actors, `${p}.actors`, 128).map((x, i) => actor(x, `${p}.actors.${i}`)), x => x.actorId, `${p}.actors`),
  };
}
function point(raw: unknown, p: string, extra: string[] = [], optional: string[] = []): SettlementPoint {
  const r = v.record(raw, p, ["kind", "text", "speakerId", "knownBy", "basisIds", ...extra], optional);
  const kind = v.choice(r.kind, ["fact", "claim"], `${p}.kind`), speakerId = nullableId(r.speakerId, `${p}.speakerId`);
  if ((kind === "claim") !== (speakerId !== null)) v.invalid(p, "Only claims require a speaker");
  const basisIds = v.ids(r.basisIds, `${p}.basisIds`, L.sources);
  if (!basisIds.length) v.invalid(p, "Memory needs sources");
  return { kind, text: prose(r.text, `${p}.text`), speakerId, knownBy: v.ids(r.knownBy, `${p}.knownBy`, 129), basisIds };
}
function basis(raw: unknown, p: string): string[] {
  const ids = v.ids(raw, p, L.sources);
  if (!ids.length) v.invalid(p, "Change needs sources");
  return ids;
}
/** Saved unresolved records can outlive the source scene; model proposals still use point(). */
function savedPoint(raw: unknown, p: string, extra: string[], optional: string[] = []): SettlementMemoryPoint {
  const r = v.record(raw, p);
  if (r.kind !== "record") return point(raw, p, extra, optional);
  v.record(r, p, ["kind", "text", "speakerId", "knownBy", "basisIds", "claims", ...extra], optional);
  if (r.speakerId !== null) v.invalid(p, "A scene record has no single speaker");
  const basisIds = basis(r.basisIds, `${p}.basisIds`);
  const claims = settlementUnique(v.list(r.claims, `${p}.claims`, L.sources).map((x, i) => {
    const at = `${p}.claims.${i}`, c = v.record(x, at, ["sourceId", "speakerId"]);
    const sourceId = v.id(c.sourceId, `${at}.sourceId`);
    if (!basisIds.includes(sourceId)) v.invalid(at, "Claim must retain its source reference");
    return { sourceId, speakerId: v.id(c.speakerId, `${at}.speakerId`) };
  }), c => c.sourceId, `${p}.claims`);
  return { kind: "record", text: prose(r.text, `${p}.text`), speakerId: null, knownBy: v.ids(r.knownBy, `${p}.knownBy`, 129), basisIds, claims };
}
export function parseSettlementProposal(raw: unknown): SettlementProposal {
  v.assertJson(raw);
  if (v.utf8Size(JSON.stringify(raw)) > L.proposalBytes) v.invalid("settlement.proposal", "Proposal capacity exceeded");
  const p = "settlement.proposal", r = v.record(raw, p, ["protocol", "taskId", "inputHash", "affinity", "items", "actors", "memory"]);
  const affinity = v.list(r.affinity, `${p}.affinity`, L.changes).map((x, i) => {
    const at = `${p}.affinity.${i}`, a = v.record(x, at, ["grantId", "gradeId", "reason", "basisIds"]);
    return { grantId: v.id(a.grantId, `${at}.grantId`), gradeId: v.id(a.gradeId, `${at}.gradeId`), reason: prose(a.reason, `${at}.reason`), basisIds: basis(a.basisIds, `${at}.basisIds`) };
  });
  const items = v.list(r.items, `${p}.items`, L.changes).map((x, i) => {
    const at = `${p}.items.${i}`, a = v.record(x, at, ["grantId", "basisIds"]);
    return { grantId: v.id(a.grantId, `${at}.grantId`), basisIds: basis(a.basisIds, `${at}.basisIds`) };
  });
  const actors = v.list(r.actors, `${p}.actors`, L.changes).map((x, i): SettlementActorProposal => {
    const at = `${p}.actors.${i}`, a = v.record(x, at, ["grantId", "basisIds"], ["locationId", "activity", "conditions"]);
    const result: SettlementActorProposal = { grantId: v.id(a.grantId, `${at}.grantId`), basisIds: basis(a.basisIds, `${at}.basisIds`) };
    if (Object.hasOwn(a, "locationId")) result.locationId = v.id(a.locationId, `${at}.locationId`);
    if (Object.hasOwn(a, "activity")) result.activity = a.activity === null ? null : timed(a.activity, `${at}.activity`);
    if (Object.hasOwn(a, "conditions")) {
      const c = v.record(a.conditions, `${at}.conditions`, ["add", "removeIds"]);
      result.conditions = { add: settlementUnique(v.list(c.add, `${at}.add`, L.changes).map((t, j) => timed(t, `${at}.add.${j}`)), t => t.id, `${at}.add`), removeIds: v.ids(c.removeIds, `${at}.removeIds`, L.changes) };
    }
    if (Object.keys(result).length === 2) v.invalid(at, "Empty actor patch; omit it instead");
    return result;
  });
  settlementUnique([...affinity, ...items, ...actors], x => x.grantId, `${p}.grants`);
  const m = v.record(r.memory, `${p}.memory`, ["points", "open", "close", "priorReceiptIds"]);
  const open = settlementUnique(v.list(m.open, `${p}.open`, L.points).map((x, i) => {
    const at = `${p}.open.${i}`, a = v.record(x, at);
    return { ...point(x, at, ["key"], ["until"]), key: v.id(a.key, `${at}.key`), ...(a.until === undefined ? {} : { until: v.choice(a.until, ["run-end", "event-end", "resolved"] as const, `${at}.until`) }) };
  }), x => x.key, `${p}.open`);
  const close = settlementUnique(v.list(m.close, `${p}.close`, L.points).map((x, i) => {
    const at = `${p}.close.${i}`, a = v.record(x, at, ["id", "basisIds"]);
    return { id: v.id(a.id, `${at}.id`), basisIds: basis(a.basisIds, `${at}.basisIds`) };
  }), x => x.id, `${p}.close`);
  return {
    protocol: v.choice(r.protocol, [1], `${p}.protocol`), taskId: v.id(r.taskId, `${p}.taskId`), inputHash: settlementDigest(r.inputHash, `${p}.inputHash`), affinity, items, actors,
    memory: { points: v.list(m.points, `${p}.points`, L.points).map((x, i) => point(x, `${p}.points.${i}`)), open, close, priorReceiptIds: v.ids(m.priorReceiptIds, `${p}.priorReceiptIds`, L.sources) },
  };
}
export function settlementItemRef(raw: unknown, p: string): SettlementItemRef {
  const r = v.record(raw, p, ["adapterId", "operationId", "operationHash"]);
  return { adapterId: v.id(r.adapterId, `${p}.adapterId`), operationId: v.id(r.operationId, `${p}.operationId`), operationHash: settlementDigest(r.operationHash, `${p}.operationHash`) };
}
const fields = (raw: unknown, p: string) => settlementUnique(v.list(raw, p, 3).map(x => v.choice(x, ["location", "activity", "conditions"] as const, p)), x => x, p);
function grant(raw: unknown, p: string): SettlementGrant {
  const r = v.record(raw, p), kind = v.choice(r.kind, ["affinity", "item", "actor"], `${p}.kind`);
  v.record(r, p, kind === "affinity" ? ["id", "kind", "actorId", "eventId", "accountId"] : kind === "item" ? ["id", "kind", "operation"] : ["id", "kind", "actorId", "changeId", "fields"]);
  const id = v.id(r.id, `${p}.id`);
  if (kind === "item") return { id, kind, operation: settlementItemRef(r.operation, `${p}.operation`) };
  const actorId = v.id(r.actorId, `${p}.actorId`);
  if (kind === "affinity") return { id, kind, actorId, eventId: v.id(r.eventId, `${p}.eventId`), accountId: v.id(r.accountId, `${p}.accountId`) };
  const allowed = fields(r.fields, `${p}.fields`);
  if (!allowed.length) v.invalid(p, "Actor grant has no authorized fields");
  return { id, kind, actorId, changeId: v.id(r.changeId, `${p}.changeId`), fields: allowed };
}
export function settlementEvidence(raw: unknown, p: string): SettlementEvidence {
  const r = v.record(raw, p), kind = v.choice(r.kind, ["program-fact", "read-paragraph"], `${p}.kind`);
  v.record(r, p, ["id", "head", "phase", "eventId", "actionId", "runId", "role", "authority", "speakerId", "knownBy", "kind", ...(kind === "program-fact" ? ["factId"] : ["archive", "readAtRevision"])]);
  const common = {
    id: v.id(r.id, `${p}.id`), head: settlementHead(r.head, `${p}.head`), phase: v.number(r.phase, `${p}.phase`),
    eventId: nullableId(r.eventId, `${p}.eventId`), actionId: nullableId(r.actionId, `${p}.actionId`), runId: nullableId(r.runId, `${p}.runId`),
    role: v.choice(r.role, ["current", "history"], `${p}.role`), authority: v.choice(r.authority, ["fact", "claim"], `${p}.authority`), speakerId: nullableId(r.speakerId, `${p}.speakerId`), knownBy: v.ids(r.knownBy, `${p}.knownBy`, 129),
  };
  if ((common.authority === "claim") !== (common.speakerId !== null)) v.invalid(p, "Claim source requires its speaker");
  if (kind === "program-fact") {
    if (common.authority !== "fact") v.invalid(p, "Program fact cannot be a claimed world fact");
    return { ...common, kind, factId: v.id(r.factId, `${p}.factId`) };
  }
  const a = v.record(r.archive, `${p}.archive`, ["sceneId", "paragraphId", "digest"]);
  return { ...common, kind, archive: { sceneId: v.id(a.sceneId, `${p}.sceneId`), paragraphId: v.id(a.paragraphId, `${p}.paragraphId`), digest: settlementDigest(a.digest, `${p}.digest`) }, readAtRevision: v.number(r.readAtRevision, `${p}.readAtRevision`, common.head.revision) };
}

/** Internal program projection, not a save importer. Applied receipts must come from validated replay. */
export function validateSettlementInputShape(input: SettlementInput): SettlementInput {
  v.assertJson(input);
  v.record(input, "settlement.input", ["state", "policy", "scope", "evidence", "grants", "fullActorCards", "openThreads", "priorReceipts", "actorLocks"], ["lifecycle"]);
  // Clone trusted ledger data too: a prepared result never aliases/mutates the caller's state.
  const receipts = JSON.parse(v.canonicalJson(input.priorReceipts)) as SettlementInput["priorReceipts"];
  return {
    state: parseSettlementState(input.state), policy: parseSettlementPolicy(input.policy), scope: settlementScope(input.scope, "input.scope"),
    evidence: settlementUnique(v.list(input.evidence, "input.evidence", L.sources).map((x, i) => settlementEvidence(x, `input.evidence.${i}`)), x => x.id, "input.evidence"),
    grants: settlementUnique(v.list(input.grants, "input.grants", L.changes * 3).map((x, i) => grant(x, `input.grants.${i}`)), x => x.id, "input.grants"),
    fullActorCards: settlementUnique(v.list(input.fullActorCards, "input.fullActorCards", 128).map((x, i) => {
      const p = `input.fullActorCards.${i}`, r = v.record(x, p, ["actorId", "digest"]);
      return { actorId: v.id(r.actorId, `${p}.actorId`), digest: settlementDigest(r.digest, `${p}.digest`) };
    }), x => x.actorId, "input.fullActorCards"),
    openThreads: settlementUnique(v.list(input.openThreads, "input.openThreads", L.sources).map((x, i) => {
      const p = `input.openThreads.${i}`, r = v.record(x, p);
      if ((r.until === undefined) !== (r.topicKey === undefined)) v.invalid(p, "Thread lifetime and topic key belong together");
      return { ...savedPoint(x, p, ["id", "scope"], ["until", "topicKey"]), id: v.id(r.id, `${p}.id`), scope: settlementScope(r.scope, `${p}.scope`),
        ...(r.until === undefined ? {} : { until: v.choice(r.until, ["run-end", "event-end", "resolved"] as const, `${p}.until`), topicKey: v.id(r.topicKey, `${p}.topicKey`) }) };
    }), x => x.id, "input.openThreads"),
    priorReceipts: receipts,
    actorLocks: settlementUnique(v.list(input.actorLocks, "input.actorLocks", 128).map((x, i) => {
      const p = `input.actorLocks.${i}`, r = v.record(x, p, ["actorId", "fields"]);
      return { actorId: v.id(r.actorId, `${p}.actorId`), fields: fields(r.fields, `${p}.fields`) };
    }), x => x.actorId, "input.actorLocks"),
    ...(input.lifecycle === undefined ? {} : { lifecycle: settlementUnique(v.list(input.lifecycle, "input.lifecycle", L.sources).map((x, i) => {
      const p = `input.lifecycle.${i}`, r = v.record(x, p, ["kind", "id", "basisIds"]);
      return { kind: v.choice(r.kind, ["run", "event"] as const, `${p}.kind`), id: v.id(r.id, `${p}.id`), basisIds: basis(r.basisIds, `${p}.basisIds`) };
    }), x => `${x.kind}:${x.id}`, "input.lifecycle") }),
  };
}
