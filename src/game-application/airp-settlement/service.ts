import * as v from "../../game-core/contracts";
import { prepareAirpSettlement, settlementTaskIdentity } from "../../game-core/session";
import { emptyUsage } from "../airp-generation/contracts";
import { parseDirectUsage } from "../airp-direct-gameplay/parse";
import { sameHead } from "../transaction";
import { SETTLEMENT_CAPACITY as C, SettlementRuntimeError, type SettlementHostPort, type SettlementHostSnapshot, type SettlementJob, type SettlementLedger, type SettlementMaterials, type SettlementResultCommand } from "./contracts";
import { cloneSettlement, compileSettlementRequest, createSettlementFrame, mechanicalSettlement, programOnlySettlement, settlementHash } from "./context";
import { memoryViewHash, normalizeSettlementMemory } from "./memory";
import { effectiveSettlementMemories, effectiveThreads } from "../airp-memory/effective";

const problem = (message: string, code: SettlementRuntimeError["code"] = "invalid-state"): never => { throw new SettlementRuntimeError(code, message); };
const frameOf = (job: SettlementJob) => job.frames.at(-1)!;
const active = (job: SettlementJob) => job.status !== "applied";
const savedOutput = (job: SettlementJob) => job.revalidatedAttemptId
  ? job.attempts.find(a => a.id === job.revalidatedAttemptId)?.output
  : job.attempts.filter(a => a.frame === job.frames.length - 1 && a.status === "succeeded").at(-1)?.output;

export function createSettlementLedger(policy: v.SettlementPolicy, state: v.SettlementState): SettlementLedger {
  const ledger: SettlementLedger = { version: 1, policy: v.parseSettlementPolicy(policy), state: v.parseSettlementState(state), memories: [], openThreads: [], receipts: [], jobs: [] };
  if (ledger.policy.id !== ledger.state.policyId) problem("Policy mismatch");
  return cloneSettlement(ledger);
}

