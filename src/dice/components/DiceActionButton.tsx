import { RpgShapeButton } from "../../components/RpgShapeButton";

interface DiceActionButtonProps {
  label: string;
  english?: string;
  disabled?: boolean;
  primary?: boolean;
  placeholder?: boolean;
  onClick: () => void;
}

export function DiceActionButton({ label, english, disabled = false, primary = false, placeholder = false, onClick }: DiceActionButtonProps) {
  const hasEnglish = Boolean(english);
  return (
    <RpgShapeButton
      label={placeholder ? "不可用操作" : hasEnglish ? `${label} · ${english}` : label}
      shape="chamfer"
      variant="dark"
      className="dice-action-button"
      data-primary={primary || undefined}
      data-placeholder={placeholder || undefined}
      disabled={disabled || placeholder}
      aria-hidden={placeholder || undefined}
      tabIndex={placeholder ? -1 : undefined}
      onClick={onClick}
    >
      {placeholder ? (
        <span className="dice-action-button__copy dice-action-button__copy--placeholder" />
      ) : (
        <span className="dice-action-button__copy" data-single={!hasEnglish || undefined}>
          <strong>{label}</strong>
          {hasEnglish && <small>{english}</small>}
        </span>
      )}
    </RpgShapeButton>
  );
}
