import { forwardRef, useId } from "react";
import type { ButtonHTMLAttributes } from "react";
import { cx } from "../utils/cx";
import { DiamondWatermark, resolveDiamondWatermark } from "./DiamondWatermark";
import type { DiamondWatermarkConfig } from "./DiamondWatermark";

export type RpgStatusNodeVariant = "disabled" | "dark" | "teal";
export type RpgStatusNodeIcon = "close" | "check";

export interface RpgStatusNodeProps
  extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, "children"> {
  label: string;
  variant?: RpgStatusNodeVariant;
  icon?: RpgStatusNodeIcon;
  watermark?: DiamondWatermarkConfig;
}

export const RpgStatusNode = forwardRef<HTMLButtonElement, RpgStatusNodeProps>(
  function RpgStatusNode(
    { label, variant = "disabled", icon = "check", watermark, className, type = "button", ...props },
    ref
  ) {
    const watermarkOptions = resolveDiamondWatermark(watermark, { size: 14, outerOpacity: 0.72, innerOpacity: 0.62 });
    const uid = useId().replace(/:/g, "");
    const patternId = `abyssa-status-node-watermark-${uid}`;

    return (
      <button ref={ref} type={type} className={cx("abyssa-status-node", className)} data-variant={variant} aria-label={label} {...props}>
        <svg viewBox="0 0 86 54" aria-hidden="true">
          {watermarkOptions && <defs>
            <DiamondWatermark as="pattern" id={patternId} outerFill="var(--abyssa-status-node-pattern-outer)" innerFill="var(--abyssa-status-node-pattern-inner)" {...watermarkOptions} />
          </defs>}
          <path d="M2 27 H84" fill="none" stroke="var(--abyssa-frame-dark)" strokeWidth="3.2" strokeLinecap="round" />
          <path d="M2 25.8 H84" fill="none" stroke="#c3cccc" strokeWidth=".8" strokeLinecap="round" opacity=".58" />
          <circle cx="43" cy="27" r="20" fill="var(--abyssa-status-node-fill)" />
          {watermarkOptions && <circle cx="43" cy="27" r="20" fill={`url(#${patternId})`} />}
          <circle cx="43" cy="27" r="20" fill="none" stroke="var(--abyssa-frame-dark)" strokeWidth="6" />
          <circle cx="43" cy="27" r="20" fill="none" stroke="var(--abyssa-status-node-middle)" strokeWidth="3.2" />
          <circle cx="43" cy="27" r="20" fill="none" stroke="var(--abyssa-frame-deep)" strokeWidth="1.3" />
          <circle cx="43" cy="27" r="15.5" fill="none" stroke="var(--abyssa-status-node-inner)" strokeWidth="1" opacity=".85" />
          {icon === "close" ? <g fill="none" stroke="var(--abyssa-status-node-icon)" strokeWidth="2.8" strokeLinecap="round"><path d="M37 21 L49 33" /><path d="M49 21 L37 33" /></g> : <path d="M34.5 27 L40.5 33 L51.5 21.5" fill="none" stroke="var(--abyssa-status-node-icon)" strokeWidth="3.4" strokeLinecap="round" strokeLinejoin="round" />}
        </svg>
      </button>
    );
  }
);

export const RetroRpgStatusNode = RpgStatusNode;
