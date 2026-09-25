import * as v from "../../game-core/contracts";
import { expeditionPlanHash, expeditionReviewRequired, validateExpeditionPlan } from "../../game-core/session";
import type { HeadRef } from "../contracts";
import { parseHead } from "../parse";
import { sameHead } from "../transaction";
import type { D5Fact, D5GameRecord } from "../versions/d5-contracts";
import type { ExpeditionFrame, ExpeditionJob } from "../airp-expedition-gm/contracts";
import type { GMShare } from "./gm-share-contracts";
import { correctionEnvelope } from "../airp-memory/effective";
export type { GMShare } from "./gm-share-contracts";

const equal = (a: unknown, b: unknown) => v.canonicalJson(a) === v.canonicalJson(b);
function fail(message: string): never { return v.invalid("gmShare", message); }
const within = (head: HeadRef, limit: HeadRef) => head.saveId === limit.saveId && head.epoch === limit.epoch && head.revision <= limit.revision;

function planContent(jobId: string, frameIndex: number, frame: ExpeditionFrame, proposal: v.ExpeditionPlanProposal) {
  const rules = frame.context.rules, d = rules.departure;
  const slotIds = new Set([...proposal.nodes.map(n => n.slotId), ...rules.commissions.map(c => c.slotId)]);
  return { jobId, frameIndex, frameVersion: frame.version, frameHead: frame.context.rules.head, promptVersion: frame.promptVersion,
    inputHash: frame.inputHash, proposalHash: expeditionPlanHash(proposal),
    departure: { runId: d.runId, routeId: d.routeId, partyIds: d.partyIds, itemIds: d.itemIds, commandHash: d.commandHash, intent: d.intent },
    proposal, slots: rules.slots.filter(s => slotIds.has(s.id)), commissions: rules.commissions };
}
function nodeReads(record: D5GameRecord, head: HeadRef): GMShare["reads"] {
  const game = record.airpGame;
  if (!game) return [];
  return Object.values(game.nodes).flatMap(ledger => ledger.jobs.flatMap(node => {
    if (!node.reads.length) return [];
    const plan = game.gm.jobs.find(j => j.id === node.planId);
    const frame = plan?.frames.find(f => f.inputHash === plan.prepared?.inputHash);
    if (!frame || !node.frame || !node.text) return fail("Read node lacks its original plan/frame/text");
    return node.reads.flatMap((readHead, index) => {
      if (!within(readHead, head)) return [];
      const line = node.text!.lines[index];
      if (!line) return fail("Read cursor exceeds original text");
      return [{ sourceId: `read:${node.id}:${index}`, sceneId: node.id, runId: frame.context.rules.departure.runId,
        text: `${line.speaker}：${line.text}`, knownBy: line.speaker === "narrator" ? ["kael"] : ["kael", ...Object.keys(node.frame!.scene.actors)], head: readHead }];
    });
  }));
}

/** Only the live owning transaction calls this; historical consumers use readGMShare instead. */
export function projectGMShare(record: D5GameRecord): GMShare {
  const game = record.airpGame;
  const plans: GMShare["plans"] = (game?.gm.jobs ?? []).flatMap(job => {
    if (job.status !== "accepted" && job.status !== "started") return [];
    const frameIndex = job.frames.length - 1, frame = job.frames[frameIndex];
    if (!frame || !job.prepared || !job.acceptedAt) return fail("Adopted plan lacks frozen provenance");
    return [{ ...planContent(job.id, frameIndex, frame, job.prepared.proposal), status: job.status, acceptedAt: job.acceptedAt, startFactId: job.startFactId }];
  });
  const pendingSettlements: GMShare["pendingSettlements"] = (game?.settlement.jobs ?? []).flatMap(job => {
    if (job.status === "applied") return [];
    const frameIndex = job.frames.length - 1, frame = job.frames[frameIndex];
    if (!frame) return fail("Pending settlement lacks frozen scope");
    return [{ jobId: job.id, frameIndex, scope: frame.input.scope, status: job.status }];
  });
  const memoryCorrections = (game?.gm.jobs ?? []).flatMap(j => j.memoryCorrections ?? []);
  return structuredClone({ version: 1, sourceHead: record.head, plans, reads: nodeReads(record, record.head), pendingSettlements, ...(memoryCorrections.length ? {memoryCorrections} : {}) });
}

