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
  outerFill = "var(--abyssa-watermark-outer, #000)",
  innerFill = "var(--abyssa-watermark-inner, #000)",
  outerOpacity = 0.45,
  innerOpacity = 0.3,
  innerInset = size * 0.2,
  patternTransform,
  className,
  ...props
}: DiamondWatermarkProps) {
  const uid = useId().replace(/:/g, "");
  const patternId = id ?? `abyssa-diamond-watermark-${uid}`;
  const half = Number((size / 2).toFixed(3));
  const innerStart = Number(innerInset.toFixed(3));
  const diamonds = [
    { x: half, y: half, opacity: 1, key: "center" },
    { x: 0, y: 0, opacity: 0.5, key: "top-left" },
    { x: size, y: 0, opacity: 0.5, key: "top-right" },
    { x: 0, y: size, opacity: 0.5, key: "bottom-left" },
    { x: size, y: size, opacity: 0.5, key: "bottom-right" }
  ];

  const pattern = (
    <pattern
      id={patternId}
      width={size}
      height={size}
      patternUnits="userSpaceOnUse"
      patternTransform={patternTransform}
      data-watermark="double-diamond"
    >
      {diamonds.map((diamond) => (
        <g key={diamond.key} data-diamond={diamond.key}>
          <path
            d={`M${diamond.x} ${diamond.y - half} L${diamond.x + half} ${diamond.y} L${diamond.x} ${diamond.y + half} L${diamond.x - half} ${diamond.y} Z`}
            fill={outerFill}
            opacity={Math.min(Math.max(outerOpacity * diamond.opacity, 0), 1)}
            data-layer="outer"
          />
          <path
            d={`M${diamond.x} ${diamond.y - half + innerStart} L${diamond.x + half - innerStart} ${diamond.y} L${diamond.x} ${diamond.y + half - innerStart} L${diamond.x - half + innerStart} ${diamond.y} Z`}
            fill={innerFill}
            opacity={Math.min(Math.max(innerOpacity * diamond.opacity, 0), 1)}
            data-layer="inner"
          />
        </g>
      ))}
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
