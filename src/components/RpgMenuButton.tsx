import { forwardRef } from "react";
import type { ButtonHTMLAttributes, ReactNode } from "react";
import type { AbyssaSize, AbyssaVariant } from "../types";
import { cx } from "../utils/cx";

export interface RpgMenuButtonProps
  extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: AbyssaVariant;
  size?: AbyssaSize;
  selected?: boolean;
  secondaryLabel?: ReactNode;
}

export const RpgMenuButton = forwardRef<
  HTMLButtonElement,
  RpgMenuButtonProps
>(function RpgMenuButton(
  {
    variant = "dark",
    size = "md",
    selected,
    secondaryLabel,
    className,
    children,
    type = "button",
    ...props
  },
  ref
) {
  return (
    <button
      ref={ref}
      type={type}
      className={cx("abyssa-menu-button", className)}
      data-variant={variant}
      data-size={size}
      data-selected={selected || undefined}
      aria-pressed={selected === undefined ? undefined : selected}
      {...props}
    >
      <span className="abyssa-menu-button__outer">
        <span className="abyssa-menu-button__middle">
          <span className="abyssa-menu-button__inner">
            <span className="abyssa-menu-button__surface">
              <span className="abyssa-menu-button__label">
                {children}
                {secondaryLabel && <small>{secondaryLabel}</small>}
              </span>
            </span>
          </span>
        </span>
      </span>
    </button>
  );
});
