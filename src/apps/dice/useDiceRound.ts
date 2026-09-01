import { useCallback, useEffect, useRef, useState } from "react";
import {
  applyBetAction,
  chooseLimitedRerollMask,
  choosePrivateLocks,
  choosePublicLocks,
  cloneGame,
  createInitialGame,
  createNextHand,
  DIALOGUE,
  getFinalRerollLimit,
  nextRotation,
  randomDie,
  rankHand,
  startBetting,
} from "./game";
import type {
  BetAction,
  BetResolution,
  GameState,
  MoodKey,
  Side,
} from "./game";
import { randomRollDuration } from "../../shared/presentation/roll/timing";
import { buildDiceBattleRecord } from "./dice-battle-record";
import { useDiceSettlement } from "./presentation/useDiceSettlement";
import { useDiceRoundScheduler } from "./runtime/useDiceRoundScheduler";
import { useDiceOpponent } from "./useDiceOpponent";
import type {
  RealtimeDecision,
  RealtimeDecisionInput,
} from "./runtime/dice-runtime";

interface UseDiceRoundOptions {
  say: (source: readonly string[] | string, mood?: MoodKey) => void;
  showBanner: (title: string, subtitle: string) => void;
  transferCoins: (side: Side, amount: number) => void;
  clearCoinTransfer: () => void;
  resetReport: () => void;
  decideRealtime: (
    input: RealtimeDecisionInput,
  ) => Promise<RealtimeDecision | null>;
}

