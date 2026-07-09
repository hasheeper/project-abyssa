import { forwardRef, useId } from "react";
import type { ButtonHTMLAttributes } from "react";
import type { AbyssaVariant } from "../types";
import { cx } from "../utils/cx";

export type RpgShapeButtonShape = "circle" | "square" | "chamfer" | "pill";

export interface RpgShapeButtonProps
  extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, "children"> {
  label: string;
  shape?: RpgShapeButtonShape;
  variant?: AbyssaVariant;
  selected?: boolean;
}

interface ShapeGeometry {
  viewBox: string;
  patternSize: number;
  outerWidth: number;
  middleWidth: number;
  innerWidth: number;
  path?: string;
  innerPath?: string;
  texture: { x: number; y: number; width: number; height: number };
  text: { x: number; y: number };
  dots: {
    left: { x: number; y: number };
    center: { x: number; y: number };
    right: { x: number; y: number };
    sideRadius: number;
    centerRadius: number;
  };
}

const geometries: Record<RpgShapeButtonShape, ShapeGeometry> = {
  circle: {
    viewBox: "0 0 150 150",
    patternSize: 42,
    outerWidth: 9,
    middleWidth: 5,
    innerWidth: 2,
    texture: { x: 11, y: 11, width: 128, height: 128 },
    text: { x: 75, y: 75 },
    dots: {
      left: { x: 68, y: 131.5 }, center: { x: 75, y: 132 }, right: { x: 82, y: 131.5 },
      sideRadius: 1.15, centerRadius: 1.65
    }
  },
  square: {
    viewBox: "0 0 145 145",
    patternSize: 42,
    outerWidth: 9,
    middleWidth: 5,
    innerWidth: 2,
    path: "M22 8 H137 V122 L122 137 H8 V22 Z",
    innerPath: "M24 16 H129 V118 L118 129 H16 V24 Z",
    texture: { x: 8, y: 8, width: 129, height: 129 },
    text: { x: 72.5, y: 72.5 },
    dots: {
      left: { x: 65, y: 132 }, center: { x: 72.5, y: 132.5 }, right: { x: 80, y: 132 },
      sideRadius: 1.1, centerRadius: 1.55
    }
  },
  chamfer: {
    viewBox: "0 0 240 68",
    patternSize: 42,
    outerWidth: 8,
    middleWidth: 4,
    innerWidth: 2,
    path: "M20 7 H233 V49 L221 61 H7 V20 Z",
    innerPath: "M21 14 H226 V46 L218 54 H14 V22 Z",
    texture: { x: 6, y: 6, width: 228, height: 56 },
    text: { x: 120, y: 34 },
    dots: {
      left: { x: 111, y: 58 }, center: { x: 120, y: 58.5 }, right: { x: 129, y: 58 },
      sideRadius: 1, centerRadius: 1.45
    }
  },
  pill: {
    viewBox: "0 0 240 68",
    patternSize: 42,
    outerWidth: 8,
    middleWidth: 4,
    innerWidth: 2,
    path: "M28 7 H212 C225 7 233 18 233 34 C233 50 225 61 212 61 H28 C15 61 7 50 7 34 C7 18 15 7 28 7 Z",
    innerPath: "M29 14 H211 C220 14 226 22 226 34 C226 46 220 54 211 54 H29 C20 54 14 46 14 34 C14 22 20 14 29 14 Z",
    texture: { x: 7, y: 7, width: 226, height: 54 },
    text: { x: 120, y: 34 },
    dots: {
      left: { x: 111, y: 58 }, center: { x: 120, y: 58.5 }, right: { x: 129, y: 58 },
      sideRadius: 1, centerRadius: 1.45
    }
  }
};

