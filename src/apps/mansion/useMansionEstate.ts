import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { DEFAULT_MANSION_RECTANGLES } from "../../content/mansion/defaultRegions";
import type { InventoryEntry } from "../../shared/ui/patterns/InventoryGrid";
import {
  MANSION_ROOM_DETAILS,
  type MansionPhaseId,
  type MansionProduction
} from "./data";
import { PRODUCTION_GLYPHS } from "./MansionMarkers";
import {
  advanceMansionPhase,
  collectMansionProduction,
  createMansionEstateState,
  previewMansionPhase,
  promoteMansionFacility,
  startMansionRepair,
  type MansionEstateTransition
} from "./mansion-state";

const MANSION_PRODUCTS: Record<string, MansionProduction> = Object.fromEntries(
  Object.values(MANSION_ROOM_DETAILS)
    .filter((detail) => detail.production)
    .map((detail) => [detail.production!.id, detail.production!])
);

const MANSION_PRODUCT_ORIGINS: Record<string, string> = Object.fromEntries(
  Object.entries(MANSION_ROOM_DETAILS)
    .filter(([, detail]) => detail.production)
    .map(([roomId, detail]) => [
      detail.production!.id,
      DEFAULT_MANSION_RECTANGLES.find((rect) => rect.id === roomId)?.label ?? roomId
    ])
);

export function useMansionEstate() {
  const [estate, setEstate] = useState(createMansionEstateState);
  const estateRef = useRef(estate);
  const [stockOpen, setStockOpen] = useState(false);
  const [toast, setToast] = useState("");
  const toastTimerRef = useRef<number | null>(null);

  const showToast = useCallback((message: string) => {
    setToast(message);
    if (toastTimerRef.current !== null) window.clearTimeout(toastTimerRef.current);
    toastTimerRef.current = window.setTimeout(() => {
      toastTimerRef.current = null;
      setToast("");
    }, 2400);
  }, []);

  useEffect(() => () => {
    if (toastTimerRef.current !== null) window.clearTimeout(toastTimerRef.current);
  }, []);

  const commit = useCallback((transition: MansionEstateTransition) => {
    if (transition.state !== estateRef.current) {
      estateRef.current = transition.state;
      setEstate(transition.state);
    }
    if (transition.notice) showToast(transition.notice);
  }, [showToast]);

  const previewPhase = useCallback((phase: MansionPhaseId) => {
    commit(previewMansionPhase(estateRef.current, phase));
  }, [commit]);

  const advancePhase = useCallback(() => {
    commit(advanceMansionPhase(estateRef.current, [
      Math.random(),
      Math.random(),
      Math.random()
    ]));
  }, [commit]);

  const collectProduction = useCallback((roomId: string) => {
    commit(collectMansionProduction(estateRef.current, roomId));
  }, [commit]);

  const startUpgrade = useCallback((roomId: string) => {
    commit(startMansionRepair(estateRef.current, roomId));
  }, [commit]);

  const promoteFacility = useCallback((roomId: string) => {
    commit(promoteMansionFacility(estateRef.current, roomId));
  }, [commit]);

  const inventoryEntries = useMemo<InventoryEntry[]>(
    () =>
      Object.entries(estate.inventory)
        .filter(([itemId, amount]) => amount > 0 && MANSION_PRODUCTS[itemId] != null)
        .map(([itemId, amount]): InventoryEntry => {
          const production = MANSION_PRODUCTS[itemId]!;
          return {
            id: itemId,
            name: production.label,
            icon: PRODUCTION_GLYPHS[production.icon],
            rarity: production.rarity ?? "bronze",
            quantity: amount,
            unit: production.unit,
            description: production.description,
            category: production.category,
            meta: {
              产地: MANSION_PRODUCT_ORIGINS[itemId] ?? "—",
              单位: production.unit,
              每相位: `${production.amount}${production.unit}`
            }
          };
        }),
    [estate.inventory]
  );
  const stockTotal = inventoryEntries.reduce(
    (sum, entry) => sum + (entry.quantity ?? 0),
    0
  );

  return {
    ...estate,
    stockOpen,
    toast,
    inventoryEntries,
    stockTotal,
    previewPhase,
    advancePhase,
    collectProduction,
    startUpgrade,
    promoteFacility,
    toggleStock: () => setStockOpen((open) => !open),
    closeStock: () => setStockOpen(false)
  };
}
