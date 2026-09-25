import { supplyArt } from "../../content/presentation/supply-icons";
import { shopLootPresentation } from "../../content/presentation/shop-loot";
import type { StockCategory } from "../../game-client/shop/stock-categories";

export type { Mode } from "../../game-client/shop/stock-model";
export type PreviewSupply = {
  id: string; name: string; description: string; icon: string;
  price: number; capacity: number; owned: number; category: StockCategory;
};
export type PreviewLoot = {id: string; definitionId: string; identified: boolean};

/** Deliberate local fixtures: no Campaign, persistence, or new gameplay content. */
export function initialSupplies(): PreviewSupply[] {
  const supplies: Omit<PreviewSupply, "description" | "icon">[] = [
    {id: "ward", name: "护符", price: 400, capacity: 2, owned: 0, category: "battle"},
    {id: "holy-water", name: "圣水", price: 300, capacity: 2, owned: 0, category: "battle"},
    {id: "maintenance-kit", name: "保养工具", price: 600, capacity: 1, owned: 0, category: "battle"},
    {id: "lucky-charm", name: "幸运符", price: 800, capacity: 1, owned: 0, category: "battle"},
    {id: "divination-slip", name: "卦签", price: 300, capacity: 2, owned: 0, category: "exploration"},
  ];
  return supplies.map(item => ({...item, ...supplyArt[item.id]}));
}

export function initialLoot(): PreviewLoot[] {
  return [
    {id: "preview-ring-1", definitionId: "loot.tutorial.curio", identified: false},
    {id: "preview-ring-2", definitionId: "loot.tutorial.curio", identified: true},
  ];
}

export const previewLootDefinitions = {
  "loot.tutorial.curio": {...shopLootPresentation["loot.tutorial.curio"], category: "curio" as const, fee: 300, value: 800},
};

export function presentLoot(item: PreviewLoot) {
  const definition = previewLootDefinitions[item.definitionId as keyof typeof previewLootDefinitions];
  return {
    ...definition, ...item,
    name: item.identified ? definition.name : definition.unknownName,
    description: item.identified ? definition.description : definition.appearance,
    icon: definition.iconUrl, owned: 1,
  };
}
