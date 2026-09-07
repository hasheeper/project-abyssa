import * as v from "../../game-core/contracts";
import type { ValidatedD5Catalog } from "../../game-core/contracts";
import { createD5ExpeditionEngine, parseDemoItemTarget } from "../../game-core/session";
import type { D5Departure, D5ExpeditionState, D5JourneyOperation, D5Projection } from "../../game-core/session";
import { parseDemoBattleCommand } from "../../game-core/battle";
import type { DemoEvent } from "../../game-core/battle";

export type D5JourneyEvidence = {
  runRef: { kind: "expedition"; id: string };
  operation: D5JourneyOperation | { type: "start"; input: D5Departure };
  before: D5ExpeditionState | null;
  after: D5ExpeditionState;
  events: DemoEvent[];
  retracts: string[];
  departureCampaign?: D5Projection;
};
export type D5JourneyFactPayload = Omit<D5JourneyEvidence, "before" | "after" | "departureCampaign"> & { beforeDigest: string; afterDigest: string };
export const d5Digest = (value: unknown) => v.sha256(v.canonicalJson(value));
export function compactD5Journey(proof: D5JourneyEvidence): D5JourneyFactPayload {
  return { runRef: proof.runRef, operation: proof.operation, beforeDigest: d5Digest(proof.before), afterDigest: d5Digest(proof.after), events: proof.events, retracts: proof.retracts };
}
function parseOperation(raw: unknown): D5JourneyEvidence["operation"] {
  const r = v.record(raw, "operation"), type = v.choice(r.type, ["start", "resume", "battle", "advance", "event", "exit", "item"], "operation.type");
  const fields = { start: ["input"], resume: [], battle: ["command"], advance: ["roomId"], event: ["roomId", "choice", "actorId"], exit: ["roomId", "choice"], item: ["instanceId", "target"] };
  v.record(r, "operation", ["type", ...fields[type]]);
  if (type === "start") {
    const i = v.record(r.input, "departure", ["runId", "routeId", "partyIds", "itemIds", "seed"]);
    return { type, input: { runId: v.id(i.runId, "runId"), routeId: v.id(i.routeId, "routeId"), partyIds: v.ids(i.partyIds, "partyIds", 5), itemIds: v.ids(i.itemIds, "itemIds", 4), seed: v.number(i.seed, "seed", 0, 0xffffffff) } };
  }
  if (type === "resume") return { type };
  if (type === "battle") return { type, command: parseDemoBattleCommand(r.command) };
  if (type === "item") return { type, instanceId: v.id(r.instanceId, "instanceId"), target: parseDemoItemTarget(r.target) };
  const roomId = v.id(r.roomId, "roomId");
  if (type === "advance") return { type, roomId };
  if (type === "exit") return { type, roomId, choice: v.choice(r.choice, ["leave", "continue"], "choice") };
  return { type, roomId, choice: v.choice(r.choice, ["read", "attempt", "skip"], "choice"), actorId: r.actorId === null ? null : v.id(r.actorId, "actorId") };
}
export function replayD5Journey(catalog: ValidatedD5Catalog, raw: unknown, before: D5ExpeditionState | null, campaign: D5Projection): D5JourneyEvidence {
  const p = v.record(raw, "journey", ["runRef", "operation", "beforeDigest", "afterDigest", "events", "retracts"]);
  const ref = v.record(p.runRef, "runRef", ["kind", "id"]);
  v.choice(ref.kind, ["expedition"], "runRef.kind");
  const id = v.id(ref.id, "runRef.id"), operation = parseOperation(p.operation), engine = createD5ExpeditionEngine(catalog);
  if (p.beforeDigest !== d5Digest(before)) v.invalid("journey", "Discontinuous journey");
  if (operation.type === "start" ? before !== null : !before) v.invalid("journey", "Missing or reused departure");
  const result = operation.type === "start" ? { state: engine.create(campaign, operation.input), events: [] } : engine.dispatch(before!, operation);
  if (result.state.run.id !== id || p.afterDigest !== d5Digest(result.state) || v.canonicalJson(p.events) !== v.canonicalJson(result.events)) v.invalid("journey", "Journey result differs from execution");
  const retracts = v.ids(p.retracts, "retracts", 1);
  if (retracts.length !== (operation.type === "battle" && operation.command.type === "undo" ? 1 : 0)) v.invalid("retracts", "Only undo retracts one action group");
  return { runRef: { kind: "expedition", id }, operation, before, after: result.state, events: result.events, retracts, ...(operation.type === "start" ? { departureCampaign: campaign } : {}) };
}
export function validateD5JourneyEvidence(catalog: ValidatedD5Catalog, raw: unknown): D5JourneyEvidence {
  const p = v.record(raw, "journey", ["runRef", "operation", "before", "after", "events", "retracts"], ["departureCampaign"]);
  const proof = p as unknown as D5JourneyEvidence;
  if (proof.operation.type !== "start" && p.departureCampaign !== undefined) v.invalid("journey", "Unexpected departure campaign");
  return replayD5Journey(catalog, compactD5Journey(proof), proof.before, proof.departureCampaign!);
}
