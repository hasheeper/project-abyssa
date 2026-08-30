import { describe, expect, it } from "vitest";
import {
  applyBetAction,
  chooseLimitedRerollMask,
  choosePrivateLocks,
  choosePublicLocks,
  compareLumenPriority,
  compareHands,
  createInitialGame,
  createNextHand,
  getBetOptions,
  getBettingOpener,
  getFinalRerollLimit,
  getLumenPriorityScore,
  rankHand,
  startBetting
} from "./game";

describe("bluff dice hand ranking", () => {
  it.each([
    [[6, 5, 4, 2, 1], "high"],
    [[6, 6, 4, 2, 1], "pair"],
    [[6, 6, 4, 4, 1], "twoPair"],
    [[6, 6, 6, 2, 1], "threeKind"],
    [[1, 2, 3, 4, 4], "smallStraight"],
    [[1, 2, 3, 4, 6], "smallStraight"],
    [[5, 5, 5, 6, 6], "fullHouse"],
    [[4, 4, 4, 4, 2], "fourKind"],
    [[1, 2, 3, 4, 5], "largeStraight"],
    [[2, 3, 4, 5, 6], "largeStraight"],
    [[3, 3, 3, 3, 3], "yacht"]
  ] as const)("recognizes %j as %s", (dice, category) => {
    expect(rankHand([...dice]).category).toBe(category);
  });

  it("correctly lets a full house beat higher-valued three of a kind", () => {
    expect(compareHands([5, 5, 5, 6, 6], [6, 6, 6, 2, 1])).toBeGreaterThan(0);
  });

  it("uses poker-style kickers and treats higher straights as stronger", () => {
    expect(compareHands([6, 6, 4, 3, 2], [6, 6, 4, 3, 1])).toBeGreaterThan(0);
    expect(compareHands([2, 3, 4, 5, 5], [1, 2, 3, 4, 6])).toBeGreaterThan(0);
    expect(compareHands([2, 3, 4, 5, 6], [1, 2, 3, 4, 5])).toBeGreaterThan(0);
  });

  it("uses the configured small-to-large straight hierarchy", () => {
    expect(compareHands([1, 2, 3, 4, 4], [6, 6, 6, 2, 1])).toBeGreaterThan(0);
    expect(compareHands([5, 5, 5, 6, 6], [1, 2, 3, 4, 4])).toBeGreaterThan(0);
    expect(compareHands([4, 4, 4, 4, 2], [5, 5, 5, 6, 6])).toBeGreaterThan(0);
    expect(compareHands([1, 2, 3, 4, 5], [4, 4, 4, 4, 6])).toBeGreaterThan(0);
    expect(compareHands([3, 3, 3, 3, 3], [2, 3, 4, 5, 6])).toBeGreaterThan(0);
  });

  it("keeps the four-die run while drawing from a small straight", () => {
    expect(choosePublicLocks([1, 2, 3, 4, 6])).toEqual([true, true, true, true, false]);
    expect(choosePrivateLocks([1, 2, 3, 4, 6], [false, false, false, false, false])).toEqual([true, true, true, true, false]);
  });
});

describe("fixed-stake betting", () => {
  it("ends a street after two checks", () => {
    const game = createInitialGame();
    startBetting(game, 1);
    const first = game.betting!.actor;
    expect(applyBetAction(game, first, "check").streetComplete).toBe(false);
    expect(applyBetAction(game, game.betting!.actor, "check").streetComplete).toBe(true);
  });

  it("moves chips into the pot and ends after a call", () => {
    const game = createInitialGame();
    startBetting(game, 1);
    const opener = game.betting!.actor;
    const openingOptions = getBetOptions(game, opener);
    applyBetAction(game, opener, "raise-small");
    const caller = game.betting!.actor;
    const call = getBetOptions(game, caller);
    expect(call.toCall).toBe(openingOptions.smallIncrement);
    expect(applyBetAction(game, caller, "call").streetComplete).toBe(true);
    expect(game.pot).toBe(30 + openingOptions.smallIncrement * 2);
  });

  it("rotates the dealer and posts asymmetric antes for the next hand", () => {
    const first = createInitialGame();
    const next = createNextHand(first);
    expect(next.dealer).toBe("player");
    expect(next.pot).toBe(30);
    expect(next.contribution).toEqual({ player: 10, opponent: 20 });
  });
});

describe("lumen rules", () => {
  it.each([
    [0, 0],
    [1, 4],
    [2, 3],
    [3, 2],
    [4, 1],
    [5, 0]
  ])("gives %i public locks one full final reroll of %i dark dice", (publicCount, expectedLimit) => {
    const side = {
      publicLocked: Array.from({ length: 5 }, (_, index) => index < publicCount),
      privateLocked: [false, false, false, false, false]
    };
    expect(getFinalRerollLimit(side)).toBe(expectedLimit);
  });

  it("uses the number of public locks to resolve Lumen Priority", () => {
    const player = { publicLocked: [true, true, true, false, false] };
    const opponent = { publicLocked: [true, true, false, false, false] };
    expect(getLumenPriorityScore(player)).toBe(3);
    expect(getLumenPriorityScore(opponent)).toBe(2);
    expect(compareLumenPriority(player, opponent)).toBeGreaterThan(0);
  });

  it("gives the final betting response position to the side with more public locks", () => {
    const game = createInitialGame();
    game.player.publicLocked = [true, false, false, false, false];
    game.opponent.publicLocked = [true, true, true, false, false];
    expect(getBettingOpener(game, 2)).toBe("player");

    game.player.publicLocked = [true, true, true, true, false];
    game.opponent.publicLocked = [true, false, false, false, false];
    expect(getBettingOpener(game, 2)).toBe("opponent");

    game.player.publicLocked = [true, true, false, false, false];
    game.opponent.publicLocked = [true, true, false, false, false];
    expect(getBettingOpener(game, 2)).toBe("player");
  });

  it("limits the opponent reroll mask to the available first reroll", () => {
    const mask = chooseLimitedRerollMask([6, 2, 5, 1, 4], [false, true, false, true, true], 2);
    expect(mask).toEqual([false, true, false, true, false]);
  });
});
