import { forwardRef } from "react";
import type { ButtonHTMLAttributes, ReactNode } from "react";
import type { AbyssaSize, AbyssaVariant } from "../types";
import { cx } from "../utils/cx";

export interface IconButtonProps
  extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, "aria-label"> {
  label: string;
  variant?: AbyssaVariant;
  size?: AbyssaSize;
  shape?: "circle" | "square" | "pill";
  selected?: boolean;
  children: ReactNode;
}

export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(
  function IconButton(
    {
      label,
      variant = "dark",
      size = "md",
      shape = "square",
      selected,
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
        className={cx("abyssa-icon-button", className)}
        data-variant={variant}
        data-size={size}
        data-shape={shape}
        data-selected={selected || undefined}
        aria-label={label}
        aria-pressed={selected === undefined ? undefined : selected}
        {...props}
      >
        <span className="abyssa-icon-button__surface" aria-hidden="true">
          {children}
        </span>
      </button>
    );
  }
);
