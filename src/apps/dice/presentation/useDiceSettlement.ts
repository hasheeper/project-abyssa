import { useCallback } from "react";
import {
  compareHands,
  compareLumenPriority,
  DIALOGUE,
  otherSide,
  rankHand,
} from "../game";
import type { GameState, MoodKey, Side } from "../game";

interface UseDiceSettlementOptions {
  commit: (change: (next: GameState) => void) => GameState;
  getCurrentGame: () => GameState;
  recordEvent: (event: string) => void;
  saveBattleRecord: (game: GameState) => void;
  wait: (duration: number) => Promise<boolean>;
  say: (source: readonly string[] | string, mood?: MoodKey) => void;
  showBanner: (title: string, subtitle: string) => void;
  openResult: () => void;
}

const SHOWDOWN_REVEAL_MS = 5000;

export function useDiceSettlement({
  commit,
  getCurrentGame,
  recordEvent,
  saveBattleRecord,
  wait,
  say,
  showBanner,
  openResult,
}: UseDiceSettlementOptions) {
  const settleFold = useCallback(
    async (folded: Side) => {
      const winner = otherSide(folded);
      commit((next) => {
        next.phase = "showdown";
        next.busy = true;
        next.folded = folded;
        next.winner = winner;
        next.lumenPriorityWinner = null;
        next.showdownRevealed = true;
        next.betting = null;
      });
      showBanner(
        folded === "player" ? "你已弃牌" : "缇比弃牌",
        "DICE REVEALED · 5 SEC",
      );
      say(
        folded === "player" ? DIALOGUE.playerFold : DIALOGUE.tibbyFold,
        folded === "player" ? "amused" : "calm",
      );
      if (!(await wait(SHOWDOWN_REVEAL_MS))) return;
      const settled = commit((next) => {
        const winnings = next.pot;
        next.phase = "settled";
        next.settledPot = winnings;
        next.bankroll[winner] += winnings;
        next.pot = 0;
      });
      recordEvent(
        (folded === "player" ? "玩家" : "缇比") +
          "弃牌，" +
          (winner === "player" ? "玩家" : "缇比") +
          "赢得" +
          settled.settledPot,
      );
      saveBattleRecord(settled);
      showBanner("定局", "POT " + settled.settledPot + " G");
      openResult();
    },
    [commit, openResult, recordEvent, saveBattleRecord, say, showBanner, wait],
  );

  const settleShowdown = useCallback(async () => {
    commit((next) => {
      next.phase = "showdown";
      next.busy = true;
      next.showdownRevealed = true;
      next.betting = null;
    });
    showBanner("揭蛊", "DICE REVEALED · 5 SEC");
    say(DIALOGUE.showdown, "serious");
    if (!(await wait(SHOWDOWN_REVEAL_MS))) return;
    const current = getCurrentGame();
    const comparison = compareHands(
      current.player.dice,
      current.opponent.dice,
    );
    const lumenComparison =
      comparison === 0
        ? compareLumenPriority(current.player, current.opponent)
        : 0;
    const lumenPriorityWinner: Side | null =
      comparison === 0 && lumenComparison !== 0
        ? lumenComparison > 0
          ? "player"
          : "opponent"
        : null;
    const winner: Side | "tie" =
      comparison > 0
        ? "player"
        : comparison < 0
          ? "opponent"
          : (lumenPriorityWinner ?? "tie");
    const settled = commit((next) => {
      const winnings = next.pot;
      next.phase = "settled";
      next.winner = winner;
      next.lumenPriorityWinner = lumenPriorityWinner;
      next.settledPot = winnings;
      if (winner === "tie") {
        const half = Math.floor(winnings / 2);
        next.bankroll.player += half;
        next.bankroll.opponent += winnings - half;
      } else {
        next.bankroll[winner] += winnings;
      }
      next.pot = 0;
    });
    recordEvent(
      "揭蛊：玩家" +
        settled.player.dice.join(",") +
        "，缇比" +
        settled.opponent.dice.join(",") +
        "，结果" +
        winner,
    );
    saveBattleRecord(settled);
    say(
      winner === "player"
        ? DIALOGUE.playerWin
        : winner === "opponent"
          ? DIALOGUE.opponentWin
          : DIALOGUE.draw,
      winner === "player"
        ? "surprised"
        : winner === "opponent"
          ? "amused"
          : "curious",
    );
    showBanner(
      winner === "tie"
        ? "平分底池"
        : winner === "player"
          ? "勇者胜出"
          : "缇比胜出",
      lumenPriorityWinner
        ? "LUMEN PRIORITY"
        : rankHand(settled.player.dice).english +
            " · " +
            rankHand(settled.opponent.dice).english,
    );
    openResult();
  }, [
    commit,
    getCurrentGame,
    openResult,
    recordEvent,
    saveBattleRecord,
    say,
    showBanner,
    wait,
  ]);

  return { settleFold, settleShowdown };
}
