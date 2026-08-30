import { describe, expect, it } from "vitest";
import type { ExpeditionState } from "../domain/state";
import { mulberry32 } from "../persistence/rng";
import {
  getBattlePhase,
  getExpeditionStatus,
  getRoundOutcome
} from "../selectors/battle-selectors";
import { actScenario } from "../testing/scenario";
import {
  createExpeditionState,
  goDeeperTransition
} from "./expedition";
import {
  leaveExpeditionTransition,
  settleEnemyTurnTransition
} from "./settlement";
import { prepareEnemyTurnTransition } from "./turns";

function enemyTurnState(seed: number): ExpeditionState {
  const prepared = prepareEnemyTurnTransition(actScenario(seed).build());
  if (prepared.error) throw new Error("Could not prepare settlement fixture");
  return prepared.state;
}

describe("native settlement and layers", () => {
  it("creates the opening layer deterministically", () => {
    const first = createExpeditionState(mulberry32(671));
    const second = createExpeditionState(mulberry32(671));
    expect(first).toEqual(second);
    expect(first).toMatchObject({
      layer: 1,
      round: 1,
      mode: { type: "awaiting-roll" }
    });
    expect(getBattlePhase(first)).toBe("roll");
    expect(getExpeditionStatus(first)).toBe("active");
    expect(first.enemies.length).toBeGreaterThan(0);
  });

  it("settles continue, wipe and clear outcomes", () => {
    const continuing = enemyTurnState(673);
    const nativeContinue = settleEnemyTurnTransition(
      continuing,
      mulberry32(675),
      null
    );
    expect(nativeContinue.error).toBeNull();
    expect(getRoundOutcome(nativeContinue.state)).toBe("continue");
    expect(nativeContinue.events.some((event) => event.type === "round-resolved"))
      .toBe(true);

    const wiped = enemyTurnState(677);
    wiped.party.forEach((member) => {
      member.hp = 0;
      member.downed = true;
    });
    wiped.gold = 70;
    wiped.bagGold = 90;
    const nativeWipe = settleEnemyTurnTransition(wiped, mulberry32(679), null);
    expect(getExpeditionStatus(nativeWipe.state)).toBe("finished");
    expect(getRoundOutcome(nativeWipe.state)).toBe("wipe");
    expect(nativeWipe.state.result?.wiped).toBe(true);
    expect(nativeWipe.events.some((event) => event.type === "expedition-finished"))
      .toBe(true);

    const cleared = enemyTurnState(681);
    cleared.enemies.forEach((enemy) => {
      enemy.hp = 0;
      enemy.intent = null;
    });
    cleared.gold = 40;
    cleared.handMultiplier = 0.5;
    const nativeClear = settleEnemyTurnTransition(cleared, mulberry32(683), null);
    expect(getExpeditionStatus(nativeClear.state)).toBe("greed");
    expect(getRoundOutcome(nativeClear.state)).toBe("layer-cleared");
    expect(nativeClear.state.lastLayerSettlement?.bagAfter).toBeGreaterThan(0);
    expect(
      nativeClear.events.find((event) => event.type === "layer-cleared")?.payload.settlement
    ).toEqual(nativeClear.state.lastLayerSettlement);
  });

  it("matches deeper-layer setup, including recovery and intent RNG", () => {
    const greed = enemyTurnState(685);
    greed.enemies.forEach((enemy) => {
      enemy.hp = 0;
      enemy.intent = null;
    });
    const settledTransition = settleEnemyTurnTransition(greed, mulberry32(687), null);
    expect(settledTransition.error).toBeNull();
    const settled = settledTransition.state;
    const member = settled.party[1]!;
    member.hp = 0;
    member.downed = true;
    member.rustLevel = 2;

    const native = goDeeperTransition(settled, mulberry32(689));
    expect(native.error).toBeNull();
    expect(native.state.layer).toBe(settled.layer + 1);
    expect(native.state.party[1]).toMatchObject({ hp: 1, downed: false, rustLevel: 2 });
    expect(native.events.some((event) => event.type === "unit-revived")).toBe(true);
    expect(native.events.some((event) => event.type === "layer-started")).toBe(true);
  });

  it("matches voluntary exit and crystal determination", () => {
    const greed = enemyTurnState(691);
    greed.enemies.forEach((enemy) => {
      enemy.hp = 0;
      enemy.intent = null;
    });
    const settledTransition = settleEnemyTurnTransition(greed, mulberry32(693), null);
    expect(settledTransition.error).toBeNull();
    const settled = settledTransition.state;
    settled.deepestLayer = 3;

    const native = leaveExpeditionTransition(settled, () => 0);
    expect(native.error).toBeNull();
    expect(getExpeditionStatus(native.state)).toBe("finished");
    expect(native.state.result?.crystal).toBe(true);
    expect(native.events.some((event) => event.type === "expedition-finished")).toBe(true);
  });
});
