import { sha256, type SettlementPolicy, type SettlementState } from "../../game-core/contracts";
import { airpPhaseIndex } from "../../game-core/session";
import { directorDocuments } from "../../content/presentation/airp/director-documents";
import { directorPlan, directorRuntime, directorScene } from "./airp-director-playthrough";
import { createSettlementLedger } from "../airp-settlement/service";
import { projectD5SettlementBoundary } from "../airp-settlement/d5-source";
import type { D5GameRecord } from "../versions/d5-contracts";

/** Real program lifecycle, MOCK scene generation. Do not label this as literary/CL-F acceptance. */
export async function settlementGameplayCase() {
  const f = await directorRuntime(); await directorPlan(f, { kind: "fixed", definitionId: "ripple.elora.watch-note" });
  await f.send({ type: "advance-phase" }); await f.send({ type: "advance-phase" });
  const eventId = (await f.read()).airpDirector!.events[0].id;
  const offered = await f.read();
  await directorScene(f, eventId); await f.send({ type: "airp-director-choose", eventId, choiceId: "participate" });
  const selected = await f.read();
  await directorScene(f, eventId); await directorScene(f, eventId);
  await f.send({ type: "airp-director-choose", eventId, choiceId: "participate" });
  const action = await f.read();
  await directorScene(f, eventId); const feedback = await f.read();
  await directorScene(f, eventId); const closed = await f.read();
  return { offered, selected, action, feedback, closed, eventId };
}
export function gameplaySettlementInput(record: D5GameRecord, kind: "action" | "event", eventId: string) {
  const policy: SettlementPolicy = { id: "cl-b-gameplay-test-only", actorIds: ["elora"], observerIds: ["kael", "elora", "eustice"], locationIds: ["plaza", "elora"], endConditionIds: [],
    affinity: { min: -10, max: 10, initial: 0, eventAbsLimit: 3, grades: [{ id: "none", delta: 0 }, { id: "positive", delta: 1 }, { id: "negative", delta: -1 }] }, activities: [], conditions: [] };
  const state: SettlementState = { protocol: 1, policyId: policy.id, head: record.head, phase: airpPhaseIndex(record.snapshot.campaign.clock.day, record.snapshot.campaign.clock.phase), affinity: [], actors: [] };
  const ledger = createSettlementLedger(policy, state), card = directorDocuments.find(d => d.id === "elora")!;
  const cards = [{ actorId: "elora", text: card.text, digest: sha256(card.text) }];
  const factId = record.facts.at(-1)!.id;
  return { ledger, ...projectD5SettlementBoundary({ record, ledger, boundary: { kind, factId, eventId },
    grants: kind === "event" ? [{ id: "event-affinity:elora", kind: "affinity", actorId: "elora", eventId, accountId: "event" }] : [], cards }) };
}
