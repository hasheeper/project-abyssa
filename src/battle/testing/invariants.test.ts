import { describe, expect, it } from "vitest";
import { endTurn, mulberry32, nextRound, type ExpeditionState } from "../engine";
import { actScenario } from "./scenario";
import {
  assertExpeditionInvariants,
  collectExpeditionInvariantViolations
} from "../domain/invariants";

function codes(state: ExpeditionState) {
  return collectExpeditionInvariantViolations(state).map((violation) => violation.code);
}

describe("Expedition state invariants", () => {
  it("accepts real states across the current round lifecycle", () => {
    const rng = mulberry32(41);
    const active = actScenario(41).build();
    assertExpeditionInvariants(active);

    const ended = endTurn(active, rng);
    assertExpeditionInvariants(ended.state);
    if (ended.outcome === "continue") {
      assertExpeditionInvariants(nextRound(ended.state, rng));
    }
  });

  it("reports duplicate ownership and stale die mirrors", () => {
    const broken = actScenario(43)
      .patch((state) => {
        state.dice[1]!.ownerId = state.dice[0]!.ownerId;
        Object.assign(state.dice[0]!, { downed: true });
        state.party[0]!.hp = 0;
      })
      .build();

    expect(codes(broken)).toEqual(
      expect.arrayContaining([
        "dice.duplicate-owner",
        "dice.order",
        "party.downed-hp",
        "dice.duplicate-owner-state"
      ])
    );
    expect(() => assertExpeditionInvariants(broken)).toThrow(
      "Expedition invariant violations"
    );
  });

  it("reports defeated intents, invalid resources and stale lifecycle mirrors", () => {
    const broken = actScenario(47)
      .patch((state) => {
        state.enemies[0]!.hp = 0;
        state.gold = -1;
        Object.assign(state, { status: "greed", phase: "act" });
      })
      .build();

    expect(codes(broken)).toEqual(
      expect.arrayContaining([
        "enemy.defeated-intent",
        "run.resource-range",
        "run.duplicate-lifecycle-state"
      ])
    );
  });
});
