import { parseShopVisitCommand } from "../contracts/shop-visit";
import { parseFacilityCommand, parseSupplyQuantities } from "../contracts/facilities";
import * as v from "../contracts/validation";
import type { D5ProgressEntry, D5ProgressEvent, D5RunRef } from "./d5-types";
import { GAME_START_POINTS } from "./d5-types";
import { MAX_DEPARTURE_SUPPLIES } from "../contracts/journey-limits";
import { parsePlayerName } from "../contracts/player-name";

export function parseD5RunRef(raw: unknown): D5RunRef {
  const r = v.record(raw, "runRef");
  const kind = v.choice(r.kind, ["expedition", "memory"], "runRef.kind");
  v.record(r, "runRef", ["kind", "id", ...(kind === "memory" ? ["attempt"] : [])]);
  const id = v.id(r.id, "runRef.id");
  return kind === "memory" ? { kind, id, attempt: v.number(r.attempt, "attempt", 1, 10000) } : { kind, id };
}
export const D5_EVENT_FIELDS: Record<D5ProgressEvent["type"], readonly string[]> = {
  "shop-visit-operated": ["command"],
  "phase-advanced": [],
  "facility-operated": ["command"],
  "game-start-selected": ["startAt"],
  "opening-advanced": ["step", "choice"],
  "shop-introduction-advanced": ["shopId", "step", "choice"],
  "prologue-advanced": ["shotId"],
  "prologue-completed": ["shotId", "choice"],
  "loot-appraised": ["shopId", "instanceId", "quoteVersion"],
  "loot-sold": ["shopId", "instanceId", "quoteVersion"],
  "product-purchased": ["shopId", "productId", "quantity", "day", "quoteVersion", "scheduleVersion"],
  "supply-purchased": ["shopId", "definitionId", "quantity", "quoteVersion"],
  "memory-inherited": ["runId", "chapterId"],
  "expedition-started": ["runId", "routeId", "partyIds", "itemIds", "progress"],
  "expedition-settled": ["terminal", "finalRun"],
  "manor-story": ["terminalId", "step", "choice"],
  "memory-started": ["runId", "chapterId", "templateId", "seed"],
  "memory-advanced": ["runRef", "node"],
  "memory-read": ["runRef", "node", "step"],
  "memory-ended": ["terminal"],
  "memory-retried": ["runId", "previousAttempt"],
  "memory-left": ["runRef"],
  "story-started": ["sessionId", "eventId", "basisId"],
  "story-advanced": ["sessionId", "step", "choice"],
  "story-completed": ["sessionId"],
  "equipment-moved": ["instanceId", "fromOwnerId", "toOwnerId"],
};
export function d5EventOrigin(type: D5ProgressEvent["type"]): D5ProgressEntry["origin"] {
  return type.startsWith("expedition-") ? "adventure" : type.startsWith("memory-") ? "memory" : "present";
}
export function parseD5ProgressEntry(raw: unknown): D5ProgressEntry {
  v.assertJson(raw);
  const e = v.record(raw, "progressEntry", ["id", "revision", "origin", "event"]);
  v.id(e.id, "entry.id"); v.number(e.revision, "entry.revision", 1);
  const event = v.record(e.event, "event");
  const type = v.choice(event.type, Object.keys(D5_EVENT_FIELDS) as D5ProgressEvent["type"][], "event.type");
  v.record(event, "event", ["type", ...D5_EVENT_FIELDS[type]], type === "expedition-started" ? ["supplyQuantities"] : type === "memory-read" ? ["choice"] : type === "game-start-selected" ? ["playerName"] : type === "loot-sold" ? ["quantity"] : type === "equipment-moved" ? ["targetFaceId"] : []);
  v.choice(e.origin, [d5EventOrigin(type)], "entry.origin");
  if (type === "shop-visit-operated") parseShopVisitCommand(event.command);
  if (type === "facility-operated") parseFacilityCommand(event.command);
  if (type === "expedition-started" && event.supplyQuantities !== undefined) parseSupplyQuantities(event.supplyQuantities);
  if (type === "game-start-selected") v.choice(event.startAt, GAME_START_POINTS, "startAt");
  if (type === "game-start-selected" && "playerName" in event) parsePlayerName(event.playerName);
  for (const key of ["runId", "routeId", "terminalId", "chapterId", "templateId", "sessionId", "eventId", "basisId", "instanceId", "shotId", "shopId", "targetFaceId", "productId"])
    if (key in event) v.id(event[key], key);
  for (const key of ["fromOwnerId", "toOwnerId"])
    if (key in event && event[key] !== null) v.id(event[key], key);
  if ("partyIds" in event) v.ids(event.partyIds, "partyIds", 5);
  if ("itemIds" in event) v.ids(event.itemIds, "itemIds", MAX_DEPARTURE_SUPPLIES);
  if ("seed" in event) v.number(event.seed, "seed", 0, 0xffffffff);
  if (type === "loot-appraised" || type === "loot-sold") {
    v.id(event.shopId, "shopId"); v.id(event.instanceId, "instanceId"); v.number(event.quoteVersion, "quoteVersion", 1);
  }
  if (type === "loot-sold" && event.quantity !== undefined) v.number(event.quantity, "quantity", 1, 999);
  if (type === "product-purchased") {
    v.number(event.scheduleVersion, "scheduleVersion", 1);
    v.number(event.quantity, "quantity", 1, 999); v.number(event.day, "day", 1); v.number(event.quoteVersion, "quoteVersion", 1);
  }
  if (type === "supply-purchased") {
    v.id(event.shopId, "shopId"); v.id(event.definitionId, "definitionId");
    v.number(event.quantity, "quantity", 1, 4); v.number(event.quoteVersion, "quoteVersion", 1);
  }
  if ("previousAttempt" in event) v.number(event.previousAttempt, "previousAttempt", 1, 9999);
  if ("step" in event) v.number(event.step, "step", 0, type === "opening-advanced" ? 512 : 100);
  if ("choice" in event) v.choice(event.choice,
    type === "opening-advanced" ? ["continue", "A", "B", "C"] : type === "manor-story" || type === "prologue-completed" || type === "shop-introduction-advanced" ? ["continue", "skip"]
      : type === "memory-read" ? ["iron", "seasoned", "pragmatic"]
      : ["continue", "skip", "later", "iron", "seasoned", "pragmatic"], "choice");
  if ("runRef" in event && parseD5RunRef(event.runRef).kind !== "memory") v.invalid("runRef", "Memory event needs a memory reference");
  if (type === "memory-read") v.choice(event.node, ["present-intro", "history-opening", "teaching", "history-complete"], "node");
  if (type === "memory-advanced") v.choice(event.node, ["history-opening", "teaching", "battle", "return-pending"], "node");
  // Nested progress, ordinary terminals and memory proofs are validated against content during replay.
  return structuredClone(raw) as D5ProgressEntry;
}
