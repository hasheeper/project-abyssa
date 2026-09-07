import type { BattleContext } from "../contracts";
import { BATTLE_CONTENT_VERSION as binding0 } from "./domain/versions";
import { BATTLE_RULES_VERSION as binding1 } from "./domain/versions";
import { BATTLE_SCHEMA_VERSION as binding2 } from "./domain/versions";
import { DEFAULT_EFFECT_DEPTH_LIMIT as binding3 } from "./rules/resolver";
import { DEFAULT_EFFECT_EVENT_BUDGET as binding4 } from "./rules/resolver";
import { FRENZY_WARNING_DURATION as binding6 } from "./rules/frenzy-status";
import { HAND_BONUSES as binding7 } from "./rules/hand";
import { actOnEnemy as binding8 } from "./rules/compatibility";
import { actOnMember as binding9 } from "./rules/compatibility";
import { activateScheduledFrenzyForNextRoundTransition as binding10 } from "./rules/turns";
import { advanceRngStream as binding11 } from "./persistence/rng";
import { advanceStatusDurations as binding12 } from "./rules/lifecycle";
import { applyFrenzyRecoilTransition as binding13 } from "./rules/turns";
import { applyNumericModifiers as binding14 } from "./rules/modifiers";
import { assertExpeditionInvariants as binding15 } from "./domain/invariants";
import { assessStalling as binding16 } from "./selectors/battle-selectors";
import { attackEnemy as binding17 } from "./rules/compatibility";
import { beginNextRoundTransition as binding18 } from "./rules/turns";
import { blockIntent as binding19 } from "./rules/compatibility";
import { buildActionEffectContribution as binding20 } from "./rules/action-effects";
import { canActWith as binding21 } from "./selectors/targeting-selectors";
import { canToggleLoad as binding22 } from "./selectors/targeting-selectors";
import { canUndo as binding23 } from "./selectors/battle-selectors";
import { cloneBattleLoadout as binding24 } from "./rules/loadout";
import { cloneBattleState as binding25 } from "./persistence/clone";
import { collectEventReactions as binding26 } from "./rules/reactions";
import { collectExpeditionInvariantViolations as binding27 } from "./domain/invariants";
import { compareOrderedSources as binding28 } from "./rules/modifiers";
import { compareReactionBindings as binding29 } from "./rules/reactions";
import { compileEffectRuntime as binding30 } from "./rules/effect-runtime";
import { completeNextRoundAfterFrenzyTransition as binding31 } from "./rules/turns";
import { createBattleCompletionOutput as binding32 } from "./rules/loadout";
import { createBattleLoadoutSettlement as binding33 } from "./rules/loadout";
import { createBattleRngState as binding34 } from "./persistence/rng";
import { createBattleSaveDto as binding35 } from "./persistence/dto";
import { createEmptyBattleLoadout as binding36 } from "./rules/loadout";
import { createExpedition as binding37 } from "./rules/compatibility";
import { createExpeditionFromSeed as binding38 } from "./rules/compatibility";
import { createExpeditionState as binding39 } from "./rules/expedition";
import { createExpeditionStateFromInput as binding40 } from "./rules/expedition";
import { createExpeditionTransition as binding41 } from "./rules/expedition";
import { createRngCursor as binding42 } from "./persistence/rng";
import { deserializeBattleState as binding43 } from "./persistence/migrate";
import { dispatchBattleCommand as binding44 } from "./rules/dispatcher";
import { drawRngValue as binding45 } from "./persistence/rng";
import { endTurn as binding46 } from "./rules/compatibility";
import { evaluateHand as binding47 } from "./rules/hand";
import { finishEnemyTurn as binding48 } from "./rules/compatibility";
import { getBattlePhase as binding49 } from "./selectors/battle-selectors";
import { getBlocked as binding50 } from "./selectors/targeting-selectors";
import { getEffectiveFaceQuality as binding51 } from "./rules/dice";
import { getEnemyFrenzyActiveStatus as binding52 } from "./rules/frenzy-status";
import { getEnemyFrenzyWarningStatus as binding53 } from "./rules/frenzy-status";
import { getEnemyTotalHp as binding54 } from "./selectors/battle-selectors";
import { getExpeditionStatus as binding55 } from "./selectors/battle-selectors";
import { getFace as binding56 } from "./rules/dice";
import { getFaceValue as binding57 } from "./rules/dice";
import { getFrenzyWarningRounds as binding58 } from "./selectors/presentation-selectors";
import { getGildFaceCount as binding59 } from "./rules/dice";
import { getGreedSummary as binding60 } from "./selectors/presentation-selectors";
import { getIncomingDamageFor as binding61 } from "./selectors/targeting-selectors";
import { getIntentThreat as binding62 } from "./selectors/targeting-selectors";
import { getLayerPayout as binding63 } from "./rules/economy";
import { getLayerSettlement as binding64 } from "./rules/settlement";
import { getPartyTotalHp as binding65 } from "./selectors/battle-selectors";
import { getPotentialDamage as binding66 } from "./selectors/battle-selectors";
import { getReadyDamage as binding67 } from "./selectors/battle-selectors";
import { getRoundOutcome as binding68 } from "./selectors/battle-selectors";
import { getRustFaceCount as binding69 } from "./rules/dice";
import { getRustableFaceCapacity as binding70 } from "./rules/dice";
import { getStateFace as binding71 } from "./rules/dice";
import { getTotalThreat as binding72 } from "./selectors/battle-selectors";
import { getTrackedRngSnapshot as binding73 } from "./persistence/rng";
import { getUndoLabel as binding74 } from "./selectors/battle-selectors";
import { goDeeper as binding75 } from "./rules/compatibility";
import { goDeeperTransition as binding76 } from "./rules/expedition";
import { hasEnemyFrenzyWarning as binding77 } from "./rules/frenzy-status";
import { hasPendingAction as binding78 } from "./selectors/battle-selectors";
import { hasUnloadedDice as binding79 } from "./selectors/battle-selectors";
import { healMember as binding80 } from "./rules/compatibility";
import { isDieDowned as binding81 } from "./selectors/battle-selectors";
import { isEnemyDefeated as binding82 } from "./selectors/battle-selectors";
import { isEnemyFrenzied as binding83 } from "./rules/frenzy-status";
import { leaveExpedition as binding84 } from "./rules/compatibility";
import { leaveExpeditionTransition as binding85 } from "./rules/settlement";
import { mergeEffectResolutionOptions as binding86 } from "./rules/effect-runtime";
import { migrateBattleSaveDto as binding87 } from "./persistence/migrate";
import { mulberry32 as binding88 } from "./persistence/rng";
import { nextRound as binding89 } from "./rules/compatibility";
import { performInitialRoll as binding90 } from "./rules/dice-actions";
import { performReroll as binding91 } from "./rules/dice-actions";
import { performToggleLoad as binding92 } from "./rules/dice-actions";
import { performUndo as binding93 } from "./rules/undo";
import { prepareEnemyTurn as binding94 } from "./rules/turns";
import { prepareEnemyTurnTransition as binding95 } from "./rules/turns";
import { rankHand as binding96 } from "./rules/hand";
import { rerollDice as binding97 } from "./rules/compatibility";
import { resolveAtomicEffects as binding98 } from "./rules/resolver";
import { resolveEffectsCommand as binding99 } from "./rules/resolver";
import { resolveEnemyIntentTransition as binding100 } from "./rules/enemy-intents";
import { resolveEnemyTurnStep as binding101 } from "./rules/enemy-intents";
import { rollDice as binding102 } from "./rules/compatibility";
import { serializeBattleState as binding103 } from "./persistence/dto";
import { settleEnemyTurnTransition as binding104 } from "./rules/settlement";
import { startLayerTransition as binding105 } from "./rules/expedition";
import { stealFrom as binding106 } from "./rules/compatibility";
import { targetRefKey as binding107 } from "./rules/resolver/targets";
import { toggleLoad as binding108 } from "./rules/compatibility";
import { undo as binding109 } from "./rules/compatibility";

