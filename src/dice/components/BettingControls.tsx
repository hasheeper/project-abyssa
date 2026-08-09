import type { BetAction, BetOptions } from "../game";
import { DiceActionButton } from "./DiceActionButton";

interface BettingControlsProps {
  options: BetOptions;
  disabled?: boolean;
  onAction: (action: BetAction) => void;
}

export function BettingControls({ options, disabled = false, onAction }: BettingControlsProps) {
  const facingBet = options.toCall > 0;
  return (
    <div className="betting-controls" aria-label="下注操作">
      {facingBet ? (
        <DiceActionButton label="跟注" english={`${options.toCall} G · CALL`} disabled={disabled || !options.canCall} primary onClick={() => onAction("call")} />
      ) : (
        <DiceActionButton label="过牌" english="CHECK" disabled={disabled || !options.canCheck} onClick={() => onAction("check")} />
      )}
      <DiceActionButton label={facingBet ? "小加注" : "小注"} english={`+ ${options.smallIncrement} G`} disabled={disabled || !options.canRaiseSmall} onClick={() => onAction("raise-small")} />
      <DiceActionButton label={facingBet ? "大加注" : "大注"} english={`+ ${options.bigIncrement} G`} disabled={disabled || !options.canRaiseBig} onClick={() => onAction("raise-big")} />
      <DiceActionButton label="弃牌" english="FOLD" disabled={disabled} onClick={() => onAction("fold")} />
    </div>
  );
}
