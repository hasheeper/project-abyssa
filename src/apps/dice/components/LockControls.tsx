import { DiceActionButton } from "../../../shared/ui/patterns/action-dock/DiceActionButton";

interface LockControlsProps {
  mode: "public" | "private";
  lockedCount: number;
  rerollCount?: number;
  rerollLimit?: number;
  disabled?: boolean;
  onConfirm?: () => void;
  onReroll?: () => void;
  onStand?: () => void;
}

function ActionPlaceholder() {
  return <DiceActionButton label="" placeholder onClick={() => undefined} />;
}

export function LockControls({ mode, lockedCount, rerollCount = 0, rerollLimit = 0, disabled = false, onConfirm, onReroll, onStand }: LockControlsProps) {
  if (mode === "public") {
    return (
      <div className="lock-controls lock-controls--confirm">
        <ActionPlaceholder />
        <ActionPlaceholder />
        <ActionPlaceholder />
        <DiceActionButton label="确认" english="CONFIRM" disabled={disabled} primary onClick={() => onConfirm?.()} />
      </div>
    );
  }
  return (
    <div className="lock-controls lock-controls--compact">
      <ActionPlaceholder />
      <ActionPlaceholder />
      <DiceActionButton label="重掷" english={`REROLL ${rerollCount}/${rerollLimit}`} disabled={disabled || lockedCount >= 5 || rerollCount === 0 || rerollCount > rerollLimit} primary onClick={() => onReroll?.()} />
      <DiceActionButton label="结束" english="STAND" disabled={disabled} onClick={() => onStand?.()} />
    </div>
  );
}

export function IdleControls() {
  return (
    <div className="lock-controls lock-controls--idle" aria-hidden="true">
      {Array.from({ length: 4 }, (_, index) => (
        <ActionPlaceholder key={index} />
      ))}
    </div>
  );
}
