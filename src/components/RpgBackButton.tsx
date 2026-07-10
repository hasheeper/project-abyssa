import { forwardRef, useId } from "react";
import type { ButtonHTMLAttributes } from "react";
import type { AbyssaVariant } from "../types";
import { cx } from "../utils/cx";
import { DiamondWatermark } from "./DiamondWatermark";

export interface RpgBackButtonProps
  extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, "children"> {
  label?: string;
  variant?: AbyssaVariant;
}

const outerPath = "M16 14 H176 V174 Z";

export const RpgBackButton = forwardRef<HTMLButtonElement, RpgBackButtonProps>(
  function RpgBackButton(
    { label = "Back", variant = "dark", className, type = "button", ...props },
    ref
  ) {
    const uid = useId().replace(/:/g, "");
    const patternId = `abyssa-back-pattern-${uid}`;
    const clipId = `abyssa-back-clip-${uid}`;

    return (
      <button
        ref={ref}
        type={type}
        className={cx("abyssa-back-button", className)}
        data-variant={variant}
        aria-label={label}
        {...props}
      >
        <svg viewBox="0 0 190 190" aria-hidden="true">
          <defs>
            <DiamondWatermark as="pattern" id={patternId} size={42} outerFill="var(--abyssa-back-pattern-dark)" innerFill="var(--abyssa-back-pattern-light)" innerInset={10} patternTransform="translate(4 4)" />
            <clipPath id={clipId}><path d={outerPath} /></clipPath>
          </defs>

          <path d={outerPath} fill="var(--abyssa-back-fill)" />
          <rect x="12" y="10" width="168" height="168" fill={`url(#${patternId})`} clipPath={`url(#${clipId})`} />
          <path d={outerPath} fill="none" stroke="var(--abyssa-frame-dark)" strokeWidth="10" strokeLinejoin="miter" />
          <path d={outerPath} fill="none" stroke="var(--abyssa-back-middle)" strokeWidth="5" strokeLinejoin="miter" />
          <path d={outerPath} fill="none" stroke="var(--abyssa-frame-deep)" strokeWidth="2" strokeLinejoin="miter" />
          <path d="M51 35 H155 V139 Z" fill="none" stroke="var(--abyssa-back-ornament)" strokeWidth="1.5" strokeLinejoin="miter" opacity=".92" />
          <path d="M58 41 H149 V132 Z" fill="none" stroke="var(--abyssa-back-ornament)" strokeWidth=".75" strokeLinejoin="miter" opacity=".55" />
          <g fill="var(--abyssa-back-ornament)">
            <circle cx="136" cy="21" r="1" /><circle cx="148" cy="21" r="1.35" /><circle cx="160" cy="21" r="1" />
            <circle cx="169" cy="43" r="1" /><circle cx="169" cy="55" r="1.35" /><circle cx="169" cy="67" r="1" />
          </g>
          <text className="abyssa-back-button__label" x="127" y="69">{label}</text>
        </svg>
      </button>
    );
  }
);

export const RetroRpgBackButton = RpgBackButton;
