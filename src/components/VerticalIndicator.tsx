import { useId } from "react";
import type { HTMLAttributes } from "react";
import type { AbyssaVariant } from "../types";
import { cx } from "../utils/cx";
import { DiamondWatermark, resolveDiamondWatermark } from "./DiamondWatermark";
import type { DiamondWatermarkConfig } from "./DiamondWatermark";

export interface VerticalIndicatorProps extends HTMLAttributes<HTMLDivElement> {
  variant?: AbyssaVariant;
  label?: string;
  watermark?: DiamondWatermarkConfig;
}

const outerPath = "M20 20 L33 30 V140 L20 150 L7 140 V30 Z";
const innerPath = "M20 27 L27 33 V137 L20 143 L13 137 V33 Z";

export function VerticalIndicator({
  variant = "dark",
  label = "纵向指示器",
  watermark,
  className,
  ...props
}: VerticalIndicatorProps) {
  const watermarkOptions = resolveDiamondWatermark(watermark, { size: 20, outerOpacity: 0.72, innerOpacity: 0.62, innerInset: 5 });
  const uid = useId().replace(/:/g, "");
  const patternId = `abyssa-indicator-pattern-${uid}`;
  const clipId = `abyssa-indicator-clip-${uid}`;

  return (
    <div className={cx("abyssa-vertical-indicator", className)} data-variant={variant} {...props}>
      <svg viewBox="0 0 40 170" role="img" aria-label={label}>
        <defs>
          {watermarkOptions && <DiamondWatermark as="pattern" id={patternId} outerFill="var(--abyssa-indicator-pattern-dark)" innerFill="var(--abyssa-indicator-pattern-light)" {...watermarkOptions} />}
          <clipPath id={clipId}><path d={outerPath} /></clipPath>
        </defs>

        <path d="M20 0 V170" fill="none" stroke="var(--abyssa-indicator-axis)" strokeWidth="3" strokeLinecap="square" />
        <path d={outerPath} fill="var(--abyssa-indicator-fill)" />
        {watermarkOptions && <rect x="5" y="18" width="30" height="134" fill={`url(#${patternId})`} clipPath={`url(#${clipId})`} />}
        <path d={outerPath} fill="none" stroke="var(--abyssa-frame-dark)" strokeWidth="6" strokeLinejoin="round" />
        <path d={outerPath} fill="none" stroke="var(--abyssa-indicator-middle)" strokeWidth="3.2" strokeLinejoin="round" />
        <path d={outerPath} fill="none" stroke="var(--abyssa-frame-deep)" strokeWidth="1.3" strokeLinejoin="round" />
        <path d={innerPath} fill="none" stroke="var(--abyssa-indicator-ornament)" strokeWidth="1" strokeLinejoin="round" opacity=".92" />
        <circle cx="20" cy="34" r="1.35" fill="var(--abyssa-indicator-ornament)" />
        <circle cx="20" cy="136" r="1.35" fill="var(--abyssa-indicator-ornament)" />
      </svg>
    </div>
  );
}

export const RetroRpgVerticalIndicator = VerticalIndicator;
