import { describe, expect, expectTypeOf, it } from "vitest";
import * as facade from "./engine";
import * as implementation from "../../game-runtime/legacy-battle";
import frozen from "../../game-core/battle/testing/fixtures/s1-extraction.json";
import { createBattleBindings } from "../../game-core/battle/bindings";
import { LEGACY_CONTEXT } from "../../game-runtime/legacy-context";
import type { ExpeditionState as DomainState } from "../../game-core/battle/domain/state";

describe("Battle compatibility boundaries", () => {
  it("preserves all historical runtime exports through the page facade", () => {
    expect(Object.keys(facade).sort()).toEqual(frozen.exports);
    expectTypeOf<typeof facade>().toEqualTypeOf<typeof implementation>();
    for (const name of Object.keys(facade) as Array<keyof typeof facade>) expect(facade[name]).toBe(implementation[name]);
  });
  it("binds the same rules implementation to explicit content", () => {
    const bound = createBattleBindings(LEGACY_CONTEXT);
    const state = bound.createExpeditionFromSeed(19);
    expect(bound.dispatchBattleCommand(state, {type:"roll-dice"})).toEqual(facade.dispatchBattleCommand(state, {type:"roll-dice"}));
    expect(bound.evaluateHand(state)).toEqual(facade.evaluateHand(state));
  });
  it("retains frozen versions and content through the compatibility binding", () => {
    expect([facade.BATTLE_SCHEMA_VERSION,facade.BATTLE_RULES_VERSION,facade.BATTLE_CONTENT_VERSION]).toEqual([4,1,1]);
    expect(facade.CHARACTERS).toBe(LEGACY_CONTEXT.catalog.characters);
    expect(facade.PARTY_ORDER).toBe(LEGACY_CONTEXT.partyOrder);
  });
  it("shares the mechanical state contract without a duplicate implementation", () => {
    expectTypeOf<facade.ExpeditionState>().toEqualTypeOf<DomainState>();
    expect(facade.collectExpeditionInvariantViolations(facade.createExpeditionFromSeed(42))).toEqual([]);
  });
});
