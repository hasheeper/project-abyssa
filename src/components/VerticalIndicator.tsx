import { useId } from "react";
import type { HTMLAttributes } from "react";
import type { AbyssaVariant } from "../types";
import { cx } from "../utils/cx";
import { DiamondWatermark, resolveDiamondWatermark } from "./DiamondWatermark";
import type { DiamondWatermarkConfig } from "./DiamondWatermark";

export interface VerticalIndicatorProps extends HTMLAttributes<HTMLDivElement> {
  variant?: AbyssaVariant;
  label?: string;
  compact?: boolean;
  watermark?: DiamondWatermarkConfig;
}

const outerPath = "M20 20 L33 30 V140 L20 150 L7 140 V30 Z";
const innerPath = "M20 27 L27 33 V137 L20 143 L13 137 V33 Z";
const compactOuterPath = "M22 2 L41 10 V64 L22 72 L3 64 V10 Z";
const compactInnerPath = "M22 7 L35 13 V61 L22 67 L9 61 V13 Z";

export function VerticalIndicator({
  variant = "dark",
  label = "纵向指示器",
  compact = false,
  watermark,
  className,
  ...props
}: VerticalIndicatorProps) {
  const watermarkOptions = resolveDiamondWatermark(watermark, { size: 20, outerOpacity: 0.72, innerOpacity: 0.62, innerInset: 5 });
  const uid = useId().replace(/:/g, "");
  const patternId = `abyssa-indicator-pattern-${uid}`;
  const clipId = `abyssa-indicator-clip-${uid}`;
  const currentOuterPath = compact ? compactOuterPath : outerPath;
  const currentInnerPath = compact ? compactInnerPath : innerPath;

  return (
    <div className={cx("abyssa-vertical-indicator", className)} data-variant={variant} {...props}>
      <svg viewBox={compact ? "0 0 44 74" : "0 0 40 170"} role="img" aria-label={label}>
        <defs>
          {watermarkOptions && <DiamondWatermark as="pattern" id={patternId} outerFill="var(--abyssa-indicator-pattern-dark)" innerFill="var(--abyssa-indicator-pattern-light)" {...watermarkOptions} />}
          <clipPath id={clipId}><path d={currentOuterPath} /></clipPath>
        </defs>

        <path d={compact ? "M22 0 V74" : "M20 0 V170"} fill="none" stroke="var(--abyssa-indicator-axis)" strokeWidth="3" strokeLinecap="square" />
        <path d={currentOuterPath} fill="var(--abyssa-indicator-fill)" />
        {watermarkOptions && <rect x={compact ? 3 : 5} y={compact ? 2 : 18} width={compact ? 38 : 30} height={compact ? 70 : 134} fill={`url(#${patternId})`} clipPath={`url(#${clipId})`} />}
        <path d={currentOuterPath} fill="none" stroke="var(--abyssa-frame-dark)" strokeWidth={compact ? 4 : 6} strokeLinejoin="round" />
        <path d={currentOuterPath} fill="none" stroke="var(--abyssa-indicator-middle)" strokeWidth={compact ? 2.4 : 3.2} strokeLinejoin="round" />
        <path d={currentOuterPath} fill="none" stroke="var(--abyssa-frame-deep)" strokeWidth="1.3" strokeLinejoin="round" />
        <path d={currentInnerPath} fill="none" stroke="var(--abyssa-indicator-ornament)" strokeWidth="1" strokeLinejoin="round" opacity=".92" />
        <circle cx={compact ? 22 : 20} cy={compact ? 15 : 34} r="1.35" fill="var(--abyssa-indicator-ornament)" />
        <circle cx={compact ? 22 : 20} cy={compact ? 59 : 136} r="1.35" fill="var(--abyssa-indicator-ornament)" />
      </svg>
    </div>
  );
}

export const RetroRpgVerticalIndicator = VerticalIndicator;
