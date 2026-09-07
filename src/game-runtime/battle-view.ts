import { createBattleBindings } from "../game-core/battle/bindings";
import { LEGACY_CONTEXT } from "./legacy-context";
import type { BattleState } from "../game-core/battle";
// Explicit read-only surface. No creation, dispatch, RNG or state mutator escapes.
const view = createBattleBindings(LEGACY_CONTEXT);
export const {
  CHARACTERS, PARTY_ORDER, DOWNED_RETURN_HP, FRENZY_ATTACK_BONUS, LAYER_MULTIPLIERS, MAX_HP, MAX_LAYER,
  canToggleLoad, canUndo, getBattlePhase, getExpeditionStatus, getRoundOutcome,
  getEffectiveFaceQuality, getFrenzyWarningRounds, getIncomingDamageFor, getIntentThreat,
  isEnemyFrenzied, isEnemyDefeated, getLayerPayout, getStateFace, getUndoLabel,
  hasUnloadedDice, getGreedSummary, getRustFaceCount, getGildFaceCount, isDieDowned,
  getBlocked, getTotalThreat, getPotentialDamage, getReadyDamage, getEnemyTotalHp, getPartyTotalHp,
} = view;
const forState = (state: BattleState) => createBattleBindings({ ...LEGACY_CONTEXT, partyOrder: state.party.map(p => p.id) });
export const evaluateHand: typeof view.evaluateHand = state => forState(state).evaluateHand(state);
export const canActWith: typeof view.canActWith = (state, id) => forState(state).canActWith(state, id);
export type * from "../game-core/battle";
