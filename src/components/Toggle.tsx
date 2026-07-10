import type { ButtonHTMLAttributes } from "react";
import { useControllableState } from "../hooks/useControllableState";
import type { AbyssaSize, AbyssaVariant } from "../types";
import { cx } from "../utils/cx";
import { DiamondWatermark, resolveDiamondWatermark } from "./DiamondWatermark";
import type { DiamondWatermarkConfig } from "./DiamondWatermark";

export interface ToggleProps
  extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, "onChange"> {
  checked?: boolean;
  defaultChecked?: boolean;
  onCheckedChange?: (checked: boolean) => void;
  variant?: AbyssaVariant;
  size?: AbyssaSize;
  onLabel?: string;
  offLabel?: string;
  watermark?: DiamondWatermarkConfig;
}

export function Toggle({
  checked,
  defaultChecked = false,
  onCheckedChange,
  variant = "light",
  size = "md",
  onLabel = "On",
  offLabel = "Off",
  watermark,
  className,
  disabled,
  onClick,
  type = "button",
  ...props
}: ToggleProps) {
  const watermarkOptions = resolveDiamondWatermark(watermark, { size: 22, outerOpacity: 0.72, innerOpacity: 0.62 });
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
      {watermarkOptions && <DiamondWatermark className="abyssa-toggle__watermark" {...watermarkOptions} />}
      <span className="abyssa-toggle__label">
        {isChecked ? onLabel : offLabel}
      </span>
      <span className="abyssa-toggle__marker" aria-hidden="true" />
    </button>
  );
}
