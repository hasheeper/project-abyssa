import type { AirpHead, AirpInstance, AirpObjectiveFact, AirpPatrolBinding, AirpReturnProof, AirpSortieDefinition } from "../contracts/airp";
import { number } from "../contracts/validation";

export function airpPhaseIndex(day: number, phase: "dawn" | "day" | "dusk" | "night"): number {
  number(day, "day", 1, Math.floor(Number.MAX_SAFE_INTEGER / 4));
  const ordinal = ["dawn", "day", "dusk", "night"].indexOf(phase);
  number(ordinal, "phase", 0, 3);
  return (day - 1) * 4 + ordinal;
}

/** Half-open offer interval; accepted instances never inherit the offer deadline. */
export function airpExpiry(instance: AirpInstance, volatility: AirpSortieDefinition["volatility"], phase: number): "reserved" | "expired-seen" | "missed" | null {
  number(phase, "phase");
  if (!["pending", "offered"].includes(instance.status) || phase < instance.offerUntilPhase) return null;
  return volatility === "consequential" ? "missed" : instance.exposedPhase === null ? "reserved" : "expired-seen";
}

export function airpHeadAtOrBefore(source: AirpHead, current: AirpHead): boolean {
  return source.saveId === current.saveId && source.epoch === current.epoch && source.revision <= current.revision;
}

/** Not an import/authentication boundary: facts and live IDs must come from verified replay.
 * In particular, never map a browser-provided proof/visibility flag directly into this reader.
 */
export function readAirpReturnProof(input: {
  definition: AirpSortieDefinition; binding: AirpPatrolBinding;
  head: AirpHead; contentDigest: string;
  facts: readonly AirpObjectiveFact[]; effectiveFactIds: ReadonlySet<string>;
}): AirpReturnProof | null {
  const { definition: d, binding: b, head, effectiveFactIds } = input, o = d.objective;
  if (b.definition.id !== d.id || b.definition.version !== d.version || b.contentDigest !== input.contentDigest
    || b.routeId !== o.routeId || b.roomDefinitionId !== o.roomDefinitionId || b.evidenceId !== o.evidenceId
    || !airpHeadAtOrBefore(b.acceptedHead, b.departureHead) || b.acceptedHead.revision >= b.departureHead.revision
    || !airpHeadAtOrBefore(b.departureHead, head)
    || !effectiveFactIds.has(b.acceptedFactId) || !effectiveFactIds.has(b.departureFactId)) return null;
  // Reject ambiguous identities, including contradictory projections of one fact.
  if (new Set(input.facts.map(f => f.id)).size !== input.facts.length) return null;
  const facts = input.facts.filter(f => effectiveFactIds.has(f.id) && f.origin === "adventure"
    && f.runId === b.runId && f.routeId === b.routeId
    && airpHeadAtOrBefore(b.departureHead, f.source) && airpHeadAtOrBefore(f.source, head)
    && f.source.revision > b.departureHead.revision);
  const terminals = facts.filter(f => f.kind === "expedition-settled");
  if (terminals.length !== 1) return null;
  const terminal = terminals[0];
  if (terminal.kind !== "expedition-settled" || terminal.outcome === "wipe") return null;
  const rooms = facts.filter(f => f.kind === "room-completed" && f.roomInstanceId === b.roomInstanceId
    && f.roomDefinitionId === b.roomDefinitionId && f.source.revision <= terminal.source.revision && f.phase <= terminal.phase);
  if (rooms.length !== 1) return null;
  const sourceFactIds: AirpReturnProof["sourceFactIds"] = [b.acceptedFactId, b.departureFactId, rooms[0].id, terminal.id];
  if (new Set(sourceFactIds).size !== 4) return null;
  return { instanceId: b.instanceId, runId: b.runId, evidenceId: b.evidenceId, sourceFactIds, terminalId: terminal.terminalId, outcome: terminal.outcome };
}
