import { forwardRef, useId } from "react";
import type { ButtonHTMLAttributes, ReactNode } from "react";
import type { PanelVariant } from "../types";
import { cx } from "../utils/cx";
import { DiamondWatermark } from "./DiamondWatermark";

export interface RpgSquarePanelProps
  extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: PanelVariant;
  number?: string;
  selected?: boolean;
  children?: ReactNode;
}

export const RpgSquarePanel = forwardRef<
  HTMLButtonElement,
  RpgSquarePanelProps
>(function RpgSquarePanel(
  {
    variant = "dark",
    number = "01",
    selected,
    className,
    children,
    type = "button",
    ...props
  },
  ref
) {
  const uid = useId().replace(/:/g, "");
  const patternId = `abyssa-square-watermark-${uid}`;

  return (
    <button
      ref={ref}
      type={type}
      className={cx("abyssa-square-panel", className)}
      data-variant={variant}
      data-selected={selected || undefined}
      aria-pressed={selected === undefined ? undefined : selected}
      {...props}
    >
      <svg
        viewBox="0 0 116 116"
        preserveAspectRatio="xMidYMid meet"
        aria-hidden="true"
      >
        <defs>
          <DiamondWatermark as="pattern" id={patternId} size={34} outerFill="var(--abyssa-square-pattern-outer)" innerFill="var(--abyssa-square-pattern-inner)" />
        </defs>
        <rect x="7" y="7" width="102" height="102" fill="var(--abyssa-square-fill)" />
        <rect x="7" y="7" width="102" height="102" fill={`url(#${patternId})`} />
        <rect x="7" y="7" width="102" height="102" fill="none" stroke="var(--abyssa-frame-dark)" strokeWidth="8" />
        <rect x="7" y="7" width="102" height="102" fill="none" stroke="var(--abyssa-square-middle)" strokeWidth="4" />
        <rect x="7" y="7" width="102" height="102" fill="none" stroke="var(--abyssa-frame-deep)" strokeWidth="2" />
        <rect x="14" y="14" width="88" height="88" fill="none" stroke="var(--abyssa-square-ornament)" strokeWidth="1.25" />
        <path d="M17 17 H27 L17 27 Z" fill="var(--abyssa-square-ornament)" />
        <path d="M99 99 H89 L99 89 Z" fill="var(--abyssa-square-ornament)" />
      </svg>
      <span className="abyssa-square-panel__content">{children ?? number}</span>
    </button>
  );
});

export const RetroRpgSquarePanel = RpgSquarePanel;
export type RetroRpgSquarePanelProps = RpgSquarePanelProps;
