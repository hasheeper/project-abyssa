import { forwardRef, useId } from "react";
import type { ButtonHTMLAttributes, ReactNode } from "react";
import type { AbyssaSize, AbyssaVariant } from "../types";
import { cx } from "../utils/cx";
import { DiamondWatermark, resolveDiamondWatermark } from "./DiamondWatermark";
import type { DiamondWatermarkConfig } from "./DiamondWatermark";

export type IconButtonIcon = "close" | "plus" | "minus";
export type IconButtonShape = "diamond" | "circle";

export interface IconButtonProps
  extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, "aria-label"> {
  label: string;
  variant?: AbyssaVariant;
  size?: AbyssaSize;
  shape?: IconButtonShape;
  icon?: IconButtonIcon;
  selected?: boolean;
  children?: ReactNode;
  watermark?: DiamondWatermarkConfig;
}

export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(
  function IconButton(
    {
      label,
      variant = "dark",
      size = "lg",
      shape = "circle",
      icon = "plus",
      selected,
      className,
      children,
      watermark,
      type = "button",
      ...props
    },
    ref
  ) {
    const uid = useId().replace(/:/g, "");
    const patternId = `abyssa-icon-pattern-${uid}`;
    const clipId = `abyssa-icon-clip-${uid}`;
    const compact = size !== "lg";
    const watermarkOptions = resolveDiamondWatermark(watermark, { size: compact ? 30 : 34, outerOpacity: 0.72, innerOpacity: 0.62, innerInset: compact ? 7 : 8 });
    const circleRadius = compact ? 53 : 52;
    const circleOrnamentRadius = compact ? 47 : 44;
    const diamondPath = "M60 7 L113 60 L60 113 L7 60 Z";
    const diamondOrnament = compact
      ? "M60 14 L106 60 L60 106 L14 60 Z"
      : "M60 17 L103 60 L60 103 L17 60 Z";
    const iconStart = compact ? 39 : 43;
    const iconEnd = compact ? 81 : 77;
    const closeStart = compact ? 44 : 46;
    const closeEnd = compact ? 76 : 74;

    return (
      <button
        ref={ref}
        type={type}
        className={cx("abyssa-icon-button", className)}
        data-variant={variant}
        data-size={size}
        data-shape={shape}
        data-density={compact ? "compact" : "regular"}
        data-selected={selected || undefined}
        aria-label={label}
        aria-pressed={selected === undefined ? undefined : selected}
        {...props}
      >
        <svg className="abyssa-icon-button__art" viewBox="0 0 120 120" aria-hidden="true">
          <defs>
            {watermarkOptions && <DiamondWatermark as="pattern" id={patternId} outerFill="var(--abyssa-icon-pattern-dark)" innerFill="var(--abyssa-icon-pattern-light)" {...watermarkOptions} />}
            <clipPath id={clipId}>
              {shape === "diamond" ? <path d={diamondPath} /> : <circle cx="60" cy="60" r={circleRadius} />}
            </clipPath>
          </defs>

          {shape === "diamond" ? (
            <path d={diamondPath} fill="var(--abyssa-icon-fill)" />
          ) : (
            <circle cx="60" cy="60" r={circleRadius} fill="var(--abyssa-icon-fill)" />
          )}
          {watermarkOptions && <rect x={compact ? 4 : 5} y={compact ? 4 : 5} width={compact ? 112 : 110} height={compact ? 112 : 110} fill={`url(#${patternId})`} clipPath={`url(#${clipId})`} />}

          {[9, 5, 2].map((strokeWidth, index) => {
            const stroke = index === 0 ? "var(--abyssa-frame-dark)" : index === 1 ? "var(--abyssa-icon-middle)" : "var(--abyssa-frame-deep)";
            return shape === "diamond" ? (
              <path key={strokeWidth} d={diamondPath} fill="none" stroke={stroke} strokeWidth={strokeWidth} strokeLinejoin={compact ? "round" : "miter"} />
            ) : (
              <circle key={strokeWidth} cx="60" cy="60" r={circleRadius} fill="none" stroke={stroke} strokeWidth={strokeWidth} />
            );
          })}

          {shape === "diamond" ? (
            <path d={diamondOrnament} fill="none" stroke="var(--abyssa-icon-ornament)" strokeWidth={compact ? 1.35 : 1.25} strokeLinejoin={compact ? "round" : "miter"} opacity={compact ? .92 : .9} />
          ) : (
            <circle cx="60" cy="60" r={circleOrnamentRadius} fill="none" stroke="var(--abyssa-icon-ornament)" strokeWidth={compact ? 1.35 : 1.25} opacity={compact ? .92 : .9} />
          )}

          {!children && (
            <g
              fill="none"
              stroke="var(--abyssa-icon-ink)"
              strokeWidth={compact ? (icon === "close" && shape === "diamond" ? 6.5 : 7.5) : 6}
              strokeLinecap={compact ? "round" : "square"}
              strokeLinejoin={compact ? "round" : "miter"}
            >
              {icon === "close" && <><path d={`M${closeStart} ${closeStart} L${closeEnd} ${closeEnd}`} /><path d={`M${closeEnd} ${closeStart} L${closeStart} ${closeEnd}`} /></>}
              {icon === "minus" && <path d={`M${iconStart} 60 H${iconEnd}`} />}
              {icon === "plus" && <><path d={`M${iconStart} 60 H${iconEnd}`} /><path d={`M60 ${iconStart} V${iconEnd}`} /></>}
            </g>
          )}
        </svg>
        {children && <span className="abyssa-icon-button__custom" aria-hidden="true">{children}</span>}
      </button>
    );
  }
);

export const RetroRpgIconButton = IconButton;
