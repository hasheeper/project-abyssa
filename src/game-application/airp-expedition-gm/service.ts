import { assertJson, parseJson, parseExpeditionPlan, parseExpeditionThemeReview, utf8Size } from "../../game-core/contracts";
import { expeditionPlanHash, expeditionReviewRequired, expeditionTaskId, validateExpeditionPlan } from "../../game-core/session";
import type { Usage } from "../airp-generation/contracts";
import { emptyUsage } from "../airp-generation/contracts";
import { parseDirectUsage } from "../airp-direct-gameplay/parse";
import { sameHead } from "../transaction";
import { cloneExpedition, compileExpeditionRequest, expeditionWorldFingerprint, freezeExpeditionFrame } from "./context";
import { admitMemoryCorrections, correctionEnvelope } from "../airp-memory/effective";
import { EXPEDITION_RUNTIME_CAPACITY as C, ExpeditionGMError, type ExpeditionAttempt, type ExpeditionGMHostPort, type ExpeditionGMCommit, type ExpeditionGMLedger, type ExpeditionGMSnapshot, type ExpeditionJob } from "./contracts";

export const emptyExpeditionGMLedger = (): ExpeditionGMLedger => ({ version: 1, jobs: [] });
export const currentExpeditionFrame = (j: ExpeditionJob) => j.frames.at(-1)!;
const fail = (message: string, code: ExpeditionGMError["code"] = "invalid"): never => { throw new ExpeditionGMError(code, message); };
const hashEqual = (a: unknown, b: unknown) => expeditionPlanHash(a) === expeditionPlanHash(b);
export function nextExpeditionStage(j: ExpeditionJob): "plan" | "review" | null {
  if (!["pending", "review", "failed"].includes(j.status)) return null;
  return j.prepared && expeditionReviewRequired(j.prepared.proposal) && !j.prepared.review ? "review" : "plan";
}
export function validateExpeditionGMSnapshot(s: ExpeditionGMSnapshot) {
  assertJson(s);
  if (s.ledger.version !== 1 || s.ledger.jobs.length > C.jobs || utf8Size(JSON.stringify(s)) > C.bytes) fail("Expedition ledger capacity/version invalid", "capacity");
  if (s.head.saveId !== s.context.rules.head.saveId || s.head.epoch !== s.context.rules.head.epoch || s.context.rules.head.revision > s.head.revision) fail("World/archive identity mismatch");
  if (new Set(s.ledger.jobs.map(j => j.id)).size !== s.ledger.jobs.length) fail("Duplicate trip job");
  for (const j of s.ledger.jobs) {
    if (!j.frames.length || j.frames.length > C.frames || j.attempts.length > C.attempts || new Set(j.attempts.map(a => a.id)).size !== j.attempts.length) fail("Invalid frozen job capacity/identity");
    for (const [index, f] of j.frames.entries()) {
      compileExpeditionRequest(f, index);
      if (j.id !== expeditionTaskId(f.context.rules) || f.context.rules.head.saveId !== s.head.saveId || f.context.rules.head.epoch !== s.head.epoch) fail("Foreign frame");
    }
    for (const a of j.attempts) {
      if (!j.frames[a.frame] || !Number.isSafeInteger(a.at) || a.at < 0 || a.endedAt !== null && a.endedAt < a.at || (a.status === "running") !== (a.endedAt === null)) fail("Invalid model attempt");
      parseDirectUsage(a.usage);
    }
    if (j.attempts.filter(a => a.status === "running").length !== (j.status === "running" ? 1 : 0)) fail("Running marker mismatch");
    for (const a of j.attempts.filter(a => a.status === "succeeded" && a.stage === "plan")) {
      const memory = j.frames[a.frame].context.gmContext?.memoryContext;
      const saved = j.memoryCorrections?.filter(r => r.attemptId === a.id) ?? [];
      if (!memory) { if (saved.length) fail("Old GM frame cannot amend memory"); continue; }
      const recordedHead = saved[0]?.recordedHead ?? s.head;
      if (recordedHead.saveId !== s.head.saveId || recordedHead.epoch !== s.head.epoch || recordedHead.revision > s.head.revision || recordedHead.revision <= memory.sourceHead.revision) fail("Invalid memory correction commit head");
      const replay = admitMemoryCorrections(parseJson(a.output!), memory, {jobId: j.id, attemptId: a.id, recordedHead});
      if (!hashEqual(saved, replay)) fail("Memory corrections differ from original GM response");
    }
    if (j.memoryCorrections?.some(r => !j.attempts.some(a => a.id === r.attemptId && a.stage === "plan" && a.status === "succeeded"))) fail("Correction has no successful GM source");
    if (["ready", "review", "accepted", "started"].includes(j.status) && !j.prepared) fail("Missing frozen plan");
    if (["accepted", "started"].includes(j.status) && (!j.acceptedAt || expeditionReviewRequired(j.prepared!.proposal) && !j.prepared!.review)) fail("Plan adopted without independent theme review");
    if (j.status === "started" && (!j.startFactId || !j.departureTicket)) fail("Started plan lacks real departure proof/ticket");
    if (j.prepared) {
      const f = currentExpeditionFrame(j), planAttempt = j.attempts.filter(a => a.frame === j.frames.length - 1 && a.stage === "plan" && a.status === "succeeded").at(-1);
      if (!planAttempt?.output || !hashEqual(parseExpeditionPlan(correctionEnvelope(parseJson(planAttempt.output), !!f.context.gmContext?.memoryContext)), j.prepared.proposal)) fail("Plan differs from original model output");
      if (j.prepared.review) {
        const a = j.attempts.filter(a => a.frame === j.frames.length - 1 && a.stage === "review" && a.status === "succeeded").at(-1);
        if (!a?.output || !hashEqual(parseExpeditionThemeReview(parseJson(a.output)), j.prepared.review)) fail("Review lacks independent response");
      }
      const replay = validateExpeditionPlan(f.context.rules, j.prepared.proposal, f.inputHash, j.prepared.review ?? undefined);
      if (!hashEqual(replay, j.prepared)) fail("Frozen plan/definitions differ from validated replay");
    }
  }
}

