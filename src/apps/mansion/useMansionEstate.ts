import { useState } from "react";
import { useGameState, useGameSession } from "../../game-client/react";
import { resolveItemIcon } from "../../assets/icons/items/catalog";
import { MANSION_ROOM_DETAILS } from "./data";
import type { MansionPhaseId } from "./data";

/** Campaign owns assets; facilities remain scenery until their rules ship. */
export function useMansionEstate() {
  const record = useGameState().record!, campaign = record.snapshot.campaign;
  const session = useGameSession();
  const items = record.schemaVersion !== 1 ? session.runtime.queries.journey(record)?.items : null;
  const [stockOpen, setStockOpen] = useState(false);
  const entries = record.schemaVersion === 1 ? [...record.snapshot.campaign.inventory.items, ...record.snapshot.campaign.inventory.equipment] : record.snapshot.campaign.supplies;
  const inventoryEntries = entries.map(item => ({ id: item.instanceId, name: items?.find(d => d.id === item.definitionId)?.name ?? item.definitionId,
    icon: resolveItemIcon({ name: items?.find(d => d.id === item.definitionId)?.name ?? item.definitionId, category: "物品", quality: 1 }).assetUrl,
    quantity: "charges" in item ? item.charges : 1, description: "charges" in item ? "source" in item && item.source === "supply.demo.shop" ? "战术补给，按实际余量携带；可在杂货铺补充。" : "基础配给，出发时补齐所选物品。" : item.instanceId,
  }));
  return {
    capacity: record.schemaVersion === 1 ? record.snapshot.campaign.inventory.capacity : 7, phase: campaign.clock.phase, day: campaign.clock.day, funds: campaign.funds,
    levels: Object.fromEntries(Object.entries(MANSION_ROOM_DETAILS).map(([id, detail]) => [id, detail.level])),
    upgrading: {} as Record<string, number>, repairProgress: {} as Record<string, number>,
    damaged: new Set<string>(), readyProduction: new Set<string>(),
    stockOpen, toast: "", inventoryEntries, stockTotal: entries.length,
    previewPhase: (_phase: MansionPhaseId) => {}, advancePhase: () => {},
    collectProduction: (_id: string) => {}, startUpgrade: (_id: string) => {}, promoteFacility: (_id: string) => {},
    toggleStock: () => setStockOpen(open => !open), closeStock: () => setStockOpen(false),
  };
}
