import { forwardRef, useId } from "react";
import type { ButtonHTMLAttributes, ReactNode } from "react";
import type { AbyssaVariant } from "../types";
import { cx } from "../utils/cx";

export interface RpgNotchButtonProps
  extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, "children"> {
  label?: string;
  variant?: AbyssaVariant;
  children?: ReactNode;
}

const outerPath = "M9 9 H111 V111 H9 Z";
const ornamentPath = "M18 18 H102 V94 H72 L60 103 L48 94 H18 Z";
const secondaryPath = "M22 22 H98 V90 H70 L60 98 L50 90 H22 Z";

export const RpgNotchButton = forwardRef<HTMLButtonElement, RpgNotchButtonProps>(
  function RpgNotchButton(
    { label = "操作按钮", variant = "dark", children, className, type = "button", ...props },
    ref
  ) {
    const uid = useId().replace(/:/g, "");
    const patternId = `abyssa-notch-pattern-${uid}`;
    const fadeId = `abyssa-notch-fade-${uid}`;
    const maskId = `abyssa-notch-mask-${uid}`;
    const clipId = `abyssa-notch-clip-${uid}`;

    return (
      <button ref={ref} type={type} className={cx("abyssa-notch-button", className)} data-variant={variant} aria-label={label} {...props}>
        <svg viewBox="0 0 120 120" aria-hidden="true">
          <defs>
            <pattern id={patternId} width="28" height="28" patternUnits="userSpaceOnUse"><path d="M14 0 L28 14 L14 28 L0 14 Z" fill="var(--abyssa-notch-pattern-dark)" /><path d="M14 6 L22 14 L14 22 L6 14 Z" fill="var(--abyssa-notch-pattern-light)" /></pattern>
            <radialGradient id={fadeId} cx="50%" cy="48%" r="58%"><stop offset="18%" stopColor="white" stopOpacity="0" /><stop offset="58%" stopColor="white" stopOpacity=".25" /><stop offset="100%" stopColor="white" /></radialGradient>
            <mask id={maskId}><rect width="120" height="120" fill={`url(#${fadeId})`} /></mask>
            <clipPath id={clipId}><path d={outerPath} /></clipPath>
          </defs>
          <path d={outerPath} fill="var(--abyssa-notch-fill)" />
          <rect x="5" y="5" width="110" height="110" fill={`url(#${patternId})`} mask={`url(#${maskId})`} clipPath={`url(#${clipId})`} />
          <path d={outerPath} fill="none" stroke="var(--abyssa-frame-dark)" strokeWidth="8" strokeLinejoin="round" />
          <path d={outerPath} fill="none" stroke="var(--abyssa-notch-middle)" strokeWidth="4.2" strokeLinejoin="round" />
          <path d={outerPath} fill="none" stroke="var(--abyssa-frame-deep)" strokeWidth="1.6" strokeLinejoin="round" />
          <path d={ornamentPath} fill="none" stroke="var(--abyssa-notch-ornament)" strokeWidth="1.3" strokeLinejoin="round" strokeLinecap="round" opacity=".94" />
          <path d={secondaryPath} fill="none" stroke="var(--abyssa-notch-ornament)" strokeWidth=".7" strokeLinejoin="round" strokeLinecap="round" opacity=".48" />
          {!children && <g fill="none" stroke="var(--abyssa-notch-icon)" strokeLinecap="round" strokeLinejoin="round"><path d="M43 43 A24 24 0 1 0 77 43" strokeWidth="3.4" /><path d="M60 65 V26 M50 36 L60 26 L70 36" strokeWidth="3.4" /><g fill="var(--abyssa-notch-icon)" stroke="none"><circle cx="49" cy="75" r="2.1" /><circle cx="60" cy="75" r="2.1" /><circle cx="71" cy="75" r="2.1" /></g></g>}
        </svg>
        {children && <span className="abyssa-notch-button__custom" aria-hidden="true">{children}</span>}
      </button>
    );
  }
);

export const RetroRpgNotchButton = RpgNotchButton;
