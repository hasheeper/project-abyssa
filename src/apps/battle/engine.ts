/**
 * Stable Battle compatibility facade.
 *
 * Existing UI and tests keep importing this path while implementation modules migrate.
 */
export * from "./domain/invariants";
export type * from "./domain/state";
export type * from "./domain/effects";
export * from "./domain/versions";
export * from "./content/balance";
export * from "./content/characters";
export * from "./rules/dispatcher";
export * from "./rules/dice";
export * from "./rules/economy";
export * from "./rules/hand";
export * from "./rules/lifecycle";
export * from "./rules/loadout";
export * from "./rules/effect-runtime";
export * from "./rules/action-effects";
export * from "./rules/frenzy-status";
export * from "./content/effect-definitions";
export * from "./rules/modifiers";
export * from "./rules/reactions";
export * from "./rules/resolver";
export * from "./selectors";
export { performUndo } from "./rules/undo";
export {
  createExpeditionState,
  createExpeditionStateFromInput,
  createExpeditionTransition,
  goDeeperTransition,
  startLayerTransition
} from "./rules/expedition";
export {
  getLayerSettlement,
  leaveExpeditionTransition,
  settleEnemyTurnTransition
} from "./rules/settlement";
export {
  performInitialRoll,
  performReroll,
  performToggleLoad
} from "./rules/dice-actions";
export {
  resolveEnemyIntentTransition,
  resolveEnemyTurnStep
} from "./rules/enemy-intents";
export {
  activateScheduledFrenzyForNextRoundTransition,
  applyFrenzyRecoilTransition,
  beginNextRoundTransition,
  completeNextRoundAfterFrenzyTransition,
  prepareEnemyTurn,
  prepareEnemyTurnTransition
} from "./rules/turns";
export * from "./persistence";
export {
  actOnEnemy,
  actOnMember,
  attackEnemy,
  blockIntent,
  createExpedition,
  createExpeditionFromSeed,
  endTurn,
  finishEnemyTurn,
  goDeeper,
  healMember,
  leaveExpedition,
  nextRound,
  rerollDice,
  rollDice,
  stealFrom,
  toggleLoad,
  undo
} from "./rules/compatibility";
