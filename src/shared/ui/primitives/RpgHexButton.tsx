import { forwardRef, useId } from "react";
import type { ButtonHTMLAttributes, ReactNode } from "react";
import type { AbyssaSize, AbyssaVariant } from "../types";
import { cx } from "../../lib/cx";
import { DiamondWatermark, resolveDiamondWatermark } from "./DiamondWatermark";
import type { DiamondWatermarkConfig } from "./DiamondWatermark";

export interface RpgHexButtonProps
  extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: AbyssaVariant;
  size?: AbyssaSize;
  layout?: "wide" | "compact";
  selected?: boolean;
  loading?: boolean;
  fullWidth?: boolean;
  leadingIcon?: ReactNode;
  trailingIcon?: ReactNode;
  watermark?: DiamondWatermarkConfig;
}

export const RpgHexButton = forwardRef<HTMLButtonElement, RpgHexButtonProps>(
  function RpgHexButton(
    {
      variant = "teal",
      size = "md",
      layout = "wide",
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
    const compact = layout === "compact";
    const width = compact ? 186 : 920;
    const height = compact ? 40 : 120;
    const watermarkOptions = resolveDiamondWatermark(watermark, { size: 58, outerOpacity: 0.72, innerOpacity: 0.62, innerInset: 13 });
    const id = useId().replace(/:/g, "");
    const patternId = `abyssa-hex-pattern-${id}`;
    const fadeId = `abyssa-hex-fade-${id}`;
    const maskId = `abyssa-hex-mask-${id}`;
    const clipId = `abyssa-hex-clip-${id}`;
    const shape = compact
      ? "M14 3 H172 L183 20 L172 37 H14 L3 20 Z"
      : "M65 15 H855 L894 60 L855 105 H65 L26 60 Z";

    return (
      <button
        ref={ref}
        type={type}
        className={cx("abyssa-hex-button", className)}
        data-variant={variant}
        data-size={size}
        data-layout={compact ? "compact" : undefined}
        data-selected={selected || undefined}
        data-full-width={fullWidth || undefined}
        aria-pressed={selected === undefined ? undefined : selected}
        aria-busy={loading || undefined}
        disabled={disabled || loading}
        {...props}
      >
        <svg
          className="abyssa-hex-button__art"
          viewBox={`0 0 ${width} ${height}`}
          preserveAspectRatio="xMidYMid meet"
          aria-hidden="true"
        >
          <defs>
            {watermarkOptions && <DiamondWatermark
              as="pattern"
              id={patternId}
              outerFill="var(--abyssa-hex-pattern-dark)"
              innerFill="var(--abyssa-hex-pattern-light)"
              patternTransform={compact ? "translate(0 -4) scale(.35)" : "translate(0 -9)"}
              {...watermarkOptions}
            />}
            <linearGradient id={fadeId} x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="white" stopOpacity="1" />
              <stop offset="18%" stopColor="white" stopOpacity=".72" />
              <stop offset="33%" stopColor="white" stopOpacity=".15" />
              <stop offset="42%" stopColor="white" stopOpacity="0" />
              <stop offset="58%" stopColor="white" stopOpacity="0" />
              <stop offset="67%" stopColor="white" stopOpacity=".15" />
              <stop offset="82%" stopColor="white" stopOpacity=".72" />
              <stop offset="100%" stopColor="white" stopOpacity="1" />
            </linearGradient>
            <mask id={maskId}>
              <rect width={width} height={height} fill={`url(#${fadeId})`} />
            </mask>
            <clipPath id={clipId}>
              <path d={shape} />
            </clipPath>
          </defs>

          <path d={shape} fill="var(--abyssa-hex-fill)" />
          {watermarkOptions && <rect
            x={compact ? 0 : 20}
            y={compact ? 0 : 10}
            width={compact ? width : 880}
            height={compact ? height : 100}
            fill={`url(#${patternId})`}
            mask={`url(#${maskId})`}
            clipPath={`url(#${clipId})`}
          />}
          <path
            d={shape}
            fill="none"
            stroke="var(--abyssa-frame-dark)"
            strokeWidth={compact ? 4 : 10}
            strokeLinejoin="miter"
          />
          <path
            d={shape}
            fill="none"
            stroke="var(--abyssa-hex-frame-middle)"
            strokeWidth={compact ? 2 : 5}
            strokeLinejoin="miter"
          />
          <path
            d={shape}
            fill="none"
            stroke="var(--abyssa-frame-deep)"
            strokeWidth={compact ? .8 : 2}
            strokeLinejoin="miter"
          />
          {!compact && <g className="abyssa-hex-button__dots">
            <circle cx="438" cy="104" r="1.6" />
            <circle cx="449" cy="104" r="2" />
            <circle cx="460" cy="104" r="2.4" />
            <circle cx="471" cy="104" r="2" />
            <circle cx="482" cy="104" r="1.6" />
          </g>}
        </svg>

        <span className="abyssa-hex-button__label">
          {leadingIcon && (
            <span className="abyssa-hex-button__icon" aria-hidden="true">
              {leadingIcon}
            </span>
          )}
          <span className="abyssa-hex-button__copy">
            {loading ? "Loading…" : children}
          </span>
          {trailingIcon && (
            <span className="abyssa-hex-button__icon" aria-hidden="true">
              {trailingIcon}
            </span>
          )}
        </span>
      </button>
    );
  }
);

export const RetroRpgHexButton = RpgHexButton;
export type RetroRpgHexButtonProps = RpgHexButtonProps;
