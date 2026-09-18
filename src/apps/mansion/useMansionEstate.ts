import { useCallback, useMemo, useState } from "react";
import { useGameState, useGameSession } from "../../game-client/react";
import { resolveItemIcon } from "../../assets/icons/items/catalog";
import { MANSION_ROOM_DETAILS } from "./data";
import type { MansionPhaseId } from "./data";
import { mansionResourceEntries, mansionNarrativeItems, type StockEquipment } from "./mansion-stock";
import type { InventoryEntry } from "../../shared/ui/patterns/InventoryGrid";

// Facilities are read-only scenery: stable references keep unrelated modal and
// hover updates from rebuilding every room/marker in the world.
const facilityLevels = Object.fromEntries(Object.entries(MANSION_ROOM_DETAILS).map(([id, detail]) => [id, detail.level]));
const noProgress: Readonly<Record<string, number>> = {};
const noRooms: ReadonlySet<string> = new Set();
const previewPhase = (_phase: MansionPhaseId) => {};
const noFacilityAction = (_id: string) => {};

/** Campaign owns assets; facilities remain scenery until their rules ship. */
export function useMansionEstate() {
  const record = useGameState().record!, campaign = record.snapshot.campaign;
  const session = useGameSession();
  const time = useMemo(() => session.runtime.queries.mansionTime(record), [record, session]);
  const [stockOpen, setStockOpen] = useState(false);
  const toggleStock = useCallback(() => setStockOpen(open => !open), []);
  const closeStock = useCallback(() => setStockOpen(false), []);
  const advancePhase = useCallback(() => session.dispatch({type: "advance-phase"}), [session]);
  const stock = useMemo(() => {
    if (record.schemaVersion === 1) {
      const entries = [...record.snapshot.campaign.inventory.items, ...record.snapshot.campaign.inventory.equipment];
      const inventoryEntries: InventoryEntry[] = entries.map(item => ({
        id: item.instanceId, name: item.definitionId,
        icon: resolveItemIcon({name: item.definitionId, category: "物品", quality: 1}).assetUrl,
        quantity: "charges" in item ? item.charges : 1,
        description: "charges" in item ? "基础配给，出发时补齐所选物品。" : item.instanceId,
      }));
      return {inventoryEntries, fixedEntries: [], sandboxEntries: [], stockTotal: entries.length};
    }
    const supplies = session.runtime.queries.journey(record)?.items ?? [];
    let equipment: StockEquipment[];
    if (record.schemaVersion === 4) {
      equipment = session.runtime.queries.progression(record)?.inventory ?? [];
    } else {
      const archive = session.runtime.queries.archive(record);
      equipment = archive.version === 2 ? archive.characters.flatMap(character => character.equipment.map(item => ({
        ...item, location: {kind: "equipped" as const, ownerId: item.ownerId},
      }))) : [];
    }
    const narrativeItems = mansionNarrativeItems(session.runtime.queries.narrative(record));
    return {
      inventoryEntries: [], ...mansionResourceEntries(supplies, equipment, narrativeItems),
      stockTotal: supplies.filter(item => item.storedCharges > 0).length + equipment.filter(item => item.location.kind === "inventory").length
        + narrativeItems.filter(item => item.status === "待交付").length,
    };
  }, [record, session]);
  return {
    capacity: record.schemaVersion === 1 ? record.snapshot.campaign.inventory.capacity : undefined, phase: campaign.clock.phase, day: campaign.clock.day, funds: campaign.funds,
    levels: facilityLevels, upgrading: noProgress, repairProgress: noProgress,
    damaged: noRooms, readyProduction: noRooms,
    stockOpen, toast: "", ...stock,
    time, previewPhase, advancePhase,
    collectProduction: noFacilityAction, startUpgrade: noFacilityAction, promoteFacility: noFacilityAction,
    toggleStock, closeStock,
  };
}
