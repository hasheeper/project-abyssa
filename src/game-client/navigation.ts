import { routeHref } from "../shared/routing/location";
import type { AnyGameRecord } from "../game-application";
export type SaveLocator = { saveId: string; epoch: string; expeditionId?: string; memory?: { id: string; attempt: number } };
// Literal route table is also audited by the entry closure checker.
export const gamePages = { title: "title.html", prologue: "prologue.html", menu: "menu.html", map: "map.html", battle: "battle.html", mansion: "mansion.html", shop: "shop.html", "character-status": "character-status.html" } as const;
export type GamePage = keyof typeof gamePages;
const validId = (value: string | null): value is string => value !== null && /^[A-Za-z0-9][A-Za-z0-9._:/-]{0,191}$/.test(value);
export function parseLocator(search: string): SaveLocator | null {
  const params = new URLSearchParams(search), saveId = params.get("save"), epoch = params.get("epoch"), expeditionId = params.get("expedition");
  if (!validId(saveId) || !validId(epoch) || (expeditionId !== null && !validId(expeditionId))) return null;
  const memoryId = params.get("memory"), attempt = params.get("attempt");
  if (memoryId !== null && (!validId(memoryId) || expeditionId !== null || attempt === null || !/^[1-9]\d{0,3}$|^10000$/.test(attempt)) || memoryId === null && attempt !== null) return null;
  return { saveId, epoch, ...(expeditionId ? { expeditionId } : {}), ...(memoryId ? {memory: {id: memoryId, attempt: Number(attempt)}} : {}) };
}
export function gameHref(page: GamePage, locator?: SaveLocator | null, archive?: CharacterLocation): string {
  if (page === "title" || !locator) return routeHref(page);
  const params = new URLSearchParams({ save: locator.saveId, epoch: locator.epoch });
  if ((page === "battle" || page === "character-status") && locator.expeditionId) params.set("expedition", locator.expeditionId);
  if ((page === "battle" || page === "character-status") && locator.memory) { params.delete("expedition"); params.set("memory", locator.memory.id); params.set("attempt", String(locator.memory.attempt)); }
  if (page === "character-status" && archive) { if (archive.characterId) params.set("character", archive.characterId); params.set("tab", archive.tab); params.set("from", archive.from); }
  return routeHref(page, `?${params}`);
}
export function recordLocator(record: AnyGameRecord): SaveLocator {
  if (record.schemaVersion === 4 && record.snapshot.campaign.activeRunRef?.kind === "memory") { const ref = record.snapshot.campaign.activeRunRef; return {saveId: record.head.saveId, epoch: record.head.epoch, memory: {id: ref.id, attempt: ref.attempt}}; }
  const id = record.schemaVersion === 1 ? record.snapshot.expedition?.id : record.snapshot.campaign.activeRunRef?.id;
  return { saveId: record.head.saveId, epoch: record.head.epoch, ...(id ? { expeditionId: id } : {}) };
}
export type CharacterLocation = { characterId?: string; tab: "summary" | "dice" | "archive"; from: "menu" | "map" | "battle" };
export function parseCharacterLocation(search: string): CharacterLocation {
  const p = new URLSearchParams(search), characterId = p.get("character"), tab = p.get("tab"), from = p.get("from");
  return { ...(validId(characterId) ? { characterId } : {}), tab: tab === "dice" || tab === "archive" ? tab : "summary", from: from === "map" || from === "battle" ? from : "menu" };
}
const recentKey = "abyssa:recent-save:v1";
export function rememberSave(locator: SaveLocator) {
  try { localStorage.setItem(recentKey, JSON.stringify({ saveId: locator.saveId, epoch: locator.epoch })); } catch { /* Selection hint is optional. */ }
}
export function recentSave(): SaveLocator | null {
  try {
    const value = JSON.parse(localStorage.getItem(recentKey) ?? "null");
    return value && validId(value.saveId) && validId(value.epoch) ? value : null;
  } catch { return null; }
}

export const locatorHasRun = (locator: SaveLocator) => !!(locator.expeditionId || locator.memory);
export function locatorMatchesRun(record: AnyGameRecord, locator: SaveLocator): boolean {
  if (record.schemaVersion === 4 && record.snapshot.campaign.activeRunRef?.kind === "memory") {
    const ref = record.snapshot.campaign.activeRunRef;
    return locator.memory?.id === ref.id && locator.memory.attempt === ref.attempt;
  }
  const id = record.schemaVersion === 1 ? record.snapshot.expedition?.id : record.snapshot.campaign.activeRunRef?.id;
  return !!id && !locator.memory && id === locator.expeditionId;
}
