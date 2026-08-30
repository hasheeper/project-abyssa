import { LAYER_MULTIPLIERS } from "../content/balance";
import type { ExpeditionState } from "../domain/state";

function roundTwo(value: number): number {
  return Math.round(value * 100) / 100;
}

/** Current-layer loose gold converted with hand and depth multipliers. */
export function getLayerPayout(state: ExpeditionState): number {
  const handFactor = roundTwo(1 + state.handMultiplier);
  const layerFactor = LAYER_MULTIPLIERS[state.layer - 1] ?? LAYER_MULTIPLIERS[4];
  return Math.round(state.gold * handFactor * layerFactor);
}
