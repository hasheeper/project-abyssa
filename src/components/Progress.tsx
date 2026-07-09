import type { HTMLAttributes } from "react";
import type { AbyssaSize, AbyssaVariant } from "../types";
import { cx } from "../utils/cx";

export interface ProgressProps extends HTMLAttributes<HTMLDivElement> {
  value: number;
  max?: number;
  variant?: AbyssaVariant;
  size?: AbyssaSize;
  label?: string;
  showValue?: boolean;
}

export function Progress({
  value,
  max = 100,
  variant = "teal",
  size = "md",
  label,
  showValue = false,
  className,
  ...props
}: ProgressProps) {
  const safeMax = max > 0 ? max : 100;
  const safeValue = Math.min(Math.max(value, 0), safeMax);
  const percent = (safeValue / safeMax) * 100;

  return (
    <div className={cx("abyssa-progress-group", className)} {...props}>
      {(label || showValue) && (
        <span className="abyssa-progress-group__meta">
          <span>{label}</span>
          {showValue && <span>{Math.round(percent)}%</span>}
        </span>
      )}
      <div
        className="abyssa-progress"
        data-variant={variant}
        data-size={size}
        role="progressbar"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={safeMax}
        aria-valuenow={safeValue}
      >
        <span style={{ width: `${percent}%` }} />
      </div>
    </div>
  );
}