/** A version-specific host reader still owns program evidence validation and archive import. */
export function validateSettlementSnapshot(snapshot: SettlementHostSnapshot): void {
  v.assertJson(snapshot);
  if (v.utf8Size(JSON.stringify(snapshot)) > C.bytes) problem("Settlement archive capacity exhausted; no history was deleted", "capacity");
  const { head, worldHead, ledger: l } = snapshot;
  if (head.saveId !== worldHead.saveId || head.epoch !== worldHead.epoch || worldHead.revision > head.revision || !sameHead(worldHead, l.state.head)) problem("Host world identity mismatch");
  v.record(l, "settlement.ledger", ["version", "policy", "state", "memories", "openThreads", "receipts", "jobs"]);
  v.choice(l.version, [1], "ledger.version"); v.parseSettlementState(l.state); v.parseSettlementPolicy(l.policy);
  if (l.policy.id !== l.state.policyId) problem("Stored policy mismatch");
  const unique = (ids: string[]) => { if (new Set(ids).size !== ids.length) problem("Duplicate stored settlement identity"); };
  unique(l.jobs.map(j => j.id)); unique(l.receipts.map(r => r.id)); unique(l.receipts.map(r => r.taskId)); unique(l.memories.map(m => m.id)); unique(l.openThreads.map(t => t.id)); unique(l.receipts.flatMap(r => r.effects.map(e => e.id)));
  v.list(l.jobs, "ledger.jobs", C.jobs);
  for (const job of l.jobs) {
    v.record(job, "settlement.job", ["id", "mode", "frames", "attempts", "status", "prepared", "problem"], ["revalidatedAttemptId", "fallback"]);
    v.choice(job.mode, ["mechanical", "model", "program-only"], "job.mode");
    if ((job.mode === "program-only") !== !!job.fallback) problem("Fallback needs explicit provenance");
    if (job.fallback && (job.fallback.reason !== "player-facts-only" || job.fallback.head.saveId !== head.saveId || job.fallback.head.epoch !== head.epoch || job.fallback.head.revision > head.revision || !["ready", "applied", "stale"].includes(job.status))) problem("Invalid facts-only fallback");
    v.choice(job.status, ["pending", "running", "ready", "failed", "stale", "applied"], "job.status");
    if (!job.frames.length) problem("Missing frozen settlement frame");
    v.list(job.frames, "job.frames", C.frames); v.list(job.attempts, "job.attempts", C.attempts); unique(job.attempts.map(a => a.id));
    for (const [index, frame] of job.frames.entries()) {
      if (settlementTaskIdentity(frame.input).taskId !== job.id) problem("Foreign frame in settlement job");
      if (frame.input.state.head.saveId !== head.saveId || frame.input.state.head.epoch !== head.epoch) problem("Foreign saved input");
      compileSettlementRequest(frame, index);
    }
    for (const a of job.attempts) {
      v.record(a, "settlement.attempt", ["id", "frame", "model", "connectionHash", "startedAt", "endedAt", "status", "output", "usage", "outcomeUnknown", "error"]);
      v.number(a.frame, "attempt.frame", 0, job.frames.length - 1); v.number(a.startedAt, "attempt.startedAt"); parseDirectUsage(a.usage);
      v.choice(a.status, ["running", "succeeded", "failed", "interrupted"], "attempt.status");
      if (a.endedAt !== null) v.number(a.endedAt, "attempt.endedAt", a.startedAt);
      if ((a.status === "running") !== (a.endedAt === null)) problem("Attempt completion marker mismatch");
    }
    const running = job.attempts.filter(a => a.status === "running");
    if (running.length > 1 || (job.status === "running") !== (running.length === 1)) problem("Durable attempt state mismatch");
    if (job.revalidatedAttemptId !== undefined) {
      v.id(job.revalidatedAttemptId, "job.revalidatedAttemptId");
      const a = job.attempts.at(-1);
      if (job.mode !== "model" || !job.prepared || !["ready", "applied", "stale"].includes(job.status) || !a || a.id !== job.revalidatedAttemptId || a.frame !== job.frames.length - 1 || a.status !== "failed" || a.error !== "invalid-output" || !a.output) problem("Invalid offline revalidation reference");
    }
    const receipt = l.receipts.find(r => r.taskId === job.id);
    if ((job.status === "applied") !== !!receipt) problem("Applied job/receipt mismatch");
    if (["ready", "applied"].includes(job.status) && !job.prepared) problem("Ready job lost its prepared batch");
    if (receipt && (!job.prepared || receipt.inputHash !== job.prepared.inputHash || settlementHash(receipt.effects) !== settlementHash(job.prepared.effects) || !l.memories.some(m => m.id === receipt.memoryId && settlementHash(m) === settlementHash(job.prepared!.memory)))) problem("Receipt/effects/memory mismatch");
    if (job.prepared) {
      const frame = frameOf(job);
      const output = job.mode === "program-only" ? programOnlySettlement(frame) : job.mode === "mechanical" ? mechanicalSettlement(frame) : v.parseJson(savedOutput(job) ?? "");
      const replay = prepareAirpSettlement(frame.input, normalizeSettlementMemory(frame, output), { head: frame.input.state.head, receipts: frame.input.priorReceipts, appliedItemOperations: [] });
      if (replay.status !== "prepared" || settlementHash(replay.batch) !== settlementHash(job.prepared)) problem("Saved batch differs from its original validated response");
    }
  }
  if (l.receipts.some(r => !l.jobs.some(j => j.id === r.taskId) || r.committedHead.saveId !== head.saveId || r.committedHead.epoch !== head.epoch || r.committedHead.revision > worldHead.revision)) problem("Orphan/foreign settlement receipt");
  if (l.memories.length !== l.receipts.length || l.memories.some(m => !l.receipts.some(r => r.memoryId === m.id))) problem("Orphan settlement memory");
  let threads: v.SettlementThread[] = [];
  for (const memory of l.memories) threads = [...threads.filter(t => !memory.closed.some(c => c.id === t.id)), ...memory.opened];
  if (settlementHash(threads) !== settlementHash(l.openThreads)) problem("Unresolved matters differ from committed memory replay");
  const latest = l.receipts.at(-1);
  if (latest && sameHead(latest.committedHead, worldHead)) {
    // Intervening gameplay may legitimately move actors or change other state.
    // Rebuild from this settlement's frozen world, not every historical effect.
    const expected = cloneSettlement(frameOf(l.jobs.find(j => j.id === latest.taskId)!).input.state);
    for (const effect of latest.effects) {
      if (effect.kind === "affinity") {
        const row = expected.affinity.find(a => a.actorId === effect.actorId);
        if (row) row.value = effect.after; else expected.affinity.push({ actorId: effect.actorId, value: effect.after });
      } else if (effect.kind === "actor") {
        const index = expected.actors.findIndex(a => a.actorId === effect.actorId);
        if (index < 0) expected.actors.push(effect.after); else expected.actors[index] = effect.after;
      }
    }
    expected.head = latest.committedHead;
    if (settlementHash(expected) !== settlementHash(l.state)) problem("State differs from the latest frozen world and applied receipt");
  }
}

