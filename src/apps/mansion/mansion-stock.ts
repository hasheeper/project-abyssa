import { equipmentArt } from "../../content/presentation/equipment";
import { resolveItemIcon } from "../../assets/icons/items/catalog";
import { supplyArt } from "../../content/presentation/supply-icons";
import { archiveIdentities } from "../../content/characters/identities";
import { equipmentNames } from "../../game-client/character-presentation";
import type { DemoEquipmentDef } from "../../game-core/contracts";
import type { D5EquipmentInstance } from "../../game-core/session";
import type { DemoJourneyView } from "../../game-runtime/demo-journey-view";
import type { ResourceInventoryEntry } from "../../shared/ui/patterns/ResourceInventoryDialog";

const FIXED_SUPPLY_IDS = ["item.food", "item.potion", "item.ward", "item.holy-water", "item.maintenance-kit", "item.lucky-charm", "item.divination-slip"];

export type StockEquipment = Pick<D5EquipmentInstance, "instanceId" | "definitionId" | "location"> & {
  definition?: DemoEquipmentDef;
};

/** Read-only presentation. Stock is committed storedCharges, never the free
 * departure allowance. Equipment keeps its instance and ownership identity. */
export function mansionResourceEntries(
  supplies: readonly DemoJourneyView["items"][number][],
  equipment: readonly StockEquipment[],
  narrativeItems: readonly ResourceInventoryEntry[] = [],
): {fixedEntries: ResourceInventoryEntry[]; sandboxEntries: ResourceInventoryEntry[]} {
  const supplyEntries = supplies.map(item => ({
      id: item.id, name: item.name,
      icon: supplyArt[item.kind]?.icon ?? resolveItemIcon({name: item.name, category: "补给"}).assetUrl,
      quantity: item.storedCharges, unit: "份",
      type: item.free ? "基础配给" : "战术补给",
      description: supplyArt[item.kind]?.description,
      note: item.free ? "出征时补齐所选配给。" : `按实际库存携带${item.storageCapacity ? ` · 储存上限 ${item.storageCapacity}` : ""}。`,
    }));
  return {
    fixedEntries: FIXED_SUPPLY_IDS.flatMap(id => supplyEntries.filter(item => item.id === id)),
    sandboxEntries: [
    ...supplyEntries.filter(item => !FIXED_SUPPLY_IDS.includes(item.id)),
    ...equipment.map(item => {
      const name = equipmentNames[item.definitionId] ?? item.definitionId;
      const ownerId = item.location.kind === "inventory" ? null : item.location.ownerId;
      const owner = archiveIdentities.find(identity => identity.id === ownerId)?.selectorLabel ?? ownerId;
      return {
        id: item.instanceId, name,
        icon: equipmentArt[item.definitionId]?.icon ?? resolveItemIcon({name, category: "装备"}).assetUrl,
        quantity: 1, unit: "件", type: "通用装备",
        description: equipmentArt[item.definitionId]?.description,
        status: item.location.kind === "inventory" ? undefined : item.location.kind === "equipped" ? "已装备" : "远征中",
        ownership: item.location.kind === "inventory" ? "馆内库存 · 未装备"
          : item.location.kind === "equipped" ? `由${owner}携带` : `由${owner}携带 · 本次远征占用`,
      };
    }),
    ...narrativeItems,
    ],
  };
}

/** Only confirmed carry evidence from the validated narrative query is a held
 * object. Offered, merely mentioned, delivered, and lost items never enter it.
 * No category enum or predefined item catalog is required for the open shelf. */
export type StockNarrativeView = {
  version: 1; instance: {id: string; status: string} | null; carrying: boolean; objective: string | null;
} | {
  version: 2; entries: readonly {
    instance: {id: string; status: string; carryFactId: string | null};
    card: {objective: {form: string; itemLabel?: string}};
    objective: string; title: string;
  }[];
} | null;

export function mansionNarrativeItems(view: StockNarrativeView): ResourceInventoryEntry[] {
  if (!view) return [];
  const held = view.version === 1
    ? view.instance && view.carrying ? [{id: view.instance.id, status: view.instance.status, name: "空药箱", description: view.objective ?? undefined, source: "艾洛拉的委托"}] : []
    : view.entries.flatMap(entry => entry.card.objective.form === "sortie" && entry.card.objective.itemLabel && entry.instance.carryFactId
      ? [{id: entry.instance.id, status: entry.instance.status, name: entry.card.objective.itemLabel, description: entry.objective, source: entry.title}] : []);
  return held.filter(item => item.status === "accepted" || item.status === "ready").map(item => ({
    id: `narrative:${item.id}`, name: item.name,
    icon: resolveItemIcon({name: item.name, category: "物品"}).assetUrl,
    quantity: 1, unit: "件", type: "委托物品", description: item.description,
    status: item.status === "ready" ? "待交付" : "远征中",
    note: `来源：${item.source}`,
  }));
}
