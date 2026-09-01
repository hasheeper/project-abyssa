import type { GameState } from "./game";

export function buildDiceBattleRecord(
  game: GameState,
  events: readonly string[],
): string {
  return JSON.stringify(
    {
      version: "lumen-dice-battle-record-v1",
      handNumber: game.handNumber,
      dealer: game.dealer,
      winner: game.winner,
      folded: game.folded,
      pot: game.settledPot,
      player: {
        dice: game.player.dice,
        publicLocked: game.player.publicLocked,
        privateLocked: game.player.privateLocked,
        finalBankroll: game.bankroll.player,
      },
      opponent: {
        dice: game.opponent.dice,
        publicLocked: game.opponent.publicLocked,
        privateLocked: game.opponent.privateLocked,
        finalBankroll: game.bankroll.opponent,
      },
      events,
    },
    null,
    2,
  );
}