/** Head-only bookkeeping must not duplicate an otherwise identical public snapshot. */
export function sameGMShareContent(a: GMShare, b: GMShare): boolean {
  const { sourceHead: _a, ...left } = a, { sourceHead: _b, ...right } = b;
  return equal(left, right);
}

export function parseGMShare(raw: unknown): GMShare {
  v.assertJson(raw);
  const s = v.record(raw, "gmShare", ["version", "sourceHead", "plans", "reads", "pendingSettlements"], ["memoryCorrections"]);
  if (s.memoryCorrections !== undefined) v.list(s.memoryCorrections, "gmShare.memoryCorrections");
  v.choice(s.version, [1], "gmShare.version"); parseHead(s.sourceHead);
  const plans = v.list(s.plans, "gmShare.plans", 48);
  for (const rawPlan of plans) {
    const p = v.record(rawPlan, "gmShare.plan", ["jobId", "frameIndex", "frameVersion", "frameHead", "promptVersion", "inputHash", "proposalHash", "status", "acceptedAt", "startFactId", "departure", "proposal", "slots", "commissions"]);
    v.id(p.jobId, "plan.jobId"); v.number(p.frameIndex, "plan.frameIndex", 0, 3); v.choice(p.frameVersion, [1], "plan.frameVersion");
    parseHead(p.frameHead); parseHead(p.acceptedAt); v.text(p.promptVersion, "plan.promptVersion");
    v.settlementDigest(p.inputHash, "plan.inputHash"); v.settlementDigest(p.proposalHash, "plan.proposalHash");
    v.choice(p.status, ["accepted", "started"], "plan.status"); if (p.startFactId !== null) v.id(p.startFactId, "plan.startFactId");
    const d = v.record(p.departure, "plan.departure", ["runId", "routeId", "partyIds", "itemIds", "commandHash", "intent"]);
    v.id(d.runId, "departure.runId"); v.id(d.routeId, "departure.routeId"); v.ids(d.partyIds, "departure.partyIds"); v.ids(d.itemIds, "departure.itemIds");
    v.settlementDigest(d.commandHash, "departure.commandHash"); v.text(d.intent, "departure.intent", 4000); v.parseExpeditionPlan(p.proposal);
    for (const rawSlot of v.list(p.slots, "plan.slots")) {
      const slot = v.record(rawSlot, "plan.slot", ["id", "layer", "roomIndex", "roomDefinitionId", "timing", "actorIds", "actionIds", "objectiveIds"]);
      v.id(slot.id, "slot.id"); v.number(slot.layer, "slot.layer", 1); v.number(slot.roomIndex, "slot.roomIndex"); v.id(slot.roomDefinitionId, "slot.roomDefinitionId");
      v.choice(slot.timing, ["arrive", "cleared", "exit"], "slot.timing");
      for (const key of ["actorIds", "actionIds", "objectiveIds"]) v.ids(slot[key], `slot.${key}`);
    }
    for (const rawCommission of v.list(p.commissions, "plan.commissions")) {
      const c = v.record(rawCommission, "plan.commission", ["eventId", "stepId", "definitionId", "title", "objectiveId", "slotId", "actorIds", "basisIds", "returnRequired"], ["itemTemplateId"]);
      if (c.itemTemplateId !== undefined) v.id(c.itemTemplateId, "commission.itemTemplateId");
      for (const key of ["eventId", "stepId", "definitionId", "objectiveId", "slotId"]) v.id(c[key], `commission.${key}`);
      v.text(c.title, "commission.title"); v.ids(c.actorIds, "commission.actorIds"); v.ids(c.basisIds, "commission.basisIds"); if (c.returnRequired !== true) fail("Commission must retain its return requirement");
    }
  }
  const reads = v.list(s.reads, "gmShare.reads");
  for (const rawRead of reads) {
    const read = v.record(rawRead, "gmShare.read", ["sourceId", "sceneId", "runId", "text", "knownBy", "head"]);
    for (const key of ["sourceId", "sceneId", "runId"]) v.id(read[key], `read.${key}`);
    v.text(read.text, "read.text", v.DATA_LIMITS.characters); v.ids(read.knownBy, "read.knownBy"); parseHead(read.head);
  }
  const pending = v.list(s.pendingSettlements, "gmShare.pendingSettlements", 96);
  for (const rawPending of pending) {
    const p = v.record(rawPending, "gmShare.pending", ["jobId", "frameIndex", "scope", "status"]);
    v.id(p.jobId, "pending.jobId"); v.number(p.frameIndex, "pending.frameIndex", 0, 7); v.choice(p.status, ["pending", "running", "ready", "failed", "stale"], "pending.status");
    const scope = v.record(p.scope, "pending.scope", ["kind", "boundaryId", "eventId", "actionId", "runId"]);
    v.choice(scope.kind, ["action", "event", "run"], "scope.kind"); v.id(scope.boundaryId, "scope.boundaryId");
    for (const key of ["eventId", "actionId", "runId"]) if (scope[key] !== null) v.id(scope[key], `scope.${key}`);
  }
  for (const [items, key] of [[plans, "jobId"], [reads, "sourceId"], [pending, "jobId"]] as const) v.ids(items.map(item => v.record(item, "gmShare.entry")[key]), `gmShare.${key}`);
  return structuredClone(raw) as GMShare;
}

