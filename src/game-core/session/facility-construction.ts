import type { FacilityContent, FacilityId, FacilityLevel } from "../contracts/facilities";
import type { FacilityState, Construction } from "./facility-types";
export type { Construction } from "./facility-types";
import * as v from "../contracts/validation";
/** Pure quote shared by the command reducer and the room view. */
export function quoteConstruction(content: FacilityContent, state: FacilityState, roomId: FacilityId, basePrice: number, phase: number): Construction {
  v.number(basePrice, "basePrice", 1, 400_000); v.number(phase, "phase", 0);
  const level = state.levels[roomId];
  if (level >= 3 || roomId === "workshop" && state.order) v.invalid("construction", "Facility is complete or has an unfinished order", "command-not-available");
  const discount = roomId === "maid" || !state.levels.maid ? 0 : content.repairDiscount[state.levels.maid - 1];
  return {roomId, fromLevel: level, toLevel: (level + 1) as FacilityLevel, cost: Math.ceil(basePrice * [0.25, 1, 2][level] * (100 - discount) / 100), readyAt: phase + [2, 4, 8][level]};
}
export function startConstruction(content: FacilityContent, state: FacilityState, active: Construction | null, roomId: FacilityId, basePrice: number, phase: number): Construction {
  if (active) v.invalid("construction", "Another project is under construction", "command-not-available");
  return quoteConstruction(content, state, roomId, basePrice, phase);
}
export function completeConstruction(state: FacilityState, project: Construction, phase: number): FacilityState {
  if (phase < project.readyAt || state.levels[project.roomId] !== project.fromLevel) v.invalid("construction", "Project has not completed or is stale", "command-not-available");
  // Existing batches are deliberately unchanged; new cycles use the new level.
  return {...structuredClone(state), levels: {...state.levels, [project.roomId]: project.toLevel}};
}
