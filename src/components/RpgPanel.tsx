import { forwardRef, useId } from "react";
import type { ButtonHTMLAttributes, ReactNode } from "react";
import type { PanelVariant } from "../types";
import { cx } from "../utils/cx";
import { DiamondWatermark, resolveDiamondWatermark } from "./DiamondWatermark";
import type { DiamondWatermarkConfig } from "./DiamondWatermark";

export interface RpgPanelProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: PanelVariant;
  number?: string;
  selected?: boolean;
  children?: ReactNode;
  watermark?: DiamondWatermarkConfig;
}

export const RpgPanel = forwardRef<HTMLButtonElement, RpgPanelProps>(
  function RpgPanel(
    {
      variant = "dark",
      number = "01",
      selected,
      watermark,
      className,
      children,
      type = "button",
      ...props
    },
    ref
  ) {
    const watermarkOptions = resolveDiamondWatermark(watermark, { size: 48, outerOpacity: 0.68, innerOpacity: 0.58 });
    const uid = useId().replace(/:/g, "");
    const patternId = `abyssa-panel-watermark-${uid}`;

    return (
      <button
        ref={ref}
        type={type}
        className={cx("abyssa-panel-tile", className)}
        data-variant={variant}
        data-selected={selected || undefined}
        aria-pressed={selected === undefined ? undefined : selected}
        {...props}
      >
        <svg viewBox="0 0 180 180" aria-hidden="true">
          {watermarkOptions && <defs>
            <DiamondWatermark as="pattern" id={patternId} outerFill="var(--abyssa-tile-pattern-outer)" innerFill="var(--abyssa-tile-pattern-inner)" {...watermarkOptions} />
          </defs>}
          <rect x="8" y="9.5" width="164" height="164" fill="#0d1212" opacity=".52" />
          <rect x="8" y="7" width="164" height="164" fill="var(--abyssa-tile-fill)" />
          {watermarkOptions && <rect x="8" y="7" width="164" height="164" fill={`url(#${patternId})`} />}
          <rect x="8" y="7" width="164" height="164" fill="none" stroke="var(--abyssa-frame-dark)" strokeWidth="7" />
          <rect x="8" y="7" width="164" height="164" fill="none" stroke="var(--abyssa-tile-middle)" strokeWidth="4" />
          <rect x="8" y="7" width="164" height="164" fill="none" stroke="var(--abyssa-frame-deep)" strokeWidth="2" />
          <rect x="15" y="14" width="150" height="150" fill="none" stroke="var(--abyssa-tile-ornament)" strokeWidth="1.25" opacity=".94" />
          <rect x="18" y="17" width="144" height="144" fill="none" stroke="var(--abyssa-tile-ornament)" strokeWidth=".7" opacity=".55" />
          <g fill="none" stroke="var(--abyssa-tile-ornament)" strokeLinecap="square">
            <path d="M16 39 V16 H39 M21 34 V21 H34" strokeWidth="2" />
            <path d="M141 16 H164 V39 M146 21 H159 V34" strokeWidth="2" />
            <path d="M16 141 V164 H39 M21 146 V159 H34" strokeWidth="2" />
            <path d="M141 164 H164 V141 M146 159 H159 V146" strokeWidth="2" />
          </g>
          <g fill="none" stroke="var(--abyssa-tile-ornament)" strokeWidth="1" opacity=".9">
            <path d="M25 16 H45 M16 25 V45 M135 16 H155 M164 25 V45" />
            <path d="M25 164 H45 M16 135 V155 M135 164 H155 M164 135 V155" />
          </g>
          <g fill="var(--abyssa-tile-ornament)">
            <circle cx="24" cy="24" r="1.75" />
            <circle cx="156" cy="24" r="1.75" />
            <circle cx="24" cy="156" r="1.75" />
            <circle cx="156" cy="156" r="1.75" />
            <circle cx="48" cy="17" r="1" />
            <circle cx="90" cy="17" r="1" />
            <circle cx="132" cy="17" r="1" />
            <circle cx="48" cy="163" r="1" />
            <circle cx="90" cy="163" r="1" />
            <circle cx="132" cy="163" r="1" />
            <circle cx="17" cy="64" r="1" />
            <circle cx="17" cy="116" r="1" />
            <circle cx="163" cy="64" r="1" />
            <circle cx="163" cy="116" r="1" />
          </g>
        </svg>
        <span className="abyssa-panel-tile__content">{children ?? number}</span>
        {selected && <span className="abyssa-panel-tile__marker" aria-hidden="true" />}
      </button>
    );
  }
);
