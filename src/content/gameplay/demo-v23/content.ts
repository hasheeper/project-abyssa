import type { D5Catalog, DemoEquipmentDef, ShopProduct } from "../../../game-core/contracts";
import { ORDINARY_DROPS_CATALOG_DATA } from "../demo-v21/content";

const data = structuredClone(ORDINARY_DROPS_CATALOG_DATA);
const face = (id: string, nativeAction: "attack" | "guard" | "heal" | "blank", operation: "replace" | "boost", replacement: "attack" | "guard" | "heal", power: 1 | 2): DemoEquipmentDef => ({id: `equipment.${id}`, slot: "general", scope: "native-face", nativeAction, operation, replacement, power});
const definitions: DemoEquipmentDef[] = [
  {id: "equipment.leather-bracer", slot: "general", scope: "all-native-blanks", replacement: "guard", power: 1},
  face("iron-bracer", "guard", "boost", "guard", 1), face("whetstone", "attack", "boost", "attack", 1),
  face("needle-case", "heal", "boost", "heal", 1), face("watch-bell", "blank", "replace", "guard", 2),
  face("mercenary-strap", "attack", "replace", "guard", 2), face("sleeve-blade", "guard", "replace", "attack", 2),
];
for (const def of definitions) data.equipment[def.id] = def;
const equipment: [string, string, number, number, "fixed" | "rotation"][] = [
  ["spare-blade", "备用短刃", 1200, 2, "fixed"], ["iron-bracer", "嵌铁护腕", 1280, 2, "fixed"],
  ["emergency-pouch", "应急药囊", 1600, 4, "fixed"], ["leather-bracer", "软革护腕", 1400, 4, "fixed"],
  ["whetstone", "磨刃石", 1480, 6, "fixed"], ["watch-bell", "守夜铜铃", 1680, 3, "rotation"],
  ["needle-case", "药师针匣", 1380, 3, "rotation"], ["mercenary-strap", "佣兵肩带", 1680, 5, "rotation"],
  ["sleeve-blade", "袖藏短刃", 1680, 5, "rotation"],
];
const products: ShopProduct[] = [
  ...Object.entries(data.economy!.prices).map(([definitionId, price]): ShopProduct => ({id: `product.${definitionId}`, name: data.journey!.items[definitionId].name, definitionId, delivery: "supply", price, availableFromDay: 1, mode: "fixed", purchaseLimit: null})),
  ...equipment.map(([id, name, price, availableFromDay, mode]): ShopProduct => ({id: `product.equipment.${id}`, definitionId: `equipment.${id}`, name, price, availableFromDay, mode, delivery: "equipment", purchaseLimit: 1})),
];
/** Frozen predecessor data is cloned, never extended in place. */
export const SHOP_WAVE_CATALOG_DATA: D5Catalog = {...data, contentVersion: 23,
  shop: {version: 1, quoteVersion: 1, products: Object.fromEntries(products.map(p => [p.id, p])), rotationSlots: [{fromDay: 1, count: 0}, {fromDay: 3, count: 1}, {fromDay: 7, count: 2}]},
};