export function createExpeditionGMService(port: ExpeditionGMHostPort) {
  const read = async (refresh = false) => { const s = await port.read(refresh ? {refresh: true} : undefined); validateExpeditionGMSnapshot(s); return s; };
  const jobIn = (s: ExpeditionGMSnapshot, id: string) => s.ledger.jobs.find(j => j.id === id) ?? fail("Unknown expedition job");
  const persist = (s: ExpeditionGMSnapshot, next: ExpeditionGMLedger, change: ExpeditionGMCommit["change"] = null) => port.commit({ expectedHead: s.head, next, change });
  const sameWorld = (s: ExpeditionGMSnapshot, j: ExpeditionJob) => {
    const f = currentExpeditionFrame(j), ownIds = j.prepared?.events.map(e => e.id) ?? [];
    const normalized = (schedule: typeof s.context.rules.schedule) => ({ ...schedule, reservations: schedule.reservations.filter(r => r.ownerId !== j.id), themes: schedule.themes.filter(t => !ownIds.includes(t.sourceId)) });
    return hashEqual(expeditionWorldFingerprint(s.context, s.documents), expeditionWorldFingerprint(f.context, f.documents)) && hashEqual(normalized(s.context.rules.schedule), normalized(f.context.rules.schedule));
  };
  async function current(s: ExpeditionGMSnapshot, j: ExpeditionJob) {
    if (s.activeRunId || s.startProofs.some(p => p.runId === currentExpeditionFrame(j).departure.runId) || !sameWorld(s, j)) {
      if (!["accepted", "started", "cancelled"].includes(j.status)) {
        const next = cloneExpedition(s.ledger), target = next.jobs.find(x => x.id === j.id)!; target.status = "stale";
        for (const a of target.attempts.filter(a => a.status === "running")) { a.status = "interrupted"; a.endedAt = a.at; a.outcomeUnknown = true; }
        await persist(s, next);
      }
      fail("Departure/world changed; explicitly refresh or cancel the unstarted plan", "stale");
    }
  }
  return {
    read,
    async enqueue() {
      const s = await read(), frame = freezeExpeditionFrame(s.context, s.documents, s.departure), id = expeditionTaskId(frame.context.rules), old = s.ledger.jobs.find(j => j.id === id);
      if (old) { if (!sameWorld(s, old) || !hashEqual(currentExpeditionFrame(old).departure, s.departure)) fail("Existing run has another frozen input; refresh explicitly"); return id; }
      if (s.activeRunId || s.startProofs.some(p => p.runId === frame.departure.runId)) fail("Cannot plan an already-started run");
      if (s.ledger.jobs.some(j => !["started", "cancelled"].includes(j.status))) fail("Finish or cancel the previous departure preparation");
      const next = cloneExpedition(s.ledger); next.jobs.push({ id, frames: [frame], attempts: [], status: "pending", prepared: null, problem: null, acceptedAt: null, startFactId: null, departureTicket: null });
      await persist(s, next); return id;
    },
    async refresh(id: string) {
      const s = await read(true), j = jobIn(s, id), f = currentExpeditionFrame(j);
      if (["running", "started", "cancelled"].includes(j.status) || j.frames.length >= C.frames || s.activeRunId || s.startProofs.some(p => p.runId === f.departure.runId)) fail("Cannot refresh a started/cancelled/running or exhausted task");
      const context = cloneExpedition(s.context);
      context.rules.schedule.reservations = context.rules.schedule.reservations.filter(r => r.ownerId !== id);
      const ownIds = j.prepared?.events.map(e => e.id) ?? [];
      context.rules.schedule.themes = context.rules.schedule.themes.filter(t => !ownIds.includes(t.sourceId));
      const frame = freezeExpeditionFrame(context, s.documents, s.departure);
      if (expeditionTaskId(frame.context.rules) !== id) fail("Refresh cannot change run identity; cancel and prepare the new run");
      const next = cloneExpedition(s.ledger), target = next.jobs.find(x => x.id === id)!;
      target.frames.push(frame); target.prepared = null; target.status = "pending"; target.problem = null; target.acceptedAt = null; target.departureTicket = null;
      return persist(s, next, j.status === "accepted" ? { kind: "release", plan: j.prepared! } : null);
    },
    async begin(id: string, request: Pick<ExpeditionAttempt, "id" | "stage" | "model" | "connectionHash" | "at">) {
      const s = await read(), j = jobIn(s, id); await current(s, j);
      if (nextExpeditionStage(j) !== request.stage || j.attempts.length >= C.attempts || j.attempts.some(a => a.id === request.id)) fail("This model stage is not eligible");
      if (!/^[a-f0-9]{64}$/.test(request.connectionHash) || !/^[A-Za-z0-9][A-Za-z0-9_.:/-]*$/.test(request.id) || !request.model || !Number.isSafeInteger(request.at) || request.at < 0) fail("Invalid attempt metadata");
      const previous = j.attempts.find(a => a.frame === j.frames.length - 1 && a.stage === request.stage);
      if (previous && previous.connectionHash !== request.connectionHash) fail("Changed model connection requires explicit refresh");
      const next = cloneExpedition(s.ledger), target = next.jobs.find(x => x.id === id)!;
      target.attempts.push({ ...request, frame: target.frames.length - 1, endedAt: null, output: null, usage: emptyUsage(), status: "running", outcomeUnknown: false }); target.status = "running"; target.problem = null;
      await persist(s, next);
      return compileExpeditionRequest(currentExpeditionFrame(j), j.frames.length - 1, request.stage === "review" ? j.prepared!.proposal : undefined);
    },
    async result(id: string, attemptId: string, output: string, usage: Usage, at: number) {
      const s = await read(), j = jobIn(s, id), original = j.attempts.find(a => a.id === attemptId) ?? fail("Unknown sent request");
      if (original.output !== null) { if (original.output === output && hashEqual(original.usage, usage) && original.endedAt === at) return s; fail("Result changed after saving"); }
      if (utf8Size(output) > 2 * 1024 * 1024 || !Number.isSafeInteger(at) || at < original.at) fail("Response capacity/time invalid"); parseDirectUsage(usage);
      const next = cloneExpedition(s.ledger), target = next.jobs.find(x => x.id === id)!, a = target.attempts.find(a => a.id === attemptId)!;
      a.output = output; a.usage = usage; a.endedAt = at;
      if (a.frame !== target.frames.length - 1 || target.status === "cancelled" || !sameWorld(s, j) || s.activeRunId) {
        a.status = "failed"; if (target.status !== "cancelled" && a.frame === target.frames.length - 1) { target.status = "stale"; target.problem = "stale-result"; }
      } else {
        try {
          const f = currentExpeditionFrame(target);
          const prepared = a.stage === "plan" ? validateExpeditionPlan(f.context.rules, correctionEnvelope(parseJson(output), !!f.context.gmContext?.memoryContext), f.inputHash)
            : validateExpeditionPlan(f.context.rules, target.prepared!.proposal, f.inputHash, parseJson(output));
          target.prepared = prepared; target.status = expeditionReviewRequired(prepared.proposal) && !prepared.review ? "review" : "ready"; target.problem = null; a.status = "succeeded";
          if (a.stage === "plan" && f.context.gmContext?.memoryContext) (target.memoryCorrections ??= []).push(...admitMemoryCorrections(parseJson(output), f.context.gmContext.memoryContext, {jobId: target.id, attemptId: a.id, recordedHead: {...s.head, revision: s.head.revision + 1}}));
        } catch { a.status = "failed"; target.status = "failed"; target.problem = "invalid-output"; if (a.stage === "plan") target.prepared = null; }
      }
      return persist(s, next);
    },
    async fail(id: string, attemptId: string, at: number, usage = emptyUsage(), outcomeUnknown = true) {
      const s = await read(), next = cloneExpedition(s.ledger), j = next.jobs.find(j => j.id === id) ?? fail("Unknown job"), a = j.attempts.find(a => a.id === attemptId) ?? fail("Unknown attempt");
      if (a.status !== "running" || at < a.at) fail("No matching running attempt"); parseDirectUsage(usage);
      a.status = "interrupted"; a.endedAt = at; a.usage = usage; a.outcomeUnknown = outcomeUnknown; j.status = "failed"; j.problem = "interrupted";
      return persist(s, next);
    },
    async accept(id: string) {
      const s = await read(), j = jobIn(s, id);
      if (["accepted", "started"].includes(j.status)) return s;
      if (j.status !== "ready") fail("No validated plan to accept");
      const prepared = j.prepared ?? fail("No validated plan to accept"); await current(s, j);
      if (expeditionReviewRequired(prepared.proposal) && !prepared.review) fail("Independent theme review is required");
      const f = currentExpeditionFrame(j), plan = validateExpeditionPlan(f.context.rules, prepared.proposal, f.inputHash, prepared.review ?? undefined, s.context.rules.schedule);
      const next = cloneExpedition(s.ledger), target = next.jobs.find(x => x.id === id)!;
      target.status = "accepted"; target.acceptedAt = { ...s.head, revision: s.head.revision + 1 }; target.problem = null;
      return persist(s, next, { kind: "accept", plan });
    },
    async cancel(id: string) {
      const s = await read(), j = jobIn(s, id);
      if (j.status === "cancelled") return s;
      if (j.status === "started" || s.activeRunId || s.startProofs.some(p => p.runId === currentExpeditionFrame(j).departure.runId)) fail("Started plan cannot be cancelled or rewritten");
      const next = cloneExpedition(s.ledger), target = next.jobs.find(x => x.id === id)!;
      for (const a of target.attempts.filter(a => a.status === "running")) { a.status = "interrupted"; a.endedAt = a.at; a.outcomeUnknown = true; }
      target.status = "cancelled"; target.problem = null;
      return persist(s, next, j.status === "accepted" ? { kind: "release", plan: j.prepared! } : null);
    },
    async departurePermit(id: string) {
      const s = await read(), j = jobIn(s, id); if (j.status !== "accepted") fail("Departure requires an adopted plan");
      const prepared = j.prepared ?? fail("Departure requires an adopted plan"); await current(s, j);
      const f = currentExpeditionFrame(j); validateExpeditionPlan(f.context.rules, prepared.proposal, f.inputHash, prepared.review ?? undefined, s.context.rules.schedule);
      if (prepared.reservations.some(r => !s.context.rules.schedule.reservations.some(saved => hashEqual(r, saved))) || prepared.itemDefinitions.some(d => !s.itemDefinitions.some(saved => hashEqual(saved, d)))) fail("Shared reservations or frozen asset definitions are missing");
      let expectedHead = s.head;
      if (!j.departureTicket || !sameHead(j.departureTicket.expectedHead, s.head)) {
        expectedHead = { ...s.head, revision: s.head.revision + 1 };
        const next = cloneExpedition(s.ledger);
        next.jobs.find(x => x.id === id)!.departureTicket = { expectedHead, proposalHash: prepared.proposalHash, commandHash: f.context.rules.departure.commandHash };
        await persist(s, next);
      }
      return cloneExpedition({ expectedHead, planId: id, proposalHash: prepared.proposalHash, departure: f.departure });
    },
    /** Recover only from the owning program's validated departure fact; not a model/GUI boolean. */
    async recordStarted(id: string) {
      const s = await read(), j = jobIn(s, id); if (j.status === "started") return s;
      if (j.status !== "accepted") fail("No adopted plan to bind");
      const f = currentExpeditionFrame(j), proof = s.startProofs.find(p => p.runId === f.departure.runId && p.commandHash === f.context.rules.departure.commandHash && j.departureTicket && sameHead(p.beforeHead, j.departureTicket.expectedHead)) ?? fail("No matching real departure proof/ticket revision");
      const next = cloneExpedition(s.ledger), target = next.jobs.find(x => x.id === id)!; target.status = "started"; target.startFactId = proof.factId;
      return persist(s, next);
    },
  };
}
