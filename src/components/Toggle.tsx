import type { ButtonHTMLAttributes } from "react";
import { useControllableState } from "../hooks/useControllableState";
import type { AbyssaSize, AbyssaVariant } from "../types";
import { cx } from "../utils/cx";
import { DiamondWatermark } from "./DiamondWatermark";

export interface ToggleProps
  extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, "onChange"> {
  checked?: boolean;
  defaultChecked?: boolean;
  onCheckedChange?: (checked: boolean) => void;
  variant?: AbyssaVariant;
  size?: AbyssaSize;
  onLabel?: string;
  offLabel?: string;
}

export function Toggle({
  checked,
  defaultChecked = false,
  onCheckedChange,
  variant = "light",
  size = "md",
  onLabel = "On",
  offLabel = "Off",
  className,
  disabled,
  onClick,
  type = "button",
  ...props
}: ToggleProps) {
  const [isChecked, setChecked] = useControllableState({
    value: checked,
    defaultValue: defaultChecked,
    onChange: onCheckedChange
  });

  return (
    <button
      type={type}
      role="switch"
      aria-checked={isChecked}
      className={cx("abyssa-toggle", className)}
      data-variant={variant}
      data-size={size}
      data-checked={isChecked || undefined}
      disabled={disabled}
      onClick={(event) => {
        onClick?.(event);
        if (!event.defaultPrevented && !disabled) setChecked(!isChecked);
      }}
      {...props}
    >
      <DiamondWatermark className="abyssa-toggle__watermark" size={22} />
      <span className="abyssa-toggle__label">
        {isChecked ? onLabel : offLabel}
      </span>
      <span className="abyssa-toggle__marker" aria-hidden="true" />
    </button>
  );
}