function checkInput(snapshot: SettlementHostSnapshot, input: v.SettlementInput, materials: SettlementMaterials): void {
  if (memoryViewHash(snapshot.memoryView) !== memoryViewHash(materials.memoryView)) problem("Effective memory changed; refresh the settlement input", "stale-result");
  if (!sameHead(snapshot.worldHead, input.state.head) || settlementHash(snapshot.ledger.state) !== settlementHash(input.state) || settlementHash(snapshot.ledger.policy) !== settlementHash(input.policy)) problem("Settlement input is not the current committed state", "stale-result");
  if (settlementHash(input.openThreads) !== settlementHash(snapshot.ledger.openThreads) || settlementHash(input.priorReceipts) !== settlementHash(snapshot.ledger.receipts)) problem("Input omitted or changed prior receipts/unresolved matters");
}
function prepare(snapshot: SettlementHostSnapshot, job: SettlementJob, output?: string): v.SettlementBatch {
  const frame = frameOf(job);
  const proposal = job.mode === "program-only" ? programOnlySettlement(frame) : job.mode === "mechanical" ? mechanicalSettlement(frame) : v.parseJson(output ?? savedOutput(job) ?? "");
  const result = prepareAirpSettlement(frame.input, normalizeSettlementMemory(frame, proposal), { head: snapshot.worldHead, receipts: snapshot.ledger.receipts, appliedItemOperations: snapshot.appliedItemOperations });
  if (result.status !== "prepared") return problem("Already applied job must be recovered from its receipt");
  return cloneSettlement(result.batch);
}

