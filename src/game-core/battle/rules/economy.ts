import type { BattleContext } from "../../contracts";

import type { ExpeditionState } from "../domain/state";

function roundTwo(value: number): number {
  return Math.round(value * 100) / 100;
}

/** Current-layer loose gold converted with hand and depth multipliers. */
export function getLayerPayout(context: BattleContext, state: ExpeditionState): number {
  const handFactor = roundTwo(1 + state.handMultiplier);
  const layerFactor = context.catalog.balance.LAYER_MULTIPLIERS[state.layer - 1] ?? context.catalog.balance.LAYER_MULTIPLIERS[4];
  return Math.round(state.gold * handFactor * layerFactor);
}
