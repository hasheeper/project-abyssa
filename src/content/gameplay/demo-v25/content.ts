import type { D5Catalog } from "../../../game-core/contracts";
import type { FacilityContent } from "../../../game-core/contracts";
import { SHOP_WAVE_CATALOG_DATA } from "../demo-v23/content";
const data = structuredClone(SHOP_WAVE_CATALOG_DATA);
const facilities: FacilityContent = {
  version: 1,
  rooms: {
    kitchen: {name: "厨房", initialLevel: 1, availableDay: 1}, storage: {name: "储藏室", initialLevel: 1, availableDay: 1},
    greenhouse: {name: "温室药圃", initialLevel: 0, availableDay: 2}, workshop: {name: "工坊", initialLevel: 0, availableDay: 3}, maid: {name: "女仆工作间", initialLevel: 0, availableDay: 4},
  },
  materials: {
    "material.medicinal-herb": {id: "material.medicinal-herb", name: "药草", description: "晾好的常用药草。制成药水后才能作为出征补给使用。"},
    "material.clearlight-herb": {id: "material.clearlight-herb", name: "净光草", description: "用于擦拭法杖的净光草。原材料，当前没有制药配方。"},
  },
  projects: {
    "production.food": {id: "production.food", roomId: "kitchen", kind: "supply", definitionId: "item.food", phases: 4, amounts: [2, 3, 4]},
    "production.herb": {id: "production.herb", roomId: "greenhouse", kind: "material", definitionId: "material.medicinal-herb", phases: 8, amounts: [3, 4, 6]},
    "production.clearlight": {id: "production.clearlight", roomId: "greenhouse", kind: "material", definitionId: "material.clearlight-herb", phases: 8, amounts: [3, 4, 6]},
  },
  recipes: {"recipe.potion": {id: "recipe.potion", name: "药水", definitionId: "item.potion", materials: {"material.medicinal-herb": 2}, fee: 100, phases: 1}},
  storage: {slots: [4, 5, 6], materials: [12, 24, 36], supplies: [3, 4, 6]}, craftBatch: [1, 2, 3], repairDiscount: [5, 10, 15],
};
data.economy!.freeItemIds = [];
data.economy!.prices["item.potion"] = 260;
data.shop!.products["product.item.potion"] = {id: "product.item.potion", name: "药水", definitionId: "item.potion", delivery: "supply", price: 260, availableFromDay: 1, mode: "fixed", purchaseLimit: null};
export const FACILITIES_CATALOG_DATA: D5Catalog = {...data, contentVersion: 25, facilities};
