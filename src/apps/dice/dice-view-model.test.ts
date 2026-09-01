import { describe, expect, it } from "vitest";
import { cloneGame, createInitialGame } from "./game";
import {
  DICE_PHASE_LABELS,
  deriveDiceViewModel,
} from "./dice-view-model";

describe("dice view model", () => {
  it("describes the opening hand without exposing selectable dice", () => {
    const game = createInitialGame();
    const view = deriveDiceViewModel(game);

    expect(DICE_PHASE_LABELS[game.phase]).toBe("起蛊");
    expect(view.actionText).toBe("骰局进行中");
    expect(view.playerCanSelectDice).toBe(false);
    expect(view.opponentState).toBe("HAND HIDDEN");
  });

  it("derives public and private lock controls from the current hand", () => {
    const game = cloneGame(createInitialGame());
    game.phase = "private-lock";
    game.busy = false;
    game.player.publicLocked = [true, false, false, false, false];
    game.player.privateLocked = [false, true, false, false, false];

    const view = deriveDiceViewModel(game);

    expect(view.playerCanSelectDice).toBe(true);
    expect(view.totalPrivateLocks).toBe(2);
    expect(view.playerRerollCount).toBe(3);
    expect(view.playerState).toBe("SELECT PRIVATE LOCK");
  });
});
