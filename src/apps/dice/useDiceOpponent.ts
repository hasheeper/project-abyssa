import { useCallback } from "react";
import { chooseOpponentBet, getBetOptions } from "./game";
import type { BetAction, GameState } from "./game";
import type {
  RealtimeDecision,
  RealtimeDecisionInput,
} from "./runtime/dice-runtime";

interface UseDiceOpponentOptions {
  decideRealtime: (
    input: RealtimeDecisionInput,
  ) => Promise<RealtimeDecision | null>;
  wait: (duration: number) => Promise<boolean>;
}

interface OpponentBetDecision {
  action: BetAction;
  reaction?: RealtimeDecision;
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

function normalizeOpponentAction(
  action: BetAction,
  options: ReturnType<typeof getBetOptions>,
): BetAction {
  if (action === "call" && !options.canCall) return "fold";
  if (action === "raise-small" && !options.canRaiseSmall) {
    return options.canCheck ? "check" : options.canCall ? "call" : "fold";
  }
  if (action === "raise-big" && !options.canRaiseBig) {
    return options.canRaiseSmall
      ? "raise-small"
      : options.canCheck
        ? "check"
        : options.canCall
          ? "call"
          : "fold";
  }
  return action;
}

export function useDiceOpponent({
  decideRealtime,
  wait,
}: UseDiceOpponentOptions) {
  return useCallback(
    async (
      current: GameState,
      recentEvents: readonly string[],
      isStillCurrent: () => boolean,
    ): Promise<OpponentBetDecision | null> => {
      const options = getBetOptions(current, "opponent");
      const playerPublicDice = current.player.dice.filter(
        (_, index) => current.player.publicLocked[index],
      );
      const reactionPromise = decideRealtime({
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
        allowedActions: getAllowedBetActions(options),
        recentEvents: [...recentEvents],
      });

      if (!(await wait(1100)) || !isStillCurrent()) return null;
      const reaction = await reactionPromise;
      if (!isStillCurrent()) return null;

      const requestedAction =
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
      const action = normalizeOpponentAction(requestedAction, options);
      const decisionDelay =
        action === "raise-small" || action === "raise-big" ? 650 : 250;
      if (!(await wait(decisionDelay)) || !isStillCurrent()) return null;

      return {
        action,
        reaction: reaction ?? undefined,
      };
    },
    [decideRealtime, wait],
  );
}
