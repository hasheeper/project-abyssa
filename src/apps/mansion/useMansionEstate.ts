import { useCallback, useMemo, useRef, useState } from "react";
import { useGameState, useGameSession } from "../../game-client/react";
import { resolveItemIcon } from "../../assets/icons/items/catalog";
import type { FacilityCommand } from "../../game-core/contracts/facilities";
import type { SceneFeedbackEntry } from "../../shared/ui/patterns/SceneFeedback";
import { supplyArt } from "../../content/presentation/supply-icons";
import herbIcon from "../../assets/icons/items/herbs-bundle.svg";
import { MANSION_ROOM_DETAILS } from "./data";
import type { MansionPhaseId, MansionProductionIcon } from "./data";
import { mansionResourceEntries, mansionNarrativeItems, type StockEquipment } from "./mansion-stock";
import type { InventoryEntry } from "../../shared/ui/patterns/InventoryGrid";

// Historical content retains its scenery projection.
const facilityLevels = Object.fromEntries(Object.entries(MANSION_ROOM_DETAILS).map(([id, detail]) => [id, detail.level]));
const noProgress: Readonly<Record<string, number>> = {};
const noRooms: ReadonlySet<string> = new Set();
const previewPhase = (_phase: MansionPhaseId) => {};
const noFacilityAction = (_id: string) => {};

/** All quantities and production readiness come from the validated campaign. */
export function useMansionEstate() {
  const game = useGameState(), record = game.record!, campaign = record.snapshot.campaign;
  const session = useGameSession();
  const time = useMemo(() => session.runtime.queries.mansionTime(record), [record, session]);
  const journey = useMemo(() => session.runtime.queries.journey(record), [record, session]);
  const facilities = journey?.facilities ?? null;
  const levels = useMemo(() => facilities ? {...facilityLevels, ...facilities.state.levels} : facilityLevels, [facilities]);
  const upgrading = useMemo(() => facilities?.construction ? {[facilities.construction.roomId]: facilities.construction.remainingPhases} : noProgress, [facilities]);
  const readyProduction = useMemo(() => facilities ? new Set(facilities.rooms.filter(room => room.batch?.collectMaximum || room.id === "workshop" && facilities.order?.remainingPhases === 0).map(room => room.id)) : noRooms, [facilities]);
  const [feedback, setFeedback] = useState<SceneFeedbackEntry[]>([]);
  const inFlight = useRef(false);
  const dismissFeedback = useCallback((id: string) => setFeedback(entries => entries.filter(e => e.id !== id)), []);
  const operateFacility = useCallback(async (command: FacilityCommand) => {
    if (inFlight.current) return;
    inFlight.current = true;
    try {
      const batch = await session.dispatch(command);
      if (!batch?.presentable) return;
      const before = session.runtime.queries.journey(batch.before), after = session.runtime.queries.journey(batch.after);
      if (!after?.facilities) return;
      const rewards = [
        ...after.items.map(item => ({id: item.id, name: item.name, icon: supplyArt[item.kind]?.icon, quantity: item.storedCharges - (before?.items.find(i => i.id === item.id)?.storedCharges ?? 0)})),
        ...after.facilities.materials.map(item => ({id: item.id, name: item.name, icon: herbIcon, quantity: item.quantity - (before?.facilities?.materials.find(i => i.id === item.id)?.quantity ?? 0)})),
      ].filter(item => item.quantity > 0);
      setFeedback(entries => [...entries, ...rewards.map(reward => ({id: `facility:${batch.after.head.revision}:${reward.id}`, kind: "reward" as const, reward: {...reward, kind: "item" as const}}))]);
    } finally { inFlight.current = false; }
  }, [session]);
  const production = useMemo(() => facilities ? Object.fromEntries(facilities.rooms.flatMap(room => {
    const batch = room.batch;
    if (batch) return [[room.id, {label: batch.name, amount: batch.remaining, icon: (batch.kind === "material" ? "herbs" : "meal") as MansionProductionIcon}]];
    if (room.id === "workshop" && facilities.order) return [[room.id, {label: facilities.order.name, amount: facilities.order.quantity, icon: "potion" as MansionProductionIcon}]];
    return [];
  })) : undefined, [facilities]);
  const collectProduction = useCallback((roomId: string) => {
    const room = facilities?.rooms.find(r => r.id === roomId), batch = room?.batch;
    if (batch?.collectMaximum) void operateFacility({type: "facility-collect", roomId: room!.id, batchId: batch.id, quantity: batch.collectMaximum});
    else if (roomId === "workshop" && facilities?.order?.remainingPhases === 0) void operateFacility({type: "facility-claim", orderId: facilities.order.id});
  }, [facilities, operateFacility]);
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
    const supplies = journey?.items ?? [];
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
    const materials = (facilities?.materials ?? []).filter(m => m.quantity > 0).map(m => ({id: m.id, name: m.name, quantity: m.quantity, unit: "束", type: "原材料", icon: herbIcon, description: m.description, note: `储存上限 ${m.capacity} · 原料不可带入战斗`}));
    return {
      inventoryEntries: [], ...mansionResourceEntries(supplies, equipment, [...narrativeItems, ...materials]),
      stockTotal: supplies.filter(item => item.storedCharges > 0).length + equipment.filter(item => item.location.kind === "inventory").length
        + narrativeItems.filter(item => item.status === "待交付").length + materials.length,
    };
  }, [record, session, journey, facilities]);
  return {
    capacity: record.schemaVersion === 1 ? record.snapshot.campaign.inventory.capacity : undefined, phase: campaign.clock.phase, day: campaign.clock.day, funds: campaign.funds,
    facilities, operateFacility, production, feedback, dismissFeedback, busy: game.status !== "ready",
    levels, upgrading, repairProgress: noProgress,
    damaged: noRooms, readyProduction,
    stockOpen, toast: "", ...stock,
    time, previewPhase, advancePhase,
    collectProduction, startUpgrade: noFacilityAction, promoteFacility: noFacilityAction,
    toggleStock, closeStock,
  };
}
