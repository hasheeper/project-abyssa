/** The current chapter's six-slot bag; published earlier journeys keep four. */
export const MAX_DEPARTURE_SUPPLIES = 6;

export function departureSupplyLimit(ref: {rulesVersion: number; contentVersion: number}): number {
  return ref.rulesVersion === 4 && ref.contentVersion >= 12 ? MAX_DEPARTURE_SUPPLIES : 4;
}
