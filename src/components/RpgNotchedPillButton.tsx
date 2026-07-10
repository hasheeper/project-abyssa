import { forwardRef, useId } from "react";
import type { ButtonHTMLAttributes } from "react";
import type { AbyssaVariant } from "../types";
import { cx } from "../utils/cx";
import { DiamondWatermark } from "./DiamondWatermark";

export interface RpgNotchedPillButtonProps
  extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, "children"> {
  label: string;
  variant?: AbyssaVariant;
  selected?: boolean;
}

const outerPath = "M24 5 H166 A19 19 0 0 1 185 24 A19 19 0 0 1 166 43 H24 A19 19 0 0 1 5 24 A19 19 0 0 1 24 5 Z";
const ornamentPath = "M25 11 H165 A13 13 0 0 1 178 24 A13 13 0 0 1 165 37 H102 L95 41 L88 37 H25 A13 13 0 0 1 12 24 A13 13 0 0 1 25 11 Z";

export const RpgNotchedPillButton = forwardRef<HTMLButtonElement, RpgNotchedPillButtonProps>(
  function RpgNotchedPillButton(
    { label, variant = "dark", selected, className, type = "button", ...props },
    ref
  ) {
    const uid = useId().replace(/:/g, "");
    const patternId = `abyssa-notched-pill-pattern-${uid}`;
    const fadeId = `abyssa-notched-pill-fade-${uid}`;
    const maskId = `abyssa-notched-pill-mask-${uid}`;
    const clipId = `abyssa-notched-pill-clip-${uid}`;

    return (
      <button ref={ref} type={type} className={cx("abyssa-notched-pill", className)} data-variant={variant} data-selected={selected || undefined} aria-label={label} aria-pressed={selected === undefined ? undefined : selected} {...props}>
        <svg viewBox="0 0 190 48" aria-hidden="true">
          <defs>
            <DiamondWatermark as="pattern" id={patternId} size={26} outerFill="var(--abyssa-notched-pattern-dark)" innerFill="var(--abyssa-notched-pattern-light)" innerInset={6} patternTransform="translate(0 -2)" />
            <linearGradient id={fadeId} x1="0" y1="0" x2="1" y2="0"><stop offset="0%" stopColor="white" /><stop offset="25%" stopColor="white" stopOpacity=".45" /><stop offset="40%" stopColor="white" stopOpacity="0" /><stop offset="60%" stopColor="white" stopOpacity="0" /><stop offset="75%" stopColor="white" stopOpacity=".45" /><stop offset="100%" stopColor="white" /></linearGradient>
            <mask id={maskId}><rect width="190" height="48" fill={`url(#${fadeId})`} /></mask>
            <clipPath id={clipId}><path d={outerPath} /></clipPath>
          </defs>
          <path d={outerPath} fill="var(--abyssa-notched-fill)" />
          <rect x="3" y="3" width="184" height="42" fill={`url(#${patternId})`} mask={`url(#${maskId})`} clipPath={`url(#${clipId})`} />
          <path d={outerPath} fill="none" stroke="var(--abyssa-frame-dark)" strokeWidth="7" strokeLinejoin="round" />
          <path d={outerPath} fill="none" stroke="var(--abyssa-notched-middle)" strokeWidth="3.7" strokeLinejoin="round" />
          <path d={outerPath} fill="none" stroke="var(--abyssa-frame-deep)" strokeWidth="1.3" strokeLinejoin="round" />
          <path d={ornamentPath} fill="none" stroke="var(--abyssa-notched-ornament)" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" opacity=".88" />
          <text className="abyssa-notched-pill__label" x="95" y="24">{label}</text>
        </svg>
      </button>
    );
  }
);

export const RetroRpgNotchedPillButton = RpgNotchedPillButton;