function factShare(fact: D5Fact): GMShare | null {
  if (fact.kind !== "airp-game" && fact.kind !== "airp-director" || fact.payload.gmShare === undefined) return null;
  const share = parseGMShare(fact.payload.gmShare);
  const expected = fact.kind === "airp-game" ? fact.source : { ...fact.source, revision: fact.source.revision - 1 };
  if (!sameHead(share.sourceHead, expected)) fail("Share is not bound to its owning commit/checkpoint");
  if (fact.kind === "airp-director" && (fact.payload.command.type !== "airp-director-configure" || (fact.payload.command.lowContextVersion ?? 0) < 17)) fail("Internal baseline requires an explicit new-context configuration");
  return share;
}

/** Input must be the validated commit prefix. No owning-state/current-file fallback is permitted. */
export function readGMShare(facts: readonly D5Fact[], retracted: readonly string[]): GMShare | null {
  const excluded = new Set(retracted);
  for (let i = facts.length - 1; i >= 0; i--) {
    if (excluded.has(facts[i].id)) continue;
    const share = factShare(facts[i]);
    if (share) return share;
  }
  return null;
}

/** Verify immutable originals, including shares superseded by later refresh/cancellation. */
export function validateGMShares(record: D5GameRecord): void {
  const game = record.airpGame, effective = record.facts.filter(f => !record.retractedFactIds.includes(f.id));
  const at = (head: HeadRef) => effective.find(f => sameHead(f.source, head));
  const checkedPlans = new Set<string>();
  let optedIn = false;
  for (const fact of record.facts) {
    if (fact.kind === "airp-director" && fact.payload.command.type === "airp-director-configure" && (fact.payload.command.lowContextVersion ?? 0) >= 17) optedIn = true;
    const share = factShare(fact);
    if (!share) continue;
    if (!optedIn) fail("GM handoff predates the new-context opt-in");
    if (!within(share.sourceHead, record.head) || !at(share.sourceHead)) fail("Foreign or uncommitted share source");
    const corrections = (game?.gm.jobs ?? []).flatMap(j => j.memoryCorrections ?? []).filter(r => within(r.recordedHead, share.sourceHead));
    if (!equal(share.memoryCorrections ?? [], corrections)) fail("Memory correction handoff differs from saved GM originals");
    for (const correction of corrections) {
      const source = at(correction.recordedHead);
      if (source?.kind !== "airp-game" || source.payload.kind !== "gm") fail("Memory correction has no owning GM commit");
    }
    for (const p of share.plans) {
      const job = game?.gm.jobs.find(j => j.id === p.jobId), frame = job?.frames[p.frameIndex];
      if (!job || !frame || !within(p.frameHead, p.acceptedAt) || !within(p.acceptedAt, share.sourceHead)) fail("Missing or future adopted frame");
      const adopted = at(p.acceptedAt);
      if (adopted?.kind !== "airp-game" || adopted.payload.kind !== "gm") fail("Adoption lacks an owning GM commit");
      const { status: _status, acceptedAt: _acceptedAt, startFactId: _start, ...content } = p;
      if (!equal(content, planContent(job.id, p.frameIndex, frame, p.proposal))) fail("Plan handoff differs from its frozen public source");
      const key = `${job.id}:${p.frameIndex}:${p.proposalHash}`;
      if (!checkedPlans.has(key)) {
        validatePlanOriginal(job, p.frameIndex, p.proposal);
        checkedPlans.add(key);
      }
      // refresh deliberately clears acceptedAt. The old share then remains the
      // adoption assertion; a compact stateHash alone cannot prove membership.
      if (p.frameIndex === job.frames.length - 1 && job.acceptedAt && !sameHead(p.acceptedAt, job.acceptedAt)) fail("Adoption head differs from the retained original");
      if (p.status === "started") {
        const start = effective.find(f => f.id === p.startFactId);
        if (start?.kind !== "journey" || start.payload.operation.type !== "start" || !within(start.source, share.sourceHead)
          || start.source.revision <= p.acceptedAt.revision || start.payload.operation.input.runId !== p.departure.runId
          || expeditionPlanHash((({commissionRewards: _rewards, ...departure}) => departure)(start.payload.operation.input)) !== p.departure.commandHash) fail("Started plan lacks its real historical departure");
      } else if (p.startFactId !== null) fail("Unstarted plan carries a departure binding");
    }
    const reads = nodeReads(record, share.sourceHead);
    if (!equal(share.reads, reads)) fail("Read handoff omits, changes or anticipates original read paragraphs");
    for (const read of reads) {
      const source = at(read.head);
      if (source?.kind !== "airp-game" || source.payload.kind !== "node" || !source.payload.world) fail("Read paragraph lacks its committed observation");
    }
    for (const pending of share.pendingSettlements) {
      const job = game?.settlement.jobs.find(j => j.id === pending.jobId), frame = job?.frames[pending.frameIndex];
      if (!frame || !within(frame.input.state.head, share.sourceHead) || !at(frame.input.state.head) || !equal(frame.input.scope, pending.scope)) fail("Pending settlement lacks its historical frozen scope");
      if (game!.settlement.receipts.some(r => r.taskId === pending.jobId && within(r.committedHead, share.sourceHead))) fail("Already applied settlement is presented as pending");
    }
  }
  const latest = readGMShare(record.facts, record.retractedFactIds);
  if (latest && !sameGMShareContent(latest, projectGMShare(record))) fail("Latest GM handoff differs from the current public state");
}

function validatePlanOriginal(job: ExpeditionJob, frameIndex: number, proposal: v.ExpeditionPlanProposal) {
  const frame = job.frames[frameIndex];
  const attempts = job.attempts.filter(a => a.frame === frameIndex && a.status === "succeeded" && a.output !== null);
  if (!attempts.some(a => a.stage === "plan" && equal(v.parseExpeditionPlan(correctionEnvelope(v.parseJson(a.output!), !!frame.context.gmContext?.memoryContext)), proposal))) fail("Plan lacks its original successful response");
  const review = attempts.filter(a => a.stage === "review").map(a => v.parseExpeditionThemeReview(v.parseJson(a.output!))).find(r => r.proposalHash === expeditionPlanHash(proposal));
  if (expeditionReviewRequired(proposal) && !review) fail("Adopted proposal lacks its successful theme review");
  validateExpeditionPlan(frame.context.rules, proposal, frame.inputHash, review);
}
