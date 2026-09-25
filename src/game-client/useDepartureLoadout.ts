import { useState, type SetStateAction } from "react";
import type { AnyGameRecord } from "../game-application";
import type { ClientRuntime } from "./session";

export type DepartureJourney = NonNullable<ReturnType<ClientRuntime["queries"]["journey"]>>;
export type DepartureSupply = DepartureJourney["items"][number];
export const DEPARTURE_ITEM_LIMIT = 6;

export function departureLoadoutKey(record: AnyGameRecord) {
  return `abyssa:departure-loadout:v1:${encodeURIComponent(record.head.saveId)}:${encodeURIComponent(record.head.epoch)}:${record.schemaVersion}:${record.contentRef.digest}`;
}

/** A UI preference, never inventory or a command. Revalidate against the current query. */
export function availableLoadout(raw: unknown, items: readonly Pick<DepartureSupply,"id"|"availableCharges">[], limit = DEPARTURE_ITEM_LIMIT): string[] {
  if (!Array.isArray(raw)) return [];
  const available = new Set(items.filter(item => item.availableCharges > 0).map(item => item.id));
  return [...new Set(raw.filter((id): id is string => typeof id === "string" && available.has(id)))].slice(0, limit);
}

function readDraft(key: string, journey: DepartureJourney | null) {
  if (!journey) return [];
  try {
    const raw = sessionStorage.getItem(key);
    const parsed: unknown = raw && raw.length < 4096 ? JSON.parse(raw) : null;
    if (Array.isArray(parsed)) return availableLoadout(parsed, journey.items, journey.itemLimit);
  } catch { /* A blocked preference store must not block the game. */ }
  return availableLoadout(journey.defaultItems, journey.items, journey.itemLimit);
}

export function useDepartureLoadout(record: AnyGameRecord, journey: DepartureJourney | null) {
  const key = departureLoadoutKey(record);
  const itemLimit = journey?.itemLimit ?? DEPARTURE_ITEM_LIMIT;
  const [draft, setDraft] = useState(() => ({key, ids:readDraft(key,journey)}));
  const [failedKey, setFailedKey] = useState<string | null>(null);
  const ids = availableLoadout(draft.key === key ? draft.ids : readDraft(key,journey), journey?.items ?? [], itemLimit);
  const setIds = (update: SetStateAction<string[]>) => {
    const next = availableLoadout(typeof update === "function" ? update(ids) : update, journey?.items ?? [], itemLimit);
    setDraft({key,ids:next});
    try { sessionStorage.setItem(key,JSON.stringify(next)); setFailedKey(null); }
    catch { setFailedKey(key); }
  };
  const quantityKey = `${key}:quantities`;
  const readQuantities = () => { try { const raw = JSON.parse(sessionStorage.getItem(quantityKey) ?? "{}"); return raw && !Array.isArray(raw) && typeof raw === "object" ? raw as Record<string, number> : {}; } catch { return {}; } };
  const [quantityDraft, setQuantityDraft] = useState(() => ({key, values: readQuantities()}));
  const values = quantityDraft.key === key ? quantityDraft.values : readQuantities();
  const quantities = Object.fromEntries((journey?.items ?? []).map(item => [item.id, Math.max(0, Math.min(item.availableCharges, Number.isInteger(values[item.id]) && values[item.id] > 0 ? values[item.id] : item.availableCharges))]));
  const setQuantity = (id: string, value: number) => {
    const item = journey?.items.find(i => i.id === id);
    if (!item || !Number.isInteger(value) || value < 1 || value > item.availableCharges) return;
    const next = {...quantities, [id]: value}; setQuantityDraft({key, values: next});
    try { sessionStorage.setItem(quantityKey, JSON.stringify(next)); } catch { setFailedKey(key); }
  };
  const selection = journey?.facilities ? {supplyQuantities: Object.fromEntries(ids.map(id => [id, quantities[id]]))} : {};
  return {ids, setIds, itemLimit, quantities, setQuantity, selection, storageUnavailable:failedKey === key};
}
