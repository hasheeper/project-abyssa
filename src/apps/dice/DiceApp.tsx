import { getLumenPriorityScore } from "./game";
import { ActionDock } from "../../shared/ui/patterns/action-dock/ActionDock";
import { Stage } from "../../shared/stage";
import { BettingControls } from "./components/BettingControls";
import { DiceBoard } from "./components/DiceBoard";
import { DiceHeader } from "./components/DiceHeader";
import { DiceOuterFrame } from "./components/DiceOuterFrame";
import { IdleControls, LockControls } from "./components/LockControls";
import { ResultOverlay } from "./components/ResultOverlay";
import { TableStatus } from "./components/TableStatus";
import { TibbyStage } from "./components/TibbyStage";
import { TurnBanner } from "./components/TurnBanner";
import {
  DICE_PHASE_LABELS,
  deriveDiceViewModel,
} from "./dice-view-model";
import { useDicePresentation } from "./presentation/useDicePresentation";
import { useDiceRuntime } from "./runtime/useDiceRuntime";
import { useDiceRound } from "./useDiceRound";

export function DiceApp() {
  const {
    dialogue,
    banner,
    coinTransfer,
    say,
    showBanner,
    transferCoins,
    clearCoinTransfer,
  } = useDicePresentation();
  const {
    runtimeState,
    report,
    resetReport,
    decideRealtime,
    generateBattleReport,
  } = useDiceRuntime();
  const {
    game,
    resultOpen,
    togglePlayerDie,
    confirmPublicLocks,
    finishPrivateLocks,
    processBetAction,
    dealNextHand,
    getBattleRecord,
  } = useDiceRound({
    say,
    showBanner,
    transferCoins,
    clearCoinTransfer,
    resetReport,
    decideRealtime,
  });
  const {
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
  } = deriveDiceViewModel(game);

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
                phaseLabel={DICE_PHASE_LABELS[game.phase]}
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
            void generateBattleReport(getBattleRecord(), targetLength)
          }
          onNextHand={dealNextHand}
        />
      )}
    </Stage>
  );
}
