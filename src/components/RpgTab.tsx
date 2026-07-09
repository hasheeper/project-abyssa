import { forwardRef, useId } from "react";
import type { ButtonHTMLAttributes } from "react";
import { cx } from "../utils/cx";

export type RpgTabVariant = "dark" | "light" | "decorated" | "teal";

export interface RpgTabProps
  extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, "children"> {
  label: string;
  variant?: RpgTabVariant;
  selected?: boolean;
}

const tabShape = "M7 78 V20 Q7 7 20 7 H160 Q173 7 173 20 V78 Z";
const tabOutline = "M7 78 V20 Q7 7 20 7 H160 Q173 7 173 20 V78";
const ornamentOutline = "M15 78 V23 Q15 15 24 15 H156 Q165 15 165 23 V78";

export const RpgTab = forwardRef<HTMLButtonElement, RpgTabProps>(
  function RpgTab(
    { label, variant = "dark", selected, className, type = "button", ...props },
    ref
  ) {
    const uid = useId().replace(/:/g, "");
    const patternId = `abyssa-tab-pattern-${uid}`;
    const clipId = `abyssa-tab-clip-${uid}`;

    return (
      <button
        ref={ref}
        type={type}
        className={cx("abyssa-rpg-tab", className)}
        data-variant={variant}
        data-selected={selected || undefined}
        aria-label={label}
        aria-pressed={selected === undefined ? undefined : selected}
        {...props}
      >
        <svg viewBox="0 0 180 78" aria-hidden="true">
          <defs>
            <pattern id={patternId} width="42" height="42" patternUnits="userSpaceOnUse" patternTransform="translate(0 -4)">
              <path d="M21 0 L42 21 L21 42 L0 21 Z" fill="var(--abyssa-tab-pattern-dark)" />
              <path d="M21 10 L32 21 L21 32 L10 21 Z" fill="var(--abyssa-tab-pattern-light)" />
            </pattern>
            <clipPath id={clipId}><path d={tabShape} /></clipPath>
          </defs>

          <path d={tabShape} fill="var(--abyssa-tab-fill)" />
          <rect x="5" y="5" width="170" height="73" fill={`url(#${patternId})`} clipPath={`url(#${clipId})`} />
          <path d={tabOutline} fill="none" stroke="var(--abyssa-frame-dark)" strokeWidth="9" strokeLinecap="butt" strokeLinejoin="round" />
          <path d={tabOutline} fill="none" stroke="var(--abyssa-tab-middle)" strokeWidth="5" strokeLinecap="butt" strokeLinejoin="round" />
          <path d={tabOutline} fill="none" stroke="var(--abyssa-frame-deep)" strokeWidth="2" strokeLinecap="butt" strokeLinejoin="round" />
          <path d={ornamentOutline} fill="none" stroke="var(--abyssa-tab-ornament)" strokeWidth="1.2" strokeLinecap="butt" opacity=".9" />
          <path d="M20 31 V21 H31 M149 21 H160 V31" fill="none" stroke="var(--abyssa-tab-ornament)" strokeWidth="1" opacity=".75" />

          <g fill="var(--abyssa-tab-ornament)">
            <circle cx="84" cy="15" r="1.1" />
            <circle cx="90" cy="15" r="1.45" />
            <circle cx="96" cy="15" r="1.1" />
          </g>
          {(variant === "decorated" || variant === "teal") && (
            <g fill="var(--abyssa-tab-ornament)">
              <circle cx="145" cy="16" r="1" />
              <circle cx="153" cy="16" r="1.5" />
              <circle cx="160" cy="20" r="1" />
            </g>
          )}
          <text className="abyssa-rpg-tab__label" x="90" y="48">{label}</text>
        </svg>
      </button>
    );
  }
);

export const RetroRpgTab = RpgTab;
