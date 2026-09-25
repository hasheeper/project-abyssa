import * as v from "./validation";
import { sha256 } from "./sha256";
type CommissionRewardContext = {
  readonly ref: {contentVersion: number};
  readonly data: {
    airpDirector?: {capabilities: {objectives: Record<string, {routeId: string; layer: number; roomIndex: number; roomDefinitionId: string}>}};
    journey?: {rooms: Record<string, {kind: string}>};
  };
};

/** Frozen GM placements. Quest objects cannot be sold, appraised or used as supplies. */
export type CommissionReward = {
  definitionId: string; eventId: string; stepId: string; objectiveId: string;
  label: string; description: string; layer: number; roomIndex: number;
  roomDefinitionId: string; awardWhen: "room-cleared" | "layer-banked";
};
export type CommissionItem = CommissionReward & {instanceId: string; runId: string; roomId: string};
export type CommissionRewardBag = {version: 1; manifest: CommissionReward[]; items: CommissionItem[]};
export type CommissionRewardReceipt = CommissionRewardBag & {completedRoomIds: string[]; returned: CommissionItem[]};

export function parseCommissionRewards(raw: unknown): CommissionReward[] {
  const rewards = v.list(raw, "commissionRewards", 4).map(raw => {
    const r = v.record(raw, "commissionReward", ["definitionId", "eventId", "stepId", "objectiveId", "label", "description", "layer", "roomIndex", "roomDefinitionId", "awardWhen"]);
    return {definitionId: v.id(r.definitionId, "definitionId"), eventId: v.id(r.eventId, "eventId"), stepId: v.id(r.stepId, "stepId"), objectiveId: v.id(r.objectiveId, "objectiveId"),
      label: v.text(r.label, "label", 80), description: v.text(r.description, "description", 400), layer: v.number(r.layer, "layer", 1, 5), roomIndex: v.number(r.roomIndex, "roomIndex", 0, 99),
      roomDefinitionId: v.id(r.roomDefinitionId, "roomDefinitionId"), awardWhen: v.choice(r.awardWhen, ["room-cleared", "layer-banked"], "awardWhen")};
  });
  v.ids(rewards.map(r => r.definitionId), "reward definitions");
  v.ids(rewards.map(r => r.eventId), "reward commissions");
  return rewards;
}
export function validateCommissionPlacements(catalog: CommissionRewardContext, routeId: string, raw: unknown): CommissionReward[] {
  const manifest = parseCommissionRewards(raw);
  if (![22, 24, 26, 28].includes(catalog.ref.contentVersion) || !("airpDirector" in catalog.data) || !catalog.data.airpDirector)
    return v.invalid("commissionRewards", "Quest rewards require the formal commission capability");
  for (const r of manifest) {
    const o = catalog.data.airpDirector.capabilities.objectives[r.objectiveId];
    if (!o || o.routeId !== routeId || o.layer !== r.layer || o.roomIndex !== r.roomIndex || o.roomDefinitionId !== r.roomDefinitionId)
      v.invalid("commissionRewards", "Reward moved outside the authored objective");
    if (catalog.data.journey?.rooms[r.roomDefinitionId]?.kind !== "battle")
      v.invalid("commissionRewards", "This reward capability requires a won battle");
  }
  return manifest;
}
export function earnedCommissionItems(manifest: CommissionReward[], runId: string, roomIds: string[][], completed: string[], banked: number[]): CommissionItem[] {
  return manifest.flatMap(r => {
    const roomId = roomIds[r.layer - 1]?.[r.roomIndex];
    if (!roomId || !completed.includes(roomId) || r.awardWhen === "layer-banked" && !banked.includes(r.layer)) return [];
    return [{...r, instanceId: `quest-item:${sha256(v.canonicalJson([runId, r.definitionId]))}`, runId, roomId}];
  });
}
export function validateCommissionBag(catalog: CommissionRewardContext, routeId: string, runId: string, roomIds: string[][], completed: string[], banked: number[], raw: unknown) {
  const b = v.record(raw, "commissionBag", ["version", "manifest", "items"]);
  v.choice(b.version, [1], "commissionBag.version");
  const manifest = validateCommissionPlacements(catalog, routeId, b.manifest);
  if (v.canonicalJson(b.items) !== v.canonicalJson(earnedCommissionItems(manifest, runId, roomIds, completed, banked)))
    v.invalid("commissionBag", "Quest item instances differ from executed reward conditions");
}
export function commissionReceipt(bag: CommissionRewardBag, completed: string[], banked: number[], outcome: string): CommissionRewardReceipt {
  return {...structuredClone(bag), completedRoomIds: [...completed], returned: outcome === "wipe" ? [] : structuredClone(bag.items.filter(i => banked.includes(i.layer)))};
}
