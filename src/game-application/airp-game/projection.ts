import { canonicalJson, sha256, type ValidatedD5Catalog } from "../../game-core/contracts";
import { airpPhaseIndex } from "../../game-core/session";
import type { D5GameRecord } from "../versions/d5-contracts";
import type { AirpGameState } from "./contracts";
import { projectD5ExpeditionPreparation, projectD5DepartureProofs } from "../airp-expedition-gm/d5-source";
import type { ExpeditionGMSnapshot, ExpeditionJob } from "../airp-expedition-gm/contracts";
import type { NodeSnapshot } from "../airp-expedition-play/contracts";
import { gameNodeGrants } from "./policy";
import { projectD5NodeProgram } from "../airp-expedition-play/d5-source";
import { sameHead } from "../transaction";
import { recordMemoryContext } from "../airp-memory/d5";

export const gameHash = (value: unknown) => sha256(canonicalJson(value));
export const gameClone = <T>(value: T): T => structuredClone(value);
/** Program commits rebase only this clock/head projection, never model-owned values. */
export function rebaseAirpGame(r: D5GameRecord) {
  if (!r.airpGame) return;
  r.airpGame.worldHead = gameClone(r.head);
  r.airpGame.settlement.state.head = gameClone(r.head);
  r.airpGame.settlement.state.phase = airpPhaseIndex(r.snapshot.campaign.clock.day, r.snapshot.campaign.clock.phase);
}
export function airpGameHash(s: AirpGameState): string {
  const value = gameClone(s);
  // These fields are reconstructed from ordinary commits and observed reading, below.
  value.worldHead.revision = 0; value.settlement.state.head.revision = 0; value.settlement.state.phase = 0;
  return gameHash(value);
}
export function projectGameGm(r: D5GameRecord, catalog: ValidatedD5Catalog, refresh = false): ExpeditionGMSnapshot {
  const s = r.airpGame!;
  if (!s.preparation) throw Error("尚未选择出征路线与队伍。");
  const departure = s.preparation.departure;
  const started = s.gm.jobs.find(j => j.frames.at(-1)!.departure.runId === departure.runId && j.status === "started");
  const inRun = !!r.snapshot.run || projectD5DepartureProofs(r).some(p => p.runId === departure.runId);
  const frozen = (started ?? s.gm.jobs.at(-1))?.frames.at(-1);
  const sameTrip = frozen?.departure.runId === departure.runId;
  // GM's own bookkeeping/acceptance must not invalidate or expand its frozen input.
  const frozenGlobal = sameTrip && frozen?.context.gmContext && sameHead(frozen.context.rules.head, s.worldHead);
  const gmContextVersion = sameTrip ? frozen?.context.gmContext ? 1 as const : undefined : (r.airpDirector?.lowContextVersion ?? 0) >= 17 ? 1 as const : undefined;
  const memoryVersion = sameTrip ? frozen?.context.gmContext?.memoryContext ? 19 as const : undefined : (r.airpDirector?.lowContextVersion ?? 0) >= 19 ? 19 as const : undefined;
  const commissionRewardVersion = refresh ? 1 as const : sameTrip && frozen ? frozen.context.rules.commissionRewardVersion : s.preparation.commissionRewardVersion;
  const appraisalPlanVersion = sameTrip && frozen ? frozen.context.rules.appraisalPlanVersion : s.preparation.appraisalPlanVersion;
  const packet = (inRun || frozenGlobal && !refresh) && frozen ? { context: frozen.context, documents: frozen.documents, departure: frozen.departure }
    : projectD5ExpeditionPreparation({ catalog, record: { ...r, head: s.worldHead }, gmRecord: r, ...s.preparation, settlement: s.settlement, limits: { nodes: 4, events: 0, definitions: commissionRewardVersion ? 4 : 0 }, checkAvailability: false, gmContextVersion, memoryVersion, commissionRewardVersion, appraisalPlanVersion });
  return { ...packet, head: r.head, ledger: s.gm, activeRunId: r.snapshot.run?.id ?? null, startProofs: projectD5DepartureProofs(r), itemDefinitions: s.gm.jobs.filter(j => ["accepted", "started"].includes(j.status)).flatMap(j => j.prepared?.itemDefinitions ?? []) };
}
export function currentGamePlan(r: D5GameRecord): ExpeditionJob | undefined {
  const runId = r.snapshot.run?.kind === "expedition" ? r.snapshot.run.id : r.airpGame?.preparation?.departure.runId;
  return r.airpGame?.gm.jobs.find(j => j.frames.at(-1)!.departure.runId === runId);
}
export function projectGameNode(r: D5GameRecord, catalog: ValidatedD5Catalog, plan = currentGamePlan(r)!): NodeSnapshot {
  const s = r.airpGame!;
  const program = projectD5NodeProgram({ catalog, record: r, plan, commits: r.commits.filter(c => c.previous).map(c => ({ head: c.ref, before: c.previous!, gameplayHead: c.ref, factIds: c.factIds })) });
  const ledger = s.nodes[plan.id] ?? { version: 1 as const, jobs: [] };
  const memoryView = recordMemoryContext(r);
  return { head: r.head, worldHead: s.worldHead, plan, program, ledger, material: s.material, settlement: s.settlement, ...(memoryView ? {memoryView} : {}),
    grants: Object.fromEntries(ledger.jobs.map(j => [j.node.id, gameNodeGrants(s.settlement, j)])) };
}
