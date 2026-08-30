import type { HTMLAttributes } from "react";
import { cx } from "../../lib/cx";

export type RpgFacetDiamondState = "coming" | "elapsed" | "current";

export interface RpgFacetDiamondProps extends HTMLAttributes<HTMLSpanElement> {
  label: string;
  state?: RpgFacetDiamondState;
  appearance?: "flat" | "faceted";
}

/**
 * 带方向性明暗面的金属菱形。
 *
 * 它只负责视觉，不自带 button 语义；需要交互时由调用方套在按钮里，
 * 只读刻度则可直接放进带 aria-label 的容器。这样不会为了复用样式而
 * 强迫所有菱形都变成可点击控件。
 */
export function RpgFacetDiamond({
  label,
  state = "coming",
  appearance = "faceted",
  className,
  ...props
}: RpgFacetDiamondProps) {
  const diamond = "M29 3 L55 29 L29 55 L3 29 Z";

  return (
    <span
      className={cx("abyssa-facet-diamond", className)}
      data-state={state}
      data-appearance={appearance}
      {...props}
    >
      <svg viewBox="0 0 58 58" aria-hidden="true">
        <path
          d={diamond}
          fill="#070c0d"
          opacity=".62"
          transform="translate(0 2.5)"
        />
        <path d={diamond} fill="var(--abyssa-facet-fill)" />

        {appearance === "faceted" && (
          <>
            <path d="M29 3 L55 29 L29 29 Z" fill="var(--abyssa-facet-lit)" opacity=".92" />
            <path d="M29 3 L3 29 L29 29 Z" fill="var(--abyssa-facet-lit)" opacity=".55" />
            <path d="M29 55 L55 29 L29 29 Z" fill="var(--abyssa-facet-shade)" opacity=".5" />
            <path d="M29 55 L3 29 L29 29 Z" fill="var(--abyssa-facet-shade)" opacity=".82" />
          </>
        )}

        <path
          d={diamond}
          fill="none"
          stroke="var(--abyssa-frame-dark)"
          strokeWidth="6"
          strokeLinejoin="miter"
          className="abyssa-facet-diamond__border-dark"
        />
        <path
          d={diamond}
          fill="none"
          stroke="var(--abyssa-facet-edge)"
          strokeWidth="3"
          strokeLinejoin="miter"
          className="abyssa-facet-diamond__border-edge"
        />
        <path
          d={diamond}
          fill="none"
          stroke="var(--abyssa-frame-deep)"
          strokeWidth="1.1"
          strokeLinejoin="miter"
          className="abyssa-facet-diamond__border-inner"
        />

        {appearance === "faceted" && (
          <>
            <path
              d="M29 3 L55 29"
              fill="none"
              stroke="var(--abyssa-facet-rim)"
              strokeWidth="1.5"
              strokeLinecap="round"
              opacity=".85"
            />
            <path
              d="M29 3 L3 29"
              fill="none"
              stroke="var(--abyssa-facet-rim)"
              strokeWidth="1.2"
              strokeLinecap="round"
              opacity=".55"
            />
            {state === "current" && (
              <path
                d="M29 12 L46 29 L29 46 L12 29 Z"
                fill="none"
                stroke="var(--abyssa-facet-inner)"
                strokeWidth="1"
                opacity=".62"
              />
            )}
          </>
        )}
      </svg>
      <b>{label}</b>
    </span>
  );
}
