import {
  getBetOptions,
  getFinalRerollLimit,
  rankHand,
} from "./game";
import type { GameState } from "./game";

export const DICE_PHASE_LABELS: Record<GameState["phase"], string> = {
  "initial-roll": "起蛊",
  "betting-one": "初押",
  "public-lock": "明蛊",
  "forced-reroll": "暗转",
  "private-lock": "暗蛊",
  "final-reroll": "定蛊",
  "betting-two": "终押",
  showdown: "揭蛊",
  settled: "定局",
};

export function deriveDiceViewModel(game: GameState) {
  const bettingOptions = getBetOptions(game, "player");
  const playerRank = rankHand(game.player.dice);
  const opponentRank = rankHand(game.opponent.dice);
  const publicCount = game.player.publicLocked.filter(Boolean).length;
  const opponentPublicCount =
    game.opponent.publicLocked.filter(Boolean).length;
  const totalPrivateLocks =
    publicCount + game.player.privateLocked.filter(Boolean).length;
  const playerRerollCount = Math.max(0, 5 - totalPrivateLocks);
  const playerRerollLimit = getFinalRerollLimit(game.player);
  const playerCanSelectDice =
    !game.busy &&
    (game.phase === "public-lock" || game.phase === "private-lock");
  const actingOptions = game.betting
    ? getBetOptions(game, game.betting.actor)
    : null;
  const actionText = game.betting
    ? game.betting.actor === "player"
      ? actingOptions!.toCall > 0
        ? "需跟注 " + actingOptions!.toCall
        : "可以过牌"
      : "对手思考中"
    : game.phase === "public-lock"
      ? "选择公开骰子"
      : game.phase === "private-lock"
        ? "最后一次调整"
        : game.phase === "showdown"
          ? "骰面公示中 · 5 秒后定局"
          : game.phase === "settled"
            ? "底池已结算"
            : "骰局进行中";
  const playerState = game.showdownRevealed
    ? "SHOWDOWN"
    : game.phase === "public-lock"
      ? "SELECT PUBLIC LOCK"
      : game.phase === "private-lock"
        ? "SELECT PRIVATE LOCK"
        : game.turn === "player"
          ? "YOUR ACTION"
          : "WAITING";
  const opponentState = game.showdownRevealed
    ? "SHOWDOWN"
    : opponentPublicCount > 0
      ? opponentPublicCount + " PUBLIC"
      : "HAND HIDDEN";
  const playerActionActive =
    ((game.phase === "betting-one" || game.phase === "betting-two") &&
      game.betting?.actor === "player") ||
    game.phase === "public-lock" ||
    game.phase === "private-lock";

  return {
    bettingOptions,
    playerRank,
    opponentRank,
    publicCount,
    totalPrivateLocks,
    playerRerollCount,
    playerRerollLimit,
    playerCanSelectDice,
    actionText,
    playerState,
    opponentState,
    playerActionActive,
  };
}
