import { sha256, type SettlementPolicy } from "../../game-core/contracts";
import { airpPhaseIndex } from "../../game-core/session";
import { directorDocuments } from "../../content/presentation/airp/director-documents";
import { AIRP_DIRECTOR_CATALOG } from "../../game-runtime/airp-director-context";
import { createSettlementLedger } from "../airp-settlement/service";
import { projectD5ExpeditionPreparation } from "../airp-expedition-gm/d5-source";
import type { ExpeditionDocument } from "../airp-expedition-gm/contracts";
import { directorPlan, directorRuntime, directorScene } from "./airp-director-playthrough";

/** Actual D5 program state; preceding scene generation is MOCK, not a new literary acceptance. */
export async function expeditionGameplayCase(commission: boolean) {
  const f = await directorRuntime();
  if (commission) {
    await directorPlan(f, { kind: "fixed", definitionId: "ripple.elora.old-medicine-case" });
    await f.send({ type: "advance-phase" }); await f.send({ type: "advance-phase" });
    const id = (await f.read()).airpDirector!.events[0].id;
    await directorScene(f, id); await f.send({ type: "airp-director-choose", eventId: id, choiceId: "participate" });
    await directorScene(f, id); await directorScene(f, id); await f.send({ type: "airp-director-choose", eventId: id, choiceId: "participate" });
  }
  const record = await f.read(), departure = { runId: commission ? "cl-c-medicine" : "cl-c-exploration", routeId: AIRP_DIRECTOR_CATALOG.data.manor!.maintenanceRouteId, partyIds: AIRP_DIRECTOR_CATALOG.data.initialParty, itemIds: ["item.food", "item.potion"], seed: 19 };
  const actorIds = [...new Set([...departure.partyIds.filter(id => id !== "kael"), ...(commission ? ["elora"] : [])])];
  const policy: SettlementPolicy = { id: "cl-c-legacy-test-projection", actorIds, observerIds: ["kael", ...actorIds], locationIds: ["plaza"], endConditionIds: [], affinity: { min: -10, max: 10, initial: 0, eventAbsLimit: 3, grades: [{ id: "none", delta: 0 }] }, activities: [], conditions: [] };
  const settlement = createSettlementLedger(policy, { protocol: 1, policyId: policy.id, head: record.head, phase: airpPhaseIndex(record.snapshot.campaign.clock.day, record.snapshot.campaign.clock.phase), actors: [], affinity: [] });
  const documents: ExpeditionDocument[] = directorDocuments.filter(d => ["world", "history", "current", "player", ...actorIds].includes(d.id)).map(d => ({ id: d.id, kind: d.kind as ExpeditionDocument["kind"], text: d.text, digest: sha256(d.text), triggerIds: actorIds.includes(d.id) ? [d.id] : [departure.routeId] }));
  const options = { catalog: AIRP_DIRECTOR_CATALOG, record, departure, settlement, documents, intent: commission ? "按已接受的旧药箱工作稿进行本趟巡守；达不到条件则保留未完任务，不冒称取回。" : "没有新委托，按当前队伍进行一次普通巡守；可根据实际情况在出口撤离。", limits: { nodes: 4, events: 0, definitions: 0 } };
  return { f, options, packet: projectD5ExpeditionPreparation(options) };
}
