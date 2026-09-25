import { airpLocked } from "../game-application/versions/airp-replay";
import type { ValidatedD5Catalog } from "../game-core/contracts";
import type { D5GameRecord } from "../game-application";
import { FACILITY_IDS } from "../game-core/contracts/facilities";
import { facilityTier, facilitySupplyLimit, supplyStorageCapacity, supplyStorageRoom } from "../game-core/session/facilities";
import { campaignPhaseIndex, mansionTimeBlock } from "../game-core/session/d5-clock";
import { quoteConstruction } from "../game-core/session/facility-construction";
export function facilitiesView(catalog: ValidatedD5Catalog, record: D5GameRecord) {
  const content = catalog.data.facilities, campaign = record.snapshot.campaign, state = campaign.facilities;
  if (!content || !state) return null;
  const now = campaignPhaseIndex(campaign.clock), blocked = mansionTimeBlock(campaign) ?? (airpLocked(record.narrative) ? "请先完成或暂缓当前交谈" : null);
  const materialCapacity = content.storage.materials[facilityTier(campaign, "storage")];
  const construction = state.construction ? {...state.construction, name: content.rooms[state.construction.roomId].name, remainingPhases: Math.max(0, state.construction.readyAt - now)} : null;
  return {
    blocked, state, day: campaign.clock.day, now, itemLimit: facilitySupplyLimit(catalog, campaign),
    construction,
    funding: state.funding ? {...state.funding, balance: campaign.funds.public, nextDay: (state.funding.paidThroughWeek + 1) * 7 + 1} : null,
    rooms: FACILITY_IDS.map(id => {
      const spec = content.rooms[id], batch = state.batches[id], project = batch && content.projects[batch.projectId];
      const room = project ? project.kind === "supply" ? supplyStorageRoom(catalog, campaign, project.definitionId) : materialCapacity - (state.materials[project.definitionId] ?? 0) : 0;
      const level = state.levels[id], config = content.construction;
      const quote = config && level < 3 && !(id === "workshop" && state.order) ? quoteConstruction(content, state, id, config.basePrices[id], now) : null;
      const reason = blocked ?? (construction ? `${construction.name}施工中` : campaign.clock.day < spec.availableDay ? `第 ${spec.availableDay} 日开放` : id === "workshop" && state.order ? "请先领取加工成品" : level === 3 ? "已达最高等级" : quote && quote.cost > campaign.funds.public ? "公款不足" : null);
      const improvement = (label: string, values: readonly number[], unit: string) => ({label, before: `${level ? values[level - 1] : 0}${unit}`, after: `${values[Math.min(level, 2)]}${unit}`});
      const improvements = id === "kitchen" ? [improvement("每批食物", content.projects["production.food"].amounts, " 份")]
        : id === "greenhouse" ? [improvement("每批药草", content.projects[state.selectedProject].amounts, " 束")]
        : id === "workshop" ? [improvement("单次加工", content.craftBatch, " 份")]
        : id === "maid" ? [improvement("工程折扣", content.repairDiscount, "%")]
        : [improvement("出征补给", content.storage.slots, " 类"), improvement("每种原料", content.storage.materials, " 束"), improvement("补给库存", content.storage.supplies, " 倍")];
      return {id, ...spec, level, canEnable: !config && !blocked && !level && campaign.clock.day >= spec.availableDay,
        build: config ? {quote, reason, improvements, discount: id === "maid" || !state.levels.maid ? 0 : content.repairDiscount[state.levels.maid - 1]} : null,
        batch: batch && project ? {...batch, definitionId: project.definitionId, name: project.kind === "supply" ? catalog.data.journey!.items[project.definitionId].name : content.materials[project.definitionId].name,
          kind: project.kind, remainingPhases: Math.max(0, batch.readyAt - now), collectMaximum: !blocked && batch.readyAt <= now ? Math.min(batch.remaining, Math.max(0, room)) : 0} : null};
    }),
    materials: Object.values(content.materials).map(m => ({...m, quantity: state.materials[m.id] ?? 0, capacity: materialCapacity})),
    projects: Object.values(content.projects).filter(p => p.roomId === "greenhouse").map(p => ({id: p.id, name: content.materials[p.definitionId].name})),
    recipes: Object.values(content.recipes).map(r => {
      const materials = Object.entries(r.materials).map(([id, quantity]) => ({id, name: content.materials[id].name, quantity, owned: state.materials[id] ?? 0}));
      const maximum = Math.max(0, Math.min(content.craftBatch[facilityTier(campaign, "workshop")], supplyStorageRoom(catalog, campaign, r.definitionId), r.fee ? Math.floor(campaign.funds.party / r.fee) : 99, ...materials.map(m => Math.floor(m.owned / m.quantity))));
      return {...r, materials, maximum: !blocked && state.levels.workshop && !state.order && construction?.roomId !== "workshop" ? maximum : 0};
    }),
    order: state.order ? {...state.order, name: content.recipes[state.order.recipeId].name, remainingPhases: Math.max(0, state.order.readyAt - now)} : null,
    discount: state.levels.maid ? content.repairDiscount[state.levels.maid - 1] : 0,
    overflow: Object.entries(state.overflow).filter(([,quantity]) => quantity > 0).map(([id, quantity]) => ({id, quantity, name: catalog.data.journey!.items[id].name, maximum: Math.min(quantity, supplyStorageRoom(catalog, campaign, id))})),
    capacities: Object.fromEntries(Object.keys(catalog.data.journey!.items).map(id => [id, supplyStorageCapacity(catalog, campaign, id)])),
  };
}
export type FacilitiesView = NonNullable<ReturnType<typeof facilitiesView>>;
