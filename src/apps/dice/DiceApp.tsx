import { useCallback, useEffect, useRef, useState } from "react";
import {
  applyBetAction,
  chooseLimitedRerollMask,
  chooseOpponentBet,
  choosePrivateLocks,
  choosePublicLocks,
  cloneGame,
  compareLumenPriority,
  compareHands,
  createInitialGame,
  createNextHand,
  DIALOGUE,
  getBetOptions,
  getFinalRerollLimit,
  getLumenPriorityScore,
  nextRotation,
  otherSide,
  randomDie,
  randomItem,
  rankHand,
  startBetting,
} from "./game";
import { randomRollDuration } from "../../shared/presentation/roll/timing";
import type {
  BetAction,
  BetResolution,
  GameState,
  MoodKey,
  Side,
} from "./game";
import { ActionDock } from "../../shared/ui/patterns/action-dock/ActionDock";
import { BettingControls } from "./components/BettingControls";
import { DiceBoard } from "./components/DiceBoard";
import { DiceHeader } from "./components/DiceHeader";
import { DiceOuterFrame } from "./components/DiceOuterFrame";
import { IdleControls, LockControls } from "./components/LockControls";
import { ResultOverlay } from "./components/ResultOverlay";
import { TableStatus } from "./components/TableStatus";
import type { CoinTransfer } from "./components/TableStatus";
import { TibbyStage } from "./components/TibbyStage";
import { TurnBanner } from "./components/TurnBanner";
import { Stage } from "../../shared/stage";
import {
  createDiceRuntimePort,
  type BattleReportStage,
  type DiceRuntimeReadiness,
  type RealtimeDecision,
} from "./runtime/dice-runtime";

interface DialogueState {
  text: string;
  mood: MoodKey;
  key: number;
}

interface BannerState {
  title: string;
  subtitle: string;
  visible: boolean;
}

interface ReportState {
  status: "idle" | "running" | "completed" | "failed";
  stage: BattleReportStage | null;
  report: string;
  proposal: string;
  error: string;
}

type RuntimeState = DiceRuntimeReadiness | { state: "checking" };

const wait = (ms: number) =>
  new Promise((resolve) => window.setTimeout(resolve, ms));
const SHOWDOWN_REVEAL_MS = 5000;