export function useDiceRound({
  say,
  showBanner,
  transferCoins,
  clearCoinTransfer,
  resetReport,
  decideRealtime,
}: UseDiceRoundOptions) {
  const [game, setGame] = useState<GameState>(() => createInitialGame());
  const gameRef = useRef(game);
  const eventLogRef = useRef<string[]>([]);
  const battleRecordRef = useRef<string | null>(null);
  const [resultOpen, setResultOpen] = useState(false);
  const {
    wait,
    cancelPendingWaits,
    getSequence,
    isSequenceActive,
    isMounted,
  } = useDiceRoundScheduler();

  const commit = useCallback((change: (next: GameState) => void) => {
    const next = cloneGame(gameRef.current);
    change(next);
    gameRef.current = next;
    if (isMounted()) setGame(next);
    return next;
  }, [isMounted]);

  const replaceGame = useCallback((next: GameState) => {
    gameRef.current = next;
    if (isMounted()) setGame(next);
  }, [isMounted]);

  const recordEvent = useCallback((event: string) => {
    eventLogRef.current = [...eventLogRef.current, event].slice(-80);
  }, []);

  const getCurrentGame = useCallback(() => gameRef.current, []);
  const saveBattleRecord = useCallback((settled: GameState) => {
    battleRecordRef.current = buildDiceBattleRecord(
      settled,
      eventLogRef.current,
    );
  }, []);
  const openResult = useCallback(() => setResultOpen(true), []);
  const { settleFold, settleShowdown } = useDiceSettlement({
    commit,
    getCurrentGame,
    recordEvent,
    saveBattleRecord,
    wait,
    say,
    showBanner,
    openResult,
  });

  const chooseOpponentBetAction = useDiceOpponent({
    decideRealtime,
    wait,
  });

  async function rollMasks(playerMask: boolean[], opponentMask: boolean[]) {
    let maxDuration = 0;
    commit((next) => {
      (
        [
          ["player", playerMask],
          ["opponent", opponentMask],
        ] as const
      ).forEach(([sideName, mask]) => {
        const side = next[sideName];
        side.dice.forEach((_, index) => {
          if (!mask[index]) return;
          const value = randomDie();
          const duration = randomRollDuration();
          side.dice[index] = value;
          side.rolling[index] = true;
          side.rollDurations[index] = duration;
          side.rotations[index] = nextRotation(side.rotations[index]!, value);
          maxDuration = Math.max(maxDuration, duration);
        });
      });
    });
    if (!(await wait(maxDuration * 1000 + 80))) return false;
    commit((next) => {
      next.player.rolling.fill(false);
      next.opponent.rolling.fill(false);
    });
    return true;
  }

  function opponentDialogueFor(action: BetAction, facingBet: boolean) {
    if (action === "check") return say(DIALOGUE.tibbyCheck, "calm");
    if (action === "call") return say(DIALOGUE.tibbyCall, "curious");
    if (action === "fold") return say(DIALOGUE.tibbyFold, "calm");
    if (facingBet) return say(DIALOGUE.tibbyRaise, "amused");
    return say(
      action === "raise-big" ? DIALOGUE.tibbyBigBet : DIALOGUE.tibbySmallBet,
      action === "raise-big" ? "serious" : "amused",
    );
  }

  async function enterPublicLock() {
    commit((next) => {
      next.phase = "public-lock";
      next.turn = "player";
      next.busy = false;
      next.betting = null;
    });
    showBanner("明蛊", "PUBLIC LOCK · IRREVERSIBLE");
    say(DIALOGUE.publicLock, "curious");
  }

  async function startBettingStreet(street: 1 | 2) {
    const started = commit((next) => startBetting(next, street));
    showBanner(
      street === 1 ? "初押" : "终押",
      street === 1 ? "OPENING BET" : "FINAL BET",
    );
    say(
      street === 1 ? DIALOGUE.playerBet : DIALOGUE.secondBet,
      street === 1 ? "calm" : "serious",
    );
    if (started.betting?.actor === "opponent") await runOpponentBet();
  }

  async function finishBettingStreet(street: 1 | 2) {
    if (street === 1) await enterPublicLock();
    else await settleShowdown();
  }

  async function processBetAction(
    side: Side,
    action: BetAction,
    reaction?: RealtimeDecision,
  ) {
    const before = gameRef.current;
    if (!before.betting || before.betting.actor !== side || before.busy) return;
    const facingBet = before.betting.currentBet > 0;
    const street = before.betting.street;
    let resolution: BetResolution = {
      streetComplete: false,
      folded: false,
      paid: 0,
    };
    commit((next) => {
      resolution = applyBetAction(next, side, action);
      next.busy = false;
    });
    recordEvent(
      `${side === "player" ? "玩家" : "缇比"}执行${action}，投入${resolution.paid}，底池${gameRef.current.pot}`,
    );
    if (resolution.paid > 0) {
      transferCoins(side, resolution.paid);
    }
    if (side === "opponent") {
      if (reaction) say(reaction.line, reaction.mood);
      else opponentDialogueFor(action, facingBet);
    }
    if (resolution.folded) {
      await settleFold(side);
      return;
    }
    if (resolution.streetComplete) {
      await finishBettingStreet(street);
      return;
    }
    if (gameRef.current.betting?.actor === "opponent") await runOpponentBet();
  }

  async function runOpponentBet() {
    if (gameRef.current.betting?.actor !== "opponent") return;
    const sequence = getSequence();
    commit((next) => {
      next.busy = true;
    });
    say(DIALOGUE.tibbyThinking, "thinking");
    const current = gameRef.current;
    const decision = await chooseOpponentBetAction(
      current,
      eventLogRef.current,
      () =>
        isSequenceActive(sequence) &&
        gameRef.current.betting?.actor === "opponent",
    );
    if (!decision) return;
    commit((next) => {
      next.busy = false;
    });
    await processBetAction(
      "opponent",
      decision.action,
      decision.reaction,
    );
  }

  async function beginHand() {
    setResultOpen(false);
    eventLogRef.current = [];
    battleRecordRef.current = null;
    resetReport();
    recordEvent(
      `第${gameRef.current.handNumber}局开始，庄家为${gameRef.current.dealer}`,
    );
    showBanner(
      "起蛊 · 第 " + gameRef.current.handNumber + " 局",
      "ANTE · PRIVATE ROLL",
    );
    say(DIALOGUE.ante, "amused");
    if (!(await wait(360))) return;
    if (
      !(await rollMasks(
        [true, true, true, true, true],
        [true, true, true, true, true],
      ))
    )
      return;
    await startBettingStreet(1);
  }

  useEffect(() => {
    void (async () => {
      if (await wait(250)) await beginHand();
    })();
    // The opening hand is intentionally dealt once per mounted game.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function togglePlayerDie(index: number) {
    const current = gameRef.current;
    if (current.busy) return;
    if (current.phase === "public-lock") {
      commit((next) => {
        next.player.publicLocked[index] = !next.player.publicLocked[index];
      });
    } else if (
      current.phase === "private-lock" &&
      !current.player.publicLocked[index]
    ) {
      commit((next) => {
        next.player.privateLocked[index] = !next.player.privateLocked[index];
      });
    }
  }

  async function confirmPublicLocks() {
    if (gameRef.current.phase !== "public-lock" || gameRef.current.busy) return;
    const confirmed = commit((next) => {
      next.busy = true;
      next.phase = "forced-reroll";
      next.opponent.publicLocked = choosePublicLocks(next.opponent.dice);
    });
    const count = confirmed.player.publicLocked.filter(Boolean).length;
    recordEvent(
      `明蛊完成：玩家公开${confirmed.player.dice.filter((_, index) => confirmed.player.publicLocked[index]).join(",") || "无"}；缇比公开${confirmed.opponent.dice.filter((_, index) => confirmed.opponent.publicLocked[index]).join(",") || "无"}`,
    );
    say(
      count === 0 ? DIALOGUE.publicLockNone : DIALOGUE.publicLockSome,
      count === 0 ? "amused" : "curious",
    );
    showBanner("暗转", "UNLOCKED DICE MUST ROLL");
    if (!(await wait(480))) return;
    if (
      !(await rollMasks(
        confirmed.player.publicLocked.map((value) => !value),
        confirmed.opponent.publicLocked.map((value) => !value),
      ))
    )
      return;
    commit((next) => {
      next.phase = "private-lock";
      next.turn = "player";
      next.busy = false;
    });
    say(DIALOGUE.privateLock, "thinking");
    showBanner("最后调整", "PRIVATE LOCK · ONE REROLL");
  }

  async function finishPrivateLocks(reroll: boolean) {
    const current = gameRef.current;
    if (current.phase !== "private-lock" || current.busy) return;
    const requestedPlayerMask = current.player.dice.map(
      (_, index) =>
        reroll &&
        !current.player.publicLocked[index] &&
        !current.player.privateLocked[index],
    );
    const requestedPlayerCount = requestedPlayerMask.filter(Boolean).length;
    const playerRerollLimit = getFinalRerollLimit(current.player);
    if (
      reroll &&
      (requestedPlayerCount === 0 || requestedPlayerCount > playerRerollLimit)
    )
      return;
    const prepared = commit((next) => {
      next.busy = true;
      next.phase = "final-reroll";
      const opponentLocks = choosePrivateLocks(
        next.opponent.dice,
        next.opponent.publicLocked,
      );
      next.opponent.privateLocked = opponentLocks.map(
        (locked, index) => locked && !next.opponent.publicLocked[index],
      );
    });
    const playerMask = prepared.player.dice.map(
      (_, index) =>
        reroll &&
        !prepared.player.publicLocked[index] &&
        !prepared.player.privateLocked[index],
    );
    const opponentRank = rankHand(prepared.opponent.dice);
    const opponentWillReroll = ![
      "largeStraight",
      "fullHouse",
      "fourKind",
      "yacht",
    ].includes(opponentRank.category);
    const opponentEligible = prepared.opponent.dice.map(
      (_, index) =>
        opponentWillReroll &&
        !prepared.opponent.publicLocked[index] &&
        !prepared.opponent.privateLocked[index],
    );
    const opponentMask = chooseLimitedRerollMask(
      prepared.opponent.dice,
      opponentEligible,
      getFinalRerollLimit(prepared.opponent),
    );
    recordEvent(
      `暗蛊完成：玩家选择${reroll ? `重掷${playerMask.filter(Boolean).length}枚` : "停手"}；缇比重掷${opponentMask.filter(Boolean).length}枚`,
    );
    if (playerMask.some(Boolean) || opponentMask.some(Boolean)) {
      showBanner("定蛊", "LAST PRIVATE REROLL");
      say(DIALOGUE.darkRoll, "thinking");
      if (!(await rollMasks(playerMask, opponentMask))) return;
    } else {
      if (!(await wait(420))) return;
    }
    await startBettingStreet(2);
  }

  function dealNextHand() {
    cancelPendingWaits();
    const next = createNextHand(gameRef.current);
    replaceGame(next);
    setResultOpen(false);
    clearCoinTransfer();
    say(DIALOGUE.intro, "amused");
    void beginHand();
  }


  function getBattleRecord() {
    return (
      battleRecordRef.current ??
      buildDiceBattleRecord(gameRef.current, eventLogRef.current)
    );
  }

  return {
    game,
    resultOpen,
    togglePlayerDie,
    confirmPublicLocks,
    finishPrivateLocks,
    processBetAction,
    dealNextHand,
    getBattleRecord,
  };
}
