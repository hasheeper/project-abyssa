import { forwardRef, useId } from "react";
import type { ButtonHTMLAttributes, ReactNode } from "react";
import type { AbyssaSize, AbyssaVariant } from "../types";
import { cx } from "../utils/cx";
import { DiamondWatermark, resolveDiamondWatermark } from "./DiamondWatermark";
import type { DiamondWatermarkConfig } from "./DiamondWatermark";

export interface RibbonButtonProps
  extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: AbyssaVariant;
  size?: AbyssaSize;
  selected?: boolean;
  loading?: boolean;
  fullWidth?: boolean;
  leadingIcon?: ReactNode;
  trailingIcon?: ReactNode;
  watermark?: DiamondWatermarkConfig;
}

export const RibbonButton = forwardRef<HTMLButtonElement, RibbonButtonProps>(
  function RibbonButton(
    {
      variant = "dark",
      size = "md",
      selected,
      loading = false,
      fullWidth = false,
      leadingIcon,
      trailingIcon,
      watermark,
      disabled,
      className,
      children,
      type = "button",
      ...props
    },
    ref
  ) {
    const watermarkOptions = resolveDiamondWatermark(watermark, { size: 44, outerOpacity: 0.72, innerOpacity: 0.62, innerInset: 10 });
    const id = useId().replace(/:/g, "");
    const patternId = `abyssa-pattern-${id}`;
    const fadeId = `abyssa-fade-${id}`;
    const maskId = `abyssa-mask-${id}`;
    const clipId = `abyssa-clip-${id}`;

    return (
      <button
        ref={ref}
        type={type}
        className={cx("abyssa-ribbon-button", className)}
        data-variant={variant}
        data-size={size}
        data-selected={selected || undefined}
        data-full-width={fullWidth || undefined}
        aria-pressed={selected === undefined ? undefined : selected}
        aria-busy={loading || undefined}
        disabled={disabled || loading}
        {...props}
      >
        <svg
          className="abyssa-ribbon-button__art"
          viewBox="0 0 820 68"
          preserveAspectRatio="xMidYMid meet"
          aria-hidden="true"
        >
          <defs>
            {watermarkOptions && <DiamondWatermark
              as="pattern"
              id={patternId}
              outerFill="var(--abyssa-ribbon-pattern)"
              innerFill="rgb(255 255 255 / 2%)"
              patternTransform="translate(0 -10)"
              {...watermarkOptions}
            />}
            <linearGradient id={fadeId} x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="white" stopOpacity="1" />
              <stop offset="27%" stopColor="white" stopOpacity=".22" />
              <stop offset="40%" stopColor="white" stopOpacity="0" />
              <stop offset="60%" stopColor="white" stopOpacity="0" />
              <stop offset="73%" stopColor="white" stopOpacity=".22" />
              <stop offset="100%" stopColor="white" stopOpacity="1" />
            </linearGradient>
            <mask id={maskId}>
              <rect width="820" height="68" fill={`url(#${fadeId})`} />
            </mask>
            <clipPath id={clipId}>
              <path d="M34 7 H786 L765 34 L786 61 H34 L55 34 Z" />
            </clipPath>
          </defs>

          <path
            d="M35 11 H788 L769 38 L788 65 H35 L56 38 Z"
            fill="#111616"
            opacity=".72"
          />
          <path
            d="M34 7 H786 L765 34 L786 61 H34 L55 34 Z"
            fill="var(--abyssa-ribbon-fill)"
          />
          {watermarkOptions && <rect
            x="30"
            y="4"
            width="760"
            height="60"
            fill={`url(#${patternId})`}
            mask={`url(#${maskId})`}
            clipPath={`url(#${clipId})`}
          />}
          <path
            className="abyssa-ribbon-button__frame-dark"
            d="M34 7 H786 L765 34 L786 61 H34 L55 34 Z"
            fill="none"
            strokeWidth="7"
          />
          <path
            d="M34 7 H786 L765 34 L786 61 H34 L55 34 Z"
            fill="none"
            stroke="var(--abyssa-frame-light)"
            strokeWidth="4"
          />
          <path
            className="abyssa-ribbon-button__frame-dark"
            d="M34 7 H786 L765 34 L786 61 H34 L55 34 Z"
            fill="none"
            strokeWidth="2"
          />
          <g>
            <path d="M11 34 L24 21 L37 34 L24 47 Z" fill="var(--abyssa-frame-dark)" />
            <path d="M16 34 L24 26 L32 34 L24 42 Z" fill="var(--abyssa-frame-light)" />
            <path d="M19 34 L24 29 L29 34 L24 39 Z" fill="var(--abyssa-frame-dark)" />
            <path d="M783 34 L796 21 L809 34 L796 47 Z" fill="var(--abyssa-frame-dark)" />
            <path d="M788 34 L796 26 L804 34 L796 42 Z" fill="var(--abyssa-frame-light)" />
            <path d="M791 34 L796 29 L801 34 L796 39 Z" fill="var(--abyssa-frame-dark)" />
          </g>
        </svg>
        <span className="abyssa-ribbon-button__label">
          {leadingIcon && (
            <span className="abyssa-ribbon-button__icon" aria-hidden="true">
              {leadingIcon}
            </span>
          )}
          <span>{loading ? "Loading…" : children}</span>
          {trailingIcon && (
            <span className="abyssa-ribbon-button__icon" aria-hidden="true">
              {trailingIcon}
            </span>
          )}
        </span>
      </button>
    );
  }
);