export const RpgShapeButton = forwardRef<HTMLButtonElement, RpgShapeButtonProps>(
  function RpgShapeButton(
    {
      label,
      shape = "chamfer",
      variant = "dark",
      selected,
      className,
      type = "button",
      ...props
    },
    ref
  ) {
    const uid = useId().replace(/:/g, "");
    const patternId = `abyssa-shape-pattern-${uid}`;
    const clipId = `abyssa-shape-clip-${uid}`;
    const geometry = geometries[shape];
    const isCircle = shape === "circle";

    const shapeElement = (fill: string, stroke?: string, strokeWidth?: number) =>
      isCircle ? (
        <circle cx="75" cy="75" r="64" fill={fill} stroke={stroke} strokeWidth={strokeWidth} />
      ) : (
        <path
          d={geometry.path}
          fill={fill}
          stroke={stroke}
          strokeWidth={strokeWidth}
          strokeLinejoin={shape === "pill" ? "round" : "miter"}
        />
      );

    return (
      <button
        ref={ref}
        type={type}
        className={cx("abyssa-shape-button", className)}
        data-shape={shape}
        data-variant={variant}
        data-selected={selected || undefined}
        aria-label={label}
        aria-pressed={selected === undefined ? undefined : selected}
        {...props}
      >
        <svg viewBox={geometry.viewBox} aria-hidden="true">
          <defs>
            <pattern id={patternId} width={geometry.patternSize} height={geometry.patternSize} patternUnits="userSpaceOnUse">
              <path d="M21 0 L42 21 L21 42 L0 21 Z" fill="var(--abyssa-shape-pattern-dark)" />
              <path d="M21 10 L32 21 L21 32 L10 21 Z" fill="var(--abyssa-shape-pattern-light)" />
            </pattern>
            <clipPath id={clipId}>{shapeElement("#fff")}</clipPath>
          </defs>

          {shapeElement("var(--abyssa-shape-fill)")}
          <rect {...geometry.texture} fill={`url(#${patternId})`} clipPath={`url(#${clipId})`} />
          {shapeElement("none", "var(--abyssa-frame-dark)", geometry.outerWidth)}
          {shapeElement("none", "var(--abyssa-shape-middle)", geometry.middleWidth)}
          {shapeElement("none", "var(--abyssa-frame-deep)", geometry.innerWidth)}

          {isCircle ? (
            <circle cx="75" cy="75" r="56.5" fill="none" stroke="var(--abyssa-shape-ornament)" strokeWidth="1.15" opacity=".9" />
          ) : (
            <path d={geometry.innerPath} fill="none" stroke="var(--abyssa-shape-ornament)" strokeWidth={shape === "square" ? 1.15 : 1} strokeLinejoin={shape === "pill" ? "round" : "miter"} opacity=".9" />
          )}

          {shape === "square" && (
            <path d="M20 34 V20 H34 M111 129 H125 V115" fill="none" stroke="var(--abyssa-shape-ornament)" strokeWidth="1" opacity=".75" />
          )}

          <g fill="var(--abyssa-shape-ornament)">
            <circle cx={geometry.dots.left.x} cy={geometry.dots.left.y} r={geometry.dots.sideRadius} />
            <circle cx={geometry.dots.center.x} cy={geometry.dots.center.y} r={geometry.dots.centerRadius} />
            <circle cx={geometry.dots.right.x} cy={geometry.dots.right.y} r={geometry.dots.sideRadius} />
          </g>
          <text className="abyssa-shape-button__label" x={geometry.text.x} y={geometry.text.y}>{label}</text>
        </svg>
      </button>
    );
  }
);

export type RpgCircleButtonProps = Omit<RpgShapeButtonProps, "shape">;

export const RpgCircleButton = forwardRef<HTMLButtonElement, RpgCircleButtonProps>(
  function RpgCircleButton(props, ref) {
    return <RpgShapeButton ref={ref} shape="circle" {...props} />;
  }
);

export const RetroRpgShapeButton = RpgShapeButton;
export const RetroRpgCircleButton = RpgCircleButton;