const PHASE_LABELS: Record<GameState["phase"], string> = {
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

export function DiceApp() {
  const [game, setGame] = useState<GameState>(() => createInitialGame());
  const gameRef = useRef(game);
  const runtimeRef = useRef(createDiceRuntimePort());
  const runtimeReadyRef = useRef(false);
  const eventLogRef = useRef<string[]>([]);
  const battleRecordRef = useRef<string | null>(null);
  const mountedRef = useRef(true);
  const bannerTimerRef = useRef<number | null>(null);
  const coinTransferIdRef = useRef(0);
  const [resultOpen, setResultOpen] = useState(false);
  const [coinTransfer, setCoinTransfer] = useState<CoinTransfer | null>(null);
  const [dialogue, setDialogue] = useState<DialogueState>({
    text: "一局定胜负。你只需要让我看见你愿意公开的部分~",
    mood: "amused",
    key: 0,
  });
  const [banner, setBanner] = useState<BannerState>({
    title: "",
    subtitle: "",
    visible: false,
  });
  const [report, setReport] = useState<ReportState>({
    status: "idle",
    stage: null,
    report: "",
    proposal: "",
    error: "",
  });
  const [runtimeState, setRuntimeState] = useState<RuntimeState>(() =>
    runtimeRef.current
      ? { state: "checking" }
      : { state: "unavailable", message: "Runtime is disabled." },
  );

  useEffect(() => {
    mountedRef.current = true;
    const runtime = runtimeRef.current;
    if (runtime) {
      void runtime.checkReadiness().then((readiness) => {
        if (!mountedRef.current) return;
        runtimeReadyRef.current = readiness.state === "ready";
        setRuntimeState(readiness);
      });
    }
    return () => {
      mountedRef.current = false;
      runtimeReadyRef.current = false;
      runtime?.dispose();
      if (bannerTimerRef.current !== null)
        window.clearTimeout(bannerTimerRef.current);
    };
  }, []);

  const commit = useCallback((change: (next: GameState) => void) => {
    const next = cloneGame(gameRef.current);
    change(next);
    gameRef.current = next;
    if (mountedRef.current) setGame(next);
    return next;
  }, []);

  const replaceGame = useCallback((next: GameState) => {
    gameRef.current = next;
    if (mountedRef.current) setGame(next);
  }, []);

  const say = useCallback(
    (source: readonly string[] | string, mood: MoodKey = "calm") => {
      const text = typeof source === "string" ? source : randomItem(source);
      setDialogue((current) => ({ text, mood, key: current.key + 1 }));
    },
    [],
  );

  const recordEvent = useCallback((event: string) => {
    eventLogRef.current = [...eventLogRef.current, event].slice(-80);
  }, []);

  const showBanner = useCallback((title: string, subtitle: string) => {
    if (bannerTimerRef.current !== null)
      window.clearTimeout(bannerTimerRef.current);
    setBanner({ title, subtitle, visible: true });
    bannerTimerRef.current = window.setTimeout(() => {
      if (mountedRef.current)
        setBanner((current) => ({ ...current, visible: false }));
    }, 920);
  }, []);

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
    await wait(maxDuration * 1000 + 80);
    if (!mountedRef.current) return;
    commit((next) => {
      next.player.rolling.fill(false);
      next.opponent.rolling.fill(false);
    });
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

  async function settleFold(folded: Side) {
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
    await wait(SHOWDOWN_REVEAL_MS);
    if (!mountedRef.current) return;
    const settled = commit((next) => {
      const winnings = next.pot;
      next.phase = "settled";
      next.settledPot = winnings;
      next.bankroll[winner] += winnings;
      next.pot = 0;
    });
    recordEvent(
      `${folded === "player" ? "玩家" : "缇比"}弃牌，${winner === "player" ? "玩家" : "缇比"}赢得${settled.settledPot}`,
    );
    battleRecordRef.current = buildBattleRecord(settled, eventLogRef.current);
    showBanner("定局", "POT " + settled.settledPot + " G");
    setResultOpen(true);
  }

  async function settleShowdown() {
    commit((next) => {
      next.phase = "showdown";
      next.busy = true;
      next.showdownRevealed = true;
      next.betting = null;
    });
    showBanner("揭蛊", "DICE REVEALED · 5 SEC");
    say(DIALOGUE.showdown, "serious");
    await wait(SHOWDOWN_REVEAL_MS);
    if (!mountedRef.current) return;
    const current = gameRef.current;
    const comparison = compareHands(current.player.dice, current.opponent.dice);
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
      `揭蛊：玩家${settled.player.dice.join(",")}，缇比${settled.opponent.dice.join(",")}，结果${winner}`,
    );
    battleRecordRef.current = buildBattleRecord(settled, eventLogRef.current);
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
    setResultOpen(true);
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
      coinTransferIdRef.current += 1;
      setCoinTransfer({
        id: coinTransferIdRef.current,
        side,
        amount: resolution.paid,
      });
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
    commit((next) => {
      next.busy = true;
    });
    say(DIALOGUE.tibbyThinking, "thinking");
    const current = gameRef.current;
    const options = getBetOptions(current, "opponent");
    const playerPublicDice = current.player.dice.filter(
      (_, index) => current.player.publicLocked[index],
    );
    const allowedActions = getAllowedBetActions(options);
    const reactionPromise = runtimeReadyRef.current
      ? (runtimeRef.current?.decideRealtime({
          gameState: JSON.stringify({
            handNumber: current.handNumber,
            phase: current.phase,
            street: current.betting!.street,
            ownDice: current.opponent.dice,
            ownPublicLocks: current.opponent.publicLocked,
            playerPublicDice,
            pot: current.pot,
            bankroll: current.bankroll.opponent,
            toCall: options.toCall,
          }),
          allowedActions,
          recentEvents: eventLogRef.current,
        }) ?? Promise.resolve(null))
      : Promise.resolve(null);
    await wait(1100);
    const reaction = await reactionPromise;
    if (!mountedRef.current || gameRef.current.betting?.actor !== "opponent")
      return;
    let action =
      reaction?.action ??
      chooseOpponentBet({
        ownDice: current.opponent.dice,
        playerPublicDice,
        pot: current.pot,
        toCall: options.toCall,
        canRaiseSmall: options.canRaiseSmall,
        canRaiseBig: options.canRaiseBig,
        bankroll: current.bankroll.opponent,
        street: current.betting!.street,
      });
    if (action === "call" && !options.canCall) action = "fold";
    if (action === "raise-small" && !options.canRaiseSmall)
      action = options.canCheck ? "check" : options.canCall ? "call" : "fold";
    if (action === "raise-big" && !options.canRaiseBig)
      action = options.canRaiseSmall
        ? "raise-small"
        : options.canCheck
          ? "check"
          : options.canCall
            ? "call"
            : "fold";
    await wait(action === "raise-small" || action === "raise-big" ? 650 : 250);
    if (!mountedRef.current || gameRef.current.betting?.actor !== "opponent")
      return;
    commit((next) => {
      next.busy = false;
    });
    await processBetAction("opponent", action, reaction ?? undefined);
  }

  async function beginHand() {
    setResultOpen(false);
    eventLogRef.current = [];
    battleRecordRef.current = null;
    setReport({
      status: "idle",
      stage: null,
      report: "",
      proposal: "",
      error: "",
    });
    recordEvent(
      `第${gameRef.current.handNumber}局开始，庄家为${gameRef.current.dealer}`,
    );
    showBanner(
      "起蛊 · 第 " + gameRef.current.handNumber + " 局",
      "ANTE · PRIVATE ROLL",
    );
    say(DIALOGUE.ante, "amused");
    await wait(360);
    if (!mountedRef.current) return;
    await rollMasks(
      [true, true, true, true, true],
      [true, true, true, true, true],
    );
    if (!mountedRef.current) return;
    await startBettingStreet(1);
  }

  useEffect(() => {
    const timer = window.setTimeout(() => void beginHand(), 250);
    return () => window.clearTimeout(timer);
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
    await wait(480);
    await rollMasks(
      confirmed.player.publicLocked.map((value) => !value),
      confirmed.opponent.publicLocked.map((value) => !value),
    );
    if (!mountedRef.current) return;
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
      await rollMasks(playerMask, opponentMask);
    } else {
      await wait(420);
    }
    if (mountedRef.current) await startBettingStreet(2);
  }

  function dealNextHand() {
    const next = createNextHand(gameRef.current);
    replaceGame(next);
    setResultOpen(false);
    setCoinTransfer(null);
    say(DIALOGUE.intro, "amused");
    void beginHand();
  }

  async function generateBattleReport(targetLength: number) {
    const runtime = runtimeRef.current;
    if (!runtime || report.status === "running") return;
    setReport({
      status: "running",
      stage: "outline",
      report: "",
      proposal: "",
      error: "",
    });
    try {
      const result = await runtime.generateBattleReport(
        battleRecordRef.current ??
          buildBattleRecord(gameRef.current, eventLogRef.current),
        targetLength,
        (stage) => {
          if (mountedRef.current)
            setReport((current) => ({ ...current, stage }));
        },
      );
      if (!mountedRef.current) return;
      setReport({
        status: "completed",
        stage: null,
        report: result.finalReport,
        proposal: result.stateMemoryProposal,
        error: "",
      });
    } catch (error) {
      if (!mountedRef.current) return;
      setReport({
        status: "failed",
        stage: null,
        report: "",
        proposal: "",
        error: error instanceof Error ? error.message : "战报生成失败。",
      });
    }
  }

  const bettingOptions = getBetOptions(game, "player");
  const playerRank = rankHand(game.player.dice);
  const opponentRank = rankHand(game.opponent.dice);
  const publicCount = game.player.publicLocked.filter(Boolean).length;
  const opponentPublicCount = game.opponent.publicLocked.filter(Boolean).length;
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

  return (
    <Stage background="var(--abyssa-dice-backdrop)">
      <div className="game-shell">
        <DiceHeader />
        <output
          className="dice-runtime-state"
          data-state={runtimeState.state}
          title={
            runtimeState.state === "unavailable"
              ? runtimeState.message
              : runtimeState.state === "ready"
                ? `Release ${runtimeState.releaseVersion}`
                : "Checking the Runtime release and bindings."
          }
        >
          {runtimeState.state === "ready"
            ? "RUNTIME READY"
            : runtimeState.state === "checking"
              ? "RUNTIME CHECK"
              : "LOCAL FALLBACK"}
        </output>
        <DiceOuterFrame>
          <main className="game-layout">
            <TibbyStage
              dialogue={dialogue.text}
              dialogueKey={dialogue.key}
              moodKey={dialogue.mood}
            />
            <section
              className="dice-duel"
              data-turn={game.turn}
              data-phase={game.phase}
            >
              <DiceBoard
                side="opponent"
                state={game.opponent}
                active={game.turn === "opponent" && !game.busy}
                dealer={game.dealer === "opponent"}
                stateLabel={opponentState}
                diceDisabled
                revealAll={game.showdownRevealed}
              />
              <TableStatus
                phaseLabel={PHASE_LABELS[game.phase]}
                pot={game.pot || game.settledPot}
                actionText={actionText}
                transfer={coinTransfer}
              />
              <DiceBoard
                side="player"
                state={game.player}
                active={game.turn === "player" && !game.busy}
                dealer={game.dealer === "player"}
                stateLabel={playerState}
                diceDisabled={!playerCanSelectDice}
                coverAll={game.phase === "initial-roll"}
                disabledMask={
                  game.phase === "private-lock"
                    ? game.player.publicLocked
                    : undefined
                }
                onToggleDie={togglePlayerDie}
              />
              <ActionDock
                active={playerActionActive}
                busy={game.busy}
                balance={game.bankroll.player}
              >
                {(game.phase === "betting-one" ||
                  game.phase === "betting-two") && (
                  <BettingControls
                    options={bettingOptions}
                    disabled={game.busy || game.betting?.actor !== "player"}
                    onAction={(action) =>
                      void processBetAction("player", action)
                    }
                  />
                )}
                {game.phase === "public-lock" && (
                  <LockControls
                    mode="public"
                    lockedCount={publicCount}
                    disabled={game.busy}
                    onConfirm={() => void confirmPublicLocks()}
                  />
                )}
                {game.phase === "private-lock" && (
                  <LockControls
                    mode="private"
                    lockedCount={totalPrivateLocks}
                    rerollCount={playerRerollCount}
                    rerollLimit={playerRerollLimit}
                    disabled={game.busy}
                    onReroll={() => void finishPrivateLocks(true)}
                    onStand={() => void finishPrivateLocks(false)}
                  />
                )}
                {game.phase !== "betting-one" &&
                  game.phase !== "betting-two" &&
                  game.phase !== "public-lock" &&
                  game.phase !== "private-lock" && <IdleControls />}
              </ActionDock>
            </section>
          </main>
        </DiceOuterFrame>
      </div>
      <TurnBanner {...banner} />
      {resultOpen && game.winner && (
        <ResultOverlay
          winner={game.winner}
          pot={game.settledPot}
          playerRank={playerRank}
          opponentRank={opponentRank}
          folded={game.folded}
          lumenPriorityWinner={game.lumenPriorityWinner}
          playerLumenScore={getLumenPriorityScore(game.player)}
          opponentLumenScore={getLumenPriorityScore(game.opponent)}
          playerBankroll={game.bankroll.player}
          opponentBankroll={game.bankroll.opponent}
          reportState={report}
          reportAvailable={runtimeState.state === "ready"}
          onGenerateReport={(targetLength) =>
            void generateBattleReport(targetLength)
          }
          onNextHand={dealNextHand}
        />
      )}
    </Stage>
  );
}

function getAllowedBetActions(
  options: ReturnType<typeof getBetOptions>,
): BetAction[] {
  const actions: BetAction[] = [];
  if (options.canCheck) actions.push("check");
  if (options.canCall) actions.push("call");
  if (options.canRaiseSmall) actions.push("raise-small");
  if (options.canRaiseBig) actions.push("raise-big");
  actions.push("fold");
  return actions;
}

function buildBattleRecord(game: GameState, events: string[]): string {
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
