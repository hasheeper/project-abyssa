import { describe, expect, expectTypeOf, it } from "vitest";
import * as facade from "./engine";
import { CHARACTERS, PARTY_ORDER } from "./content/characters";
import {
  BATTLE_CONTENT_VERSION,
  BATTLE_RULES_VERSION,
  BATTLE_SCHEMA_VERSION
} from "./domain/versions";
import type { ExpeditionState as DomainExpeditionState } from "./domain/state";
import {
  getEffectiveFaceQuality,
  getFace,
  getFaceValue,
  getGildFaceCount,
  getRustFaceCount
} from "./rules/dice";
import { getLayerPayout } from "./rules/economy";
import { evaluateHand, HAND_BONUSES, rankHand } from "./rules/hand";
import {
  assessStalling,
  canUndo,
  getEnemyTotalHp,
  getPartyTotalHp,
  getPotentialDamage,
  getReadyDamage,
  getTotalThreat,
  getUndoLabel,
  hasPendingAction,
  hasUnloadedDice
} from "./selectors/battle-selectors";
import {
  getFrenzyWarningRounds,
  getGreedSummary
} from "./selectors/presentation-selectors";
import {
  canActWith,
  canToggleLoad,
  getBlocked,
  getIncomingDamageFor,
  getIntentThreat
} from "./selectors/targeting-selectors";
import type { ExpeditionState as FacadeExpeditionState } from "./engine";
import * as domainInvariants from "./domain/invariants";

describe("Battle module boundaries", () => {
  it("keeps the engine facade wired to the extracted implementations", () => {
    const pairs: ReadonlyArray<readonly [unknown, unknown]> = [
      [facade.getEffectiveFaceQuality, getEffectiveFaceQuality],
      [facade.getFace, getFace],
      [facade.getFaceValue, getFaceValue],
      [facade.getGildFaceCount, getGildFaceCount],
      [facade.getRustFaceCount, getRustFaceCount],
      [facade.getLayerPayout, getLayerPayout],
      [facade.evaluateHand, evaluateHand],
      [facade.rankHand, rankHand],
      [facade.assessStalling, assessStalling],
      [facade.canUndo, canUndo],
      [facade.getEnemyTotalHp, getEnemyTotalHp],
      [facade.getPartyTotalHp, getPartyTotalHp],
      [facade.getPotentialDamage, getPotentialDamage],
      [facade.getReadyDamage, getReadyDamage],
      [facade.getTotalThreat, getTotalThreat],
      [facade.getUndoLabel, getUndoLabel],
      [facade.hasPendingAction, hasPendingAction],
      [facade.hasUnloadedDice, hasUnloadedDice],
      [facade.getFrenzyWarningRounds, getFrenzyWarningRounds],
      [facade.getGreedSummary, getGreedSummary],
      [facade.canActWith, canActWith],
      [facade.canToggleLoad, canToggleLoad],
      [facade.getBlocked, getBlocked],
      [facade.getIncomingDamageFor, getIncomingDamageFor],
      [facade.getIntentThreat, getIntentThreat]
    ];

    for (const [fromFacade, direct] of pairs) expect(fromFacade).toBe(direct);
    expect(facade.HAND_BONUSES).toBe(HAND_BONUSES);
  });

  it("keeps content and version exports compatible", () => {
    expect(facade.CHARACTERS).toBe(CHARACTERS);
    expect(facade.PARTY_ORDER).toBe(PARTY_ORDER);
    expect(facade.BATTLE_SCHEMA_VERSION).toBe(BATTLE_SCHEMA_VERSION);
    expect(facade.BATTLE_RULES_VERSION).toBe(BATTLE_RULES_VERSION);
    expect(facade.BATTLE_CONTENT_VERSION).toBe(BATTLE_CONTENT_VERSION);
  });

  it("keeps facade types and invariants wired to the domain", () => {
    expectTypeOf<FacadeExpeditionState>().toEqualTypeOf<DomainExpeditionState>();
    expect(facade.collectExpeditionInvariantViolations).toBe(
      domainInvariants.collectExpeditionInvariantViolations
    );
    expect(facade.assertExpeditionInvariants).toBe(
      domainInvariants.assertExpeditionInvariants
    );
  });
});
