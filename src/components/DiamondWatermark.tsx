import { useId } from "react";
import type { SVGAttributes } from "react";
import { cx } from "../utils/cx";

export interface DiamondWatermarkOptions {
  size?: number;
  outerOpacity?: number;
  innerOpacity?: number;
  innerInset?: number;
}

export type DiamondWatermarkConfig = DiamondWatermarkOptions | false;

export interface DiamondWatermarkProps
  extends Omit<SVGAttributes<SVGSVGElement>, "id">,
    DiamondWatermarkOptions {
  /** Render a reusable SVG pattern definition or a standalone HTML overlay. */
  as?: "overlay" | "pattern";
  /** Required by consumers that reference pattern mode with url(#id). */
  id?: string;
  outerFill?: string;
  innerFill?: string;
  patternTransform?: string;
}

export interface ResolvedDiamondWatermarkOptions {
  size: number;
  outerOpacity: number;
  innerOpacity: number;
  innerInset?: number;
}

export function resolveDiamondWatermark(
  config: DiamondWatermarkConfig | undefined,
  defaults: ResolvedDiamondWatermarkOptions
): ResolvedDiamondWatermarkOptions | null {
  if (config === false) return null;
  return {
    size: config?.size ?? defaults.size,
    outerOpacity: config?.outerOpacity ?? defaults.outerOpacity,
    innerOpacity: config?.innerOpacity ?? defaults.innerOpacity,
    innerInset: config?.innerInset ?? defaults.innerInset
  };
}

/** Shared two-layer diamond watermark for SVG and HTML-backed components. */
export function DiamondWatermark({
  as = "overlay",
  id,
  size = 48,
  outerFill = "var(--abyssa-watermark-outer, rgb(255 255 255 / 3.5%))",
  innerFill = "var(--abyssa-watermark-inner, rgb(255 255 255 / 1.8%))",
  outerOpacity = 1,
  innerOpacity = 1,
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
        opacity={Math.min(Math.max(outerOpacity, 0), 1)}
        data-layer="outer"
      />
      <path
        d={`M${half} ${innerStart} L${innerEnd} ${half} L${half} ${innerEnd} L${innerStart} ${half} Z`}
        fill={innerFill}
        opacity={Math.min(Math.max(innerOpacity, 0), 1)}
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
