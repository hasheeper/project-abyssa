import { useId } from "react";
import type { HTMLAttributes } from "react";
import type { AbyssaVariant } from "../types";
import { cx } from "../utils/cx";
import { DiamondWatermark } from "./DiamondWatermark";

const mainPath = [
  "M18 9 H642",
  "C624 14 612 24 603 40",
  "C596 52 593 63 592 73",
  "H383 L330 103 L277 73 H68",
  "C67 62 64 51 57 39",
  "C48 23 36 14 18 9 Z"
].join(" ");

const shadowPath = [
  "M18 13 H642",
  "C624 18 612 28 603 44",
  "C596 56 593 67 592 77",
  "H383 L330 107 L277 77 H68",
  "C67 66 64 55 57 43",
  "C48 27 36 18 18 13 Z"
].join(" ");

export interface RpgHeaderProps
  extends Omit<HTMLAttributes<HTMLElement>, "children"> {
  label: string;
  description?: string;
  variant?: AbyssaVariant;
}

export function RpgHeader({
  label,
  description,
  variant = "dark",
  className,
  ...props
}: RpgHeaderProps) {
  const id = useId().replace(/:/g, "");
  const patternId = `abyssa-header-pattern-${id}`;
  const fadeId = `abyssa-header-fade-${id}`;
  const maskId = `abyssa-header-mask-${id}`;
  const clipId = `abyssa-header-clip-${id}`;

  return (
    <header
      className={cx("abyssa-rpg-header", className)}
      data-variant={variant}
      {...props}
    >
      <svg
        viewBox="0 0 660 116"
        role="img"
        aria-label={description ? `${label}，${description}` : label}
      >
        <defs>
          <DiamondWatermark
            as="pattern"
            id={patternId}
            size={42}
            outerFill="var(--abyssa-header-pattern)"
            innerFill="rgb(255 255 255 / 3.5%)"
            innerInset={10}
          />
          <linearGradient id={fadeId} x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="white" stopOpacity="1" />
            <stop offset="24%" stopColor="white" stopOpacity=".55" />
            <stop offset="39%" stopColor="white" stopOpacity="0" />
            <stop offset="61%" stopColor="white" stopOpacity="0" />
            <stop offset="76%" stopColor="white" stopOpacity=".55" />
            <stop offset="100%" stopColor="white" stopOpacity="1" />
          </linearGradient>
          <mask id={maskId}>
            <rect width="660" height="116" fill={`url(#${fadeId})`} />
          </mask>
          <clipPath id={clipId}>
            <path d={mainPath} />
          </clipPath>
        </defs>

        <path d={shadowPath} fill="#0d1212" opacity=".72" />
        <path d={mainPath} fill="var(--abyssa-header-fill)" />
        <rect
          x="12"
          y="6"
          width="636"
          height="102"
          fill={`url(#${patternId})`}
          mask={`url(#${maskId})`}
          clipPath={`url(#${clipId})`}
        />

        <path
          d={mainPath}
          fill="none"
          stroke="var(--abyssa-frame-dark)"
          strokeWidth="7"
          strokeLinejoin="miter"
        />
        <path
          d={mainPath}
          fill="none"
          stroke="var(--abyssa-header-middle-frame)"
          strokeWidth="4"
          strokeLinejoin="miter"
        />
        <path
          d={mainPath}
          fill="none"
          stroke="var(--abyssa-frame-deep)"
          strokeWidth="2"
          strokeLinejoin="miter"
        />

        <path
          d="M39 15 H621"
          fill="none"
          stroke="var(--abyssa-header-ornament)"
          strokeWidth="1"
          opacity=".72"
        />
        <path
          d="M39 15 C52 22 61 33 67 47 C71 56 73 64 73 68"
          fill="none"
          stroke="var(--abyssa-header-ornament)"
          strokeWidth="1.25"
          opacity=".88"
        />
        <path
          d="M621 15 C608 22 599 33 593 47 C589 56 587 64 587 68"
          fill="none"
          stroke="var(--abyssa-header-ornament)"
          strokeWidth="1.25"
          opacity=".88"
        />
        <path
          d="M73 68 H283 L330 94 L377 68 H587"
          fill="none"
          stroke="var(--abyssa-header-ornament)"
          strokeWidth="1.25"
          strokeLinejoin="miter"
          opacity=".9"
        />
        <path
          d="M293 72 L330 92 L367 72"
          fill="none"
          stroke="var(--abyssa-header-ornament)"
          strokeWidth=".8"
          strokeLinejoin="miter"
          opacity=".62"
        />

        <g fill="var(--abyssa-header-ornament)">
          <circle cx="91" cy="15" r="1.25" />
          <circle cx="569" cy="15" r="1.25" />
          <circle cx="73" cy="68" r="1.25" />
          <circle cx="587" cy="68" r="1.25" />
          <path d="M316 80 L320 84 L316 88 L312 84 Z" />
          <path d="M330 88 L334 92 L330 96 L326 92 Z" />
          <path d="M344 80 L348 84 L344 88 L340 84 Z" />
        </g>

        <text
          x="330"
          y="47"
          fill="var(--abyssa-header-text)"
          fontFamily="var(--abyssa-font-display)"
          fontSize="24"
          fontWeight="500"
          letterSpacing="2.5"
          textAnchor="middle"
          dominantBaseline="middle"
        >
          {label}
        </text>
      </svg>
    </header>
  );
}

export const RetroRpgHeader = RpgHeader;
export type RetroRpgHeaderProps = RpgHeaderProps;