/** Network stays outside these transactions. All writes go through the owning aggregate's CAS port. */
export function createSettlementService(port: SettlementHostPort) {
  async function read() { const s = await port.read(); validateSettlementSnapshot(s); return s; }
  function jobIn(s: SettlementHostSnapshot, id: string) { return s.ledger.jobs.find(j => j.id === id) ?? problem("Settlement job not found"); }
  const persist = (s: SettlementHostSnapshot, next: SettlementLedger, kind: "metadata" | "settlement" = "metadata", effects: v.SettlementEffect[] = []) =>
    port.commit({ expectedHead: s.head, expectedWorldHead: s.worldHead, kind, next, effects });
  async function current(s: SettlementHostSnapshot, job: SettlementJob): Promise<void> {
    if (!sameHead(frameOf(job).input.state.head, s.worldHead) || frameOf(job).materials.memoryView && memoryViewHash(frameOf(job).materials.memoryView) !== memoryViewHash(s.memoryView)) {
      const next = cloneSettlement(s.ledger), target = next.jobs.find(j => j.id === job.id)!;
      target.status = "stale"; target.problem = "stale-result";
      for (const a of target.attempts.filter(a => a.status === "running")) { a.status = "interrupted"; a.endedAt = a.startedAt; a.error = "stale-result"; a.outcomeUnknown = true; }
      await persist(s, next);
      problem("World changed; keep old output and explicitly refresh the task input", "stale-result");
    }
  }
  return {
    read,
    async enqueue(input: v.SettlementInput, materials: SettlementMaterials) {
      const s = await read(), id = settlementTaskIdentity(input).taskId;
      const existing = s.ledger.jobs.find(j => j.id === id);
      if (existing) {
        if (settlementHash(frameOf(existing).input) !== settlementHash(input) || settlementHash(frameOf(existing).materials) !== settlementHash(materials)) problem("Existing task has different input; use explicit refresh");
        return existing.id;
      }
      checkInput(s, input, materials);
      if (s.ledger.jobs.length >= C.jobs) problem("Settlement job capacity exhausted", "capacity");
      const frame = createSettlementFrame(input, materials);
      const mode = input.grants.length || input.evidence.some(e => e.role === "current" && e.kind === "read-paragraph") ? "model" : "mechanical";
      const job: SettlementJob = { id, mode, frames: [frame], attempts: [], status: "pending", prepared: null, problem: null };
      if (mode === "mechanical") { job.prepared = prepare(s, job); job.status = "ready"; }
      const next = cloneSettlement(s.ledger); next.jobs.push(job); await persist(s, next); return id;
    },
    async refresh(jobId: string, input: v.SettlementInput, materials: SettlementMaterials) {
      const s = await read(), job = jobIn(s, jobId);
      if (job.status === "running" || job.status === "applied" || job.frames.length >= C.frames) problem("Cannot replace running/applied task or exceed frame capacity");
      if (settlementTaskIdentity(input).taskId !== jobId) problem("Refresh cannot change event/action/run identity");
      checkInput(s, input, materials);
      const next = cloneSettlement(s.ledger), target = next.jobs.find(j => j.id === jobId)!;
      target.frames.push(createSettlementFrame(input, materials)); target.prepared = null; target.status = "pending"; target.problem = null;
      delete target.revalidatedAttemptId;
      delete target.fallback;
      target.mode = input.grants.length || input.evidence.some(e => e.role === "current" && e.kind === "read-paragraph") ? "model" : "mechanical";
      if (target.mode === "mechanical") { target.prepared = prepare(s, target); target.status = "ready"; }
      return persist(s, next);
    },
    /** No network, rewriting or synthetic model attempt. Caller explicitly retries admission. */
    async useProgramFacts(jobId: string) {
      const s = await read(), job = jobIn(s, jobId);
      if (job.mode === "program-only" && ["ready", "applied"].includes(job.status)) return s;
      await current(s, job);
      if (job.mode !== "model" || !["pending", "failed"].includes(job.status)) problem("Only an unsent/failed assessment can use explicit facts-only fallback");
      const next = cloneSettlement(s.ledger), target = next.jobs.find(j => j.id === jobId)!;
      target.mode = "program-only"; target.fallback = { reason: "player-facts-only", head: s.head };
      delete target.revalidatedAttemptId;
      target.prepared = prepare(s, target); target.status = "ready"; target.problem = null;
      return persist(s, next);
    },
    async revalidate(jobId: string) {
      const s = await read(), job = jobIn(s, jobId);
      if (job.status === "ready" || job.status === "applied") return s;
      await current(s, job);
      const a = job.attempts.at(-1);
      if (job.mode !== "model" || job.status !== "failed" || !a || a.frame !== job.frames.length - 1 || a.status !== "failed" || a.error !== "invalid-output" || !a.output) return problem("No saved validation failure to revalidate");
      const batch = prepare(s, job, a.output);
      const next = cloneSettlement(s.ledger), target = next.jobs.find(j => j.id === jobId)!;
      target.prepared = batch; target.status = "ready"; target.problem = null; target.revalidatedAttemptId = a.id;
      return persist(s, next);
    },
    async begin(jobId: string, attempt: { id: string; model: string; connectionHash: string; at: number }) {
      const s = await read(), job = jobIn(s, jobId); await current(s, job);
      if (job.mode !== "model" || !["pending", "failed"].includes(job.status) || job.attempts.length >= C.attempts || job.attempts.some(a => a.id === attempt.id)) problem("Task is not eligible for another model attempt");
      v.id(attempt.id, "attempt.id"); v.text(attempt.model, "attempt.model", 200); v.number(attempt.at, "attempt.at");
      if (!/^[a-f0-9]{64}$/.test(attempt.connectionHash)) problem("Invalid connection fingerprint");
      const next = cloneSettlement(s.ledger), target = next.jobs.find(j => j.id === jobId)!;
      target.attempts.push({ id: attempt.id, frame: target.frames.length - 1, model: attempt.model, connectionHash: attempt.connectionHash, startedAt: attempt.at, endedAt: null, status: "running", output: null, usage: emptyUsage(), outcomeUnknown: false, error: null });
      target.status = "running"; target.problem = null; await persist(s, next);
      return compileSettlementRequest(frameOf(target), target.frames.length - 1);
    },
    async result(command: SettlementResultCommand) {
      const s = await read(), job = jobIn(s, command.jobId), original = job.attempts.find(a => a.id === command.attemptId);
      if (!original) problem("No matching attempt");
      if (original!.status !== "running") {
        if (original!.output === command.output && settlementHash(original!.usage) === settlementHash(command.usage) && original!.endedAt === command.at) return s;
        problem("Result does not match the saved attempt", "stale-result");
      }
      v.text(command.output, "settlement.output", C.inputBytes); v.number(command.at, "result.at", original!.startedAt); parseDirectUsage(command.usage);
      const next = cloneSettlement(s.ledger), target = next.jobs.find(j => j.id === command.jobId)!, a = target.attempts.find(a => a.id === command.attemptId)!;
      a.output = command.output; a.usage = command.usage; a.endedAt = command.at;
      const stale = a.frame !== target.frames.length - 1 || !sameHead(frameOf(target).input.state.head, s.worldHead)
        || !!frameOf(target).materials.memoryView && memoryViewHash(frameOf(target).materials.memoryView) !== memoryViewHash(s.memoryView);
      try {
        if (stale) problem("Late result", "stale-result");
        target.prepared = prepare(s, target, command.output); target.status = "ready"; target.problem = null; a.status = "succeeded";
      } catch {
        target.prepared = null; target.status = stale ? "stale" : "failed"; target.problem = stale ? "stale-result" : "invalid-output"; a.status = "failed"; a.error = target.problem;
      }
      // Invalid and late raw output + usage are durable too, but never change variables or memory.
      return persist(s, next);
    },
    async fail(jobId: string, attemptId: string, failure: { at: number; error: "provider-error" | "cancelled" | "interrupted"; outcomeUnknown: boolean; usage: import("../airp-generation/contracts").Usage }) {
      const s = await read(), next = cloneSettlement(s.ledger), job = next.jobs.find(j => j.id === jobId) ?? problem("Unknown task"), a = job.attempts.find(a => a.id === attemptId) ?? problem("Unknown attempt");
      if (a.status !== "running") problem("Attempt is no longer running");
      v.number(failure.at, "failure.at", a.startedAt); parseDirectUsage(failure.usage);
      v.choice(failure.error, ["provider-error", "cancelled", "interrupted"], "failure.error"); v.boolean(failure.outcomeUnknown, "failure.outcomeUnknown");
      a.endedAt = failure.at; a.status = failure.error === "interrupted" ? "interrupted" : "failed"; a.error = failure.error; a.outcomeUnknown = failure.outcomeUnknown; a.usage = failure.usage;
      job.status = "failed"; job.problem = failure.error; return persist(s, next);
    },
    async apply(jobId: string) {
      const s = await read(), job = jobIn(s, jobId);
      if (job.status === "applied") return s; // Lost commit response: recover, never issue assets again.
      if (job.status !== "ready") problem("Only a saved, validated result can be applied");
      await current(s, job);
      const batch = prepare(s, job);
      if (settlementHash(batch) !== settlementHash(job.prepared)) problem("Prepared batch differs from replayed model result");
      const next = cloneSettlement(s.ledger), newHead = { ...s.head, revision: s.head.revision + 1 };
      for (const effect of batch.effects) {
        if (effect.kind === "affinity") {
          const row = next.state.affinity.find(a => a.actorId === effect.actorId);
          if ((row?.value ?? next.policy.affinity.initial) !== effect.before) problem("Affinity changed before commit", "stale-result");
          if (row) row.value = effect.after; else next.state.affinity.push({ actorId: effect.actorId, value: effect.after });
        } else if (effect.kind === "actor") {
          const index = next.state.actors.findIndex(a => a.actorId === effect.actorId);
          if (index < 0) next.state.actors.push(effect.after); else next.state.actors[index] = effect.after;
        }
      }
      next.state.head = newHead;
      next.memories.push(batch.memory);
      next.openThreads = [...next.openThreads.filter(t => !batch.memory.closed.some(c => c.id === t.id)), ...batch.memory.opened];
      next.receipts.push({ id: `settled:${settlementHash([jobId, batch.inputHash])}`, taskId: jobId, inputHash: batch.inputHash, committedHead: newHead, effects: batch.effects, memoryId: batch.memory.id });
      const target = next.jobs.find(j => j.id === jobId)!; target.status = "applied"; target.problem = null;
      try { return await persist(s, next, "settlement", batch.effects); }
      catch (error) {
        if (error instanceof SettlementRuntimeError && error.code === "asset-pending") {
          const latest = await read();
          if (jobIn(latest, jobId).status === "ready") {
            const retained = cloneSettlement(latest.ledger); retained.jobs.find(j => j.id === jobId)!.problem = "asset-pending"; await persist(latest, retained);
          }
        }
        throw error;
      }
    },
    async contextForNextGm(allowExplicitPending = false) {
      const s = await read(), pending = s.ledger.jobs.filter(active).map(j => ({ id: j.id, status: j.status, problem: j.problem }));
      if (pending.length && !allowExplicitPending) problem("Dependent GM/scenes must wait for pending settlements", "pending-dependency");
      return cloneSettlement({ state: s.ledger.state, memories: s.memoryView ? effectiveSettlementMemories(s.ledger.memories, s.memoryView) : s.ledger.memories, openThreads: s.memoryView ? effectiveThreads(s.memoryView) : s.ledger.openThreads, receipts: s.ledger.receipts, pending });
    },
  };
}
