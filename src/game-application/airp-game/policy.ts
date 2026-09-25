import type { SettlementGrant, SettlementPolicy, ValidatedD5Catalog, DirectorResidentCast } from "../../game-core/contracts";
import { withResidentCapabilities } from "../airp-director/residents";
import type { NodeJob } from "../airp-expedition-play/contracts";
import type { SettlementLedger } from "../airp-settlement/contracts";

/** Explicit alpha tuning, not a change to authored cards or the ordinary loot economy. */
export function gameSettlementPolicy(catalog: ValidatedD5Catalog, residents?: DirectorResidentCast): SettlementPolicy {
  const capabilities = withResidentCapabilities(catalog.data.airpDirector!.capabilities, residents);
  return { id: "airp-game-demo-2", actorIds: ["elora", "eustice", "norma", "kororo", ...Object.keys(residents?.locations ?? {})], observerIds: ["kael", "elora", "eustice", "norma", "kororo", ...Object.keys(residents?.locations ?? {})],
    locationIds: [...new Set([...Object.keys(catalog.data.routes), ...capabilities.locationIds])], endConditionIds: [],
    affinity: { initial: 0, min: -100, max: 100, eventAbsLimit: 2, grades: [{ id: "none", delta: 0 }, { id: "closer", delta: 1 }, { id: "strained", delta: -1 }] },
    activities: [{ id: "resting", busy: true, maxPhases: 1 }, { id: "occupied", busy: true, maxPhases: 1 }],
    conditions: [{ id: "tired", maxPhases: 2 }, { id: "unsettled", maxPhases: 1 }] };
}
export function gameGrants(ledger: SettlementLedger, actorIds: string[], boundaryId: string, eventId: string | null, finalEvent = false, atHome = false): SettlementGrant[] {
  if (ledger.policy.id !== "airp-game-demo-2") return [];
  return actorIds.filter(id => ledger.policy.actorIds.includes(id)).flatMap(actorId => {
    const grants: SettlementGrant[] = [{ id: `actor:${boundaryId}:${actorId}`, kind: "actor", actorId, changeId: boundaryId, fields: atHome ? ["location", "activity", "conditions"] : ["activity", "conditions"] }];
    const used = ledger.receipts.flatMap(r => r.effects).filter(e => e.kind === "affinity" && e.actorId === actorId && e.eventId === eventId).reduce((n, e) => n + (e.kind === "affinity" ? Math.abs(e.delta) : 0), 0);
    if (eventId && used < ledger.policy.affinity.eventAbsLimit) grants.push({ id: `affinity:${boundaryId}:${actorId}`, kind: "affinity", actorId, eventId, accountId: finalEvent ? "event" : boundaryId });
    return grants;
  });
}
export function gameNodeGrants(ledger: SettlementLedger, job: NodeJob) {
  return gameGrants(ledger, job.node.actorIds, job.id, job.node.link?.kind === "commission" ? job.node.link.eventId : null);
}