/** Bind the historical API to explicit content, without keeping a second rules implementation. */
export function createBattleBindings(context: BattleContext) {
  return {
    ACTION_EFFECT_DEFINITIONS: context.catalog.actionEffects,
    BATTLE_CONTENT_VERSION: binding0,
    BATTLE_EFFECT_DEFINITIONS: context.catalog.effects,
    BATTLE_REACTION_REGISTRY: {},
    BATTLE_RULES_VERSION: binding1,
    BATTLE_SCHEMA_VERSION: binding2,
    CHARACTERS: context.catalog.characters,
    DEFAULT_EFFECT_DEPTH_LIMIT: binding3,
    DEFAULT_EFFECT_EVENT_BUDGET: binding4,
    DOWNED_RETURN_HP: context.catalog.balance.DOWNED_RETURN_HP,
    FRENZY_ACTIVE_STATUS_ID: context.catalog.frenzyActiveId,
    FRENZY_ATTACK_BONUS: context.catalog.balance.FRENZY_ATTACK_BONUS,
    FRENZY_WARNING_DURATION: binding6,
    FRENZY_WARNING_STATUS_ID: context.catalog.frenzyWarningId,
    HAND_BONUSES: binding7,
    LAYER_MULTIPLIERS: context.catalog.balance.LAYER_MULTIPLIERS,
    MAX_HP: context.catalog.balance.MAX_HP,
    MAX_LAYER: context.catalog.balance.MAX_LAYER,
    PARTY_ORDER: context.partyOrder,
    REROLLS_PER_ROUND: context.catalog.balance.REROLLS_PER_ROUND,
    STALL_GRACE_ROUNDS: context.catalog.balance.STALL_GRACE_ROUNDS,
    actOnEnemy: binding8.bind(null, context),
    actOnMember: binding9.bind(null, context),
    activateScheduledFrenzyForNextRoundTransition: binding10.bind(null, context),
    advanceRngStream: binding11,
    advanceStatusDurations: binding12.bind(null, context),
    applyFrenzyRecoilTransition: binding13.bind(null, context),
    applyNumericModifiers: binding14,
    assertExpeditionInvariants: binding15.bind(null, context),
    assessStalling: binding16.bind(null, context),
    attackEnemy: binding17.bind(null, context),
    beginNextRoundTransition: binding18.bind(null, context),
    blockIntent: binding19.bind(null, context),
    buildActionEffectContribution: binding20.bind(null, context),
    canActWith: binding21.bind(null, context),
    canToggleLoad: binding22,
    canUndo: binding23,
    cloneBattleLoadout: binding24,
    cloneBattleState: binding25,
    collectEventReactions: binding26,
    collectExpeditionInvariantViolations: binding27.bind(null, context),
    compareOrderedSources: binding28,
    compareReactionBindings: binding29,
    compileEffectRuntime: binding30.bind(null, context),
    completeNextRoundAfterFrenzyTransition: binding31.bind(null, context),
    createBattleCompletionOutput: binding32,
    createBattleLoadoutSettlement: binding33,
    createBattleRngState: binding34,
    createBattleSaveDto: binding35,
    createEmptyBattleLoadout: binding36,
    createExpedition: binding37.bind(null, context),
    createExpeditionFromSeed: binding38.bind(null, context),
    createExpeditionState: binding39.bind(null, context),
    createExpeditionStateFromInput: binding40.bind(null, context),
    createExpeditionTransition: binding41.bind(null, context),
    createRngCursor: binding42,
    deserializeBattleState: binding43.bind(null, context),
    dispatchBattleCommand: binding44.bind(null, context),
    drawRngValue: binding45,
    endTurn: binding46.bind(null, context),
    evaluateHand: binding47.bind(null, context),
    finishEnemyTurn: binding48.bind(null, context),
    getBattlePhase: binding49,
    getBlocked: binding50,
    getEffectiveFaceQuality: binding51.bind(null, context),
    getEnemyFrenzyActiveStatus: binding52.bind(null, context),
    getEnemyFrenzyWarningStatus: binding53.bind(null, context),
    getEnemyTotalHp: binding54,
    getExpeditionStatus: binding55,
    getFace: binding56.bind(null, context),
    getFaceValue: binding57.bind(null, context),
    getFrenzyWarningRounds: binding58.bind(null, context),
    getGildFaceCount: binding59.bind(null, context),
    getGreedSummary: binding60.bind(null, context),
    getIncomingDamageFor: binding61,
    getIntentThreat: binding62,
    getLayerPayout: binding63.bind(null, context),
    getLayerSettlement: binding64.bind(null, context),
    getPartyTotalHp: binding65,
    getPotentialDamage: binding66.bind(null, context),
    getReadyDamage: binding67.bind(null, context),
    getRoundOutcome: binding68,
    getRustFaceCount: binding69.bind(null, context),
    getRustableFaceCapacity: binding70.bind(null, context),
    getStateFace: binding71.bind(null, context),
    getTotalThreat: binding72,
    getTrackedRngSnapshot: binding73,
    getUndoLabel: binding74,
    goDeeper: binding75.bind(null, context),
    goDeeperTransition: binding76.bind(null, context),
    hasEnemyFrenzyWarning: binding77.bind(null, context),
    hasPendingAction: binding78.bind(null, context),
    hasUnloadedDice: binding79,
    healMember: binding80.bind(null, context),
    isDieDowned: binding81,
    isEnemyDefeated: binding82,
    isEnemyFrenzied: binding83.bind(null, context),
    leaveExpedition: binding84.bind(null, context),
    leaveExpeditionTransition: binding85.bind(null, context),
    mergeEffectResolutionOptions: binding86.bind(null, context),
    migrateBattleSaveDto: binding87.bind(null, context),
    mulberry32: binding88,
    nextRound: binding89.bind(null, context),
    performInitialRoll: binding90.bind(null, context),
    performReroll: binding91.bind(null, context),
    performToggleLoad: binding92.bind(null, context),
    performUndo: binding93,
    prepareEnemyTurn: binding94.bind(null, context),
    prepareEnemyTurnTransition: binding95.bind(null, context),
    rankHand: binding96,
    rerollDice: binding97.bind(null, context),
    resolveAtomicEffects: binding98.bind(null, context),
    resolveEffectsCommand: binding99.bind(null, context),
    resolveEnemyIntentTransition: binding100.bind(null, context),
    resolveEnemyTurnStep: binding101.bind(null, context),
    rollDice: binding102.bind(null, context),
    serializeBattleState: binding103,
    settleEnemyTurnTransition: binding104.bind(null, context),
    startLayerTransition: binding105.bind(null, context),
    stealFrom: binding106.bind(null, context),
    targetRefKey: binding107,
    toggleLoad: binding108.bind(null, context),
    undo: binding109.bind(null, context)
  };
}
