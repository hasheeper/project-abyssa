import type { AirpHead, ValidatedD5Catalog } from "../../game-core/contracts";
import { hasManorPatrolAccess, type D5ExpeditionState, type D5Projection } from "../../game-core/session";
import type { D5Fact } from "./d5-contracts";

export type AirpReplayInput = {
  head: AirpHead; before: D5Projection; after: D5Projection;
  run: D5ExpeditionState | null; facts: readonly D5Fact[]; group: readonly D5Fact[]; retracted: readonly string[];
};
export function airpAtHome(c: D5Projection): boolean {
  return !c.activeRunRef && !c.activeStoryId && c.prologue?.status !== "playing" && c.opening?.status !== "playing"
    && c.manor.story?.status !== "pending" && (!c.memory || c.memory.node === "completed" || c.memory.node === "left");
}
export function airpEligible(c: D5Projection, catalog?: ValidatedD5Catalog): boolean {
  const openingAccess = catalog?.ref.contentVersion === 28 && hasManorPatrolAccess(c, catalog.data);
  return airpAtHome(c) && (openingAccess || !!c.airpDemoStart || !!c.manor.takeover && !!c.manor.story && c.manor.story.status !== "pending")
    && c.availableCharacterIds.includes("elora") && (c.tutorial?.status === "completed" || c.tutorial?.status === "exempt");
}
