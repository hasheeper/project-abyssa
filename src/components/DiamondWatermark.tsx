import { useId } from "react";
import type { SVGAttributes } from "react";
import { cx } from "../utils/cx";

export interface DiamondWatermarkProps
  extends Omit<SVGAttributes<SVGSVGElement>, "id"> {
  /** Render a reusable SVG pattern definition or a standalone HTML overlay. */
  as?: "overlay" | "pattern";
  /** Required by consumers that reference pattern mode with url(#id). */
  id?: string;
  size?: number;
  outerFill?: string;
  innerFill?: string;
  innerInset?: number;
  patternTransform?: string;
}

/** Shared two-layer diamond watermark for SVG and HTML-backed components. */
export function DiamondWatermark({
  as = "overlay",
  id,
  size = 48,
  outerFill = "var(--abyssa-watermark-outer, rgb(255 255 255 / 3.5%))",
  innerFill = "var(--abyssa-watermark-inner, rgb(255 255 255 / 1.8%))",
  innerInset = size * 0.24,
  patternTransform,
  className,
  ...props
}: DiamondWatermarkProps) {
  const uid = useId().replace(/:/g, "");
  const patternId = id ?? `abyssa-diamond-watermark-${uid}`;
  const half = Number((size / 2).toFixed(3));
  const innerStart = Number(innerInset.toFixed(3));
  const innerEnd = Number((size - innerInset).toFixed(3));

  const pattern = (
    <pattern
      id={patternId}
      width={size}
      height={size}
      patternUnits="userSpaceOnUse"
      patternTransform={patternTransform}
      data-watermark="double-diamond"
    >
      <path
        d={`M${half} 0 L${size} ${half} L${half} ${size} L0 ${half} Z`}
        fill={outerFill}
        data-layer="outer"
      />
      <path
        d={`M${half} ${innerStart} L${innerEnd} ${half} L${half} ${innerEnd} L${innerStart} ${half} Z`}
        fill={innerFill}
        data-layer="inner"
      />
    </pattern>
  );

  if (as === "pattern") return pattern;

  return (
    <svg
      className={cx("abyssa-diamond-watermark", className)}
      aria-hidden="true"
      focusable="false"
      data-watermark="double-diamond"
      {...props}
    >
      <defs>{pattern}</defs>
      <rect width="100%" height="100%" fill={`url(#${patternId})`} />
    </svg>
  );
}
