import { useId } from "react";

export type BondCrystalState = "complete" | "current" | "locked";

export interface BondCrystalProps {
  state: BondCrystalState;
  stage?: number;
  progress?: number;
  progressMax?: number;
  textureSeed?: number;
  className?: string;
}

const romanNumerals: ReadonlyArray<readonly [number, string]> = [
  [1000, "M"], [900, "CM"], [500, "D"], [400, "CD"],
  [100, "C"], [90, "XC"], [50, "L"], [40, "XL"],
  [10, "X"], [9, "IX"], [5, "V"], [4, "IV"], [1, "I"]
];

function toRomanNumeral(value: number) {
  let remainder = Math.max(1, Math.min(3999, Math.floor(value)));
  let result = "";

  for (const [unit, numeral] of romanNumerals) {
    while (remainder >= unit) {
      result += numeral;
      remainder -= unit;
    }
  }

  return result;
}

export function BondCrystal({
  state,
  stage,
  progress = 0,
  progressMax = 100,
  textureSeed = 1,
  className
}: BondCrystalProps) {
  const uid = useId().replaceAll(":", "");
  const id = (name: string) => `${uid}-${name}`;
  const ratio = Math.max(0, Math.min(1, progress / Math.max(1, progressMax)));
  const percentage = Math.round(ratio * 100);
  const fillTop = 58 + (1 - ratio) * 160;
  const fillHeight = ratio * 160;
  const stageLabel = stage == null ? undefined : toRomanNumeral(stage);
  const classes = ["abyssa-bond-crystal", className].filter(Boolean).join(" ");

  return (
    <svg
      className={classes}
      data-highlight={state === "complete" ? "true" : "false"}
      data-progress={state === "current" ? percentage : undefined}
      data-stage={stage}
      data-state={state}
      viewBox="0 0 228 270"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <defs>
        <radialGradient id={id("inner-diamond")} cx="50%" cy="48%" r="64%">
          <stop offset="0" stopColor="var(--abyssa-bond-dark)" />
          <stop offset="0.46" stopColor="var(--abyssa-bond-low)" />
          <stop offset="1" stopColor="var(--abyssa-bond-void)" />
        </radialGradient>
        <radialGradient id={id("aura")} cx="50%" cy="50%" r="50%">
          <stop offset="0" stopColor="var(--abyssa-bond-light)" stopOpacity="0.96" />
          <stop offset="0.25" stopColor="var(--abyssa-bond-bright)" stopOpacity="0.7" />
          <stop offset="0.58" stopColor="var(--abyssa-bond-mid)" stopOpacity="0.25" />
          <stop offset="1" stopColor="var(--abyssa-bond-dark)" stopOpacity="0" />
        </radialGradient>
        <linearGradient id={id("top-left")} x1="1" y1="1" x2="0.2" y2="0">
          <stop offset="0" stopColor="var(--abyssa-bond-light)" />
          <stop offset="0.25" stopColor="var(--abyssa-bond-bright)" />
          <stop offset="1" stopColor="var(--abyssa-bond-dark)" />
        </linearGradient>
        <linearGradient id={id("top-right")} x1="0" y1="1" x2="0.8" y2="0">
          <stop offset="0" stopColor="var(--abyssa-bond-light)" />
          <stop offset="0.34" stopColor="var(--abyssa-bond-accent)" />
          <stop offset="1" stopColor="var(--abyssa-bond-low)" />
        </linearGradient>
        <linearGradient id={id("bottom-left")} x1="1" y1="0" x2="0.2" y2="1">
          <stop offset="0" stopColor="var(--abyssa-bond-bright)" />
          <stop offset="0.36" stopColor="var(--abyssa-bond-accent)" />
          <stop offset="1" stopColor="var(--abyssa-bond-dark)" />
        </linearGradient>
        <linearGradient id={id("bottom-right")} x1="0" y1="0" x2="0.8" y2="1">
          <stop offset="0" stopColor="var(--abyssa-bond-light)" />
          <stop offset="0.3" stopColor="var(--abyssa-bond-bright)" />
          <stop offset="1" stopColor="var(--abyssa-bond-dark)" />
        </linearGradient>
        <linearGradient id={id("horizontal-ray")} x1="0" y1="0.5" x2="1" y2="0.5">
          <stop offset="0" stopColor="var(--abyssa-bond-dark)" stopOpacity="0.1" />
          <stop offset="0.45" stopColor="var(--abyssa-bond-bright)" stopOpacity="0.85" />
          <stop offset="0.5" stopColor="var(--abyssa-bond-light)" />
          <stop offset="0.55" stopColor="var(--abyssa-bond-bright)" stopOpacity="0.85" />
          <stop offset="1" stopColor="var(--abyssa-bond-dark)" stopOpacity="0.1" />
        </linearGradient>
        <linearGradient
          id={id("progress-fill")}
          x1="0"
          y1="218"
          x2="0"
          y2="58"
          gradientUnits="userSpaceOnUse"
        >
          <stop offset="0" stopColor="var(--abyssa-bond-dark)" />
          <stop offset="0.58" stopColor="var(--abyssa-bond-mid)" />
          <stop offset="1" stopColor="var(--abyssa-bond-bright)" />
        </linearGradient>
        <filter id={id("soft-glow")} x="-80%" y="-80%" width="260%" height="260%">
          <feGaussianBlur stdDeviation="5.5" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
        <filter id={id("strong-glow")} x="-100%" y="-100%" width="300%" height="300%">
          <feGaussianBlur stdDeviation="3.2" result="blur1" />
          <feGaussianBlur stdDeviation="7" result="blur2" />
          <feMerge>
            <feMergeNode in="blur2" />
            <feMergeNode in="blur1" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
        <filter id={id("aged-texture")} x="-10%" y="-10%" width="120%" height="120%">
          <feTurbulence
            type="fractalNoise"
            baseFrequency="0.028 0.09"
            numOctaves="2"
            seed={textureSeed}
            result="noise"
          />
          <feColorMatrix
            in="noise"
            type="matrix"
            values="
              0 0 0 0 0.28
              0 0 0 0 0.28
              0 0 0 0 0.28
              0 0 0 .34 0
            "
          />
        </filter>
        <clipPath id={id("inner-clip")}>
          <polygon points="114,58 192,140 114,218 36,140" />
        </clipPath>
        <clipPath id={id("progress-clip")}>
          <rect x="30" y={fillTop} width="168" height={fillHeight} />
        </clipPath>
      </defs>

      <g className="abyssa-bond-crystal__frame">
        <polygon
          points="114,25 224,140 114,253 3,140"
          fill="none"
          stroke="#000"
          strokeWidth="11"
          opacity="0.62"
        />
        <polygon
          points="114,29 220,140 114,249 7,140"
          fill="none"
          stroke="var(--abyssa-bond-frame-outer)"
          strokeWidth="7"
          opacity="0.92"
        />
        <polygon
          points="114,36 212,140 114,241 15,140"
          fill="none"
          stroke="var(--abyssa-bond-frame-deep)"
          strokeWidth="5"
        />
        <polygon
          points="114,42 206,140 114,234 22,140"
          fill="none"
          stroke="var(--abyssa-bond-frame-mid)"
          strokeWidth="4"
          opacity="0.82"
        />
        <polygon
          points="114,50 199,140 114,226 29,140"
          fill={`url(#${id("inner-diamond")})`}
          stroke="var(--abyssa-bond-frame-fill)"
          strokeWidth="6"
        />
        <polygon
          points="114,58 192,140 114,218 36,140"
          fill="none"
          stroke="var(--abyssa-bond-frame-inner)"
          strokeWidth="4"
          opacity="0.78"
        />
        <polygon
          points="114,65 185,140 114,211 43,140"
          fill="none"
          stroke="var(--abyssa-bond-frame-core)"
          strokeWidth="4.5"
          opacity="0.86"
        />
      </g>

      {state === "complete" && (
        <g className="abyssa-bond-crystal__complete">
          <ellipse
            cx="114"
            cy="140"
            rx="69"
            ry="72"
            fill={`url(#${id("aura")})`}
            opacity="0.36"
            filter={`url(#${id("soft-glow")})`}
            clipPath={`url(#${id("inner-clip")})`}
          />
          <g
            fill="none"
            stroke="var(--abyssa-bond-mid)"
            strokeWidth="1.4"
            opacity="0.23"
            clipPath={`url(#${id("inner-clip")})`}
          >
            <path d="M114 67 L83 124 L44 140 L84 155 L114 211" />
            <path d="M114 67 L145 124 L184 140 L144 155 L114 211" />
            <path d="M55 140 L114 81 L174 140 L114 199 Z" />
            <path d="M72 140 L114 99 L157 140 L114 182 Z" />
          </g>
          <path
            d="M114 66 L134 120 L184 140 L137 154 L114 211 L92 156 L46 140 L92 122 Z"
            fill="var(--abyssa-bond-accent)"
            opacity="0.24"
            filter={`url(#${id("strong-glow")})`}
          />
          <path
            d="M45 140 L99 132 L114 140 L99 148 Z"
            fill={`url(#${id("horizontal-ray")})`}
            opacity="0.54"
            filter={`url(#${id("soft-glow")})`}
          />
          <path
            d="M183 140 L129 132 L114 140 L129 148 Z"
            fill={`url(#${id("horizontal-ray")})`}
            opacity="0.54"
            filter={`url(#${id("soft-glow")})`}
          />
          <g>
            <path d="M114 69 L114 140 L48 140 L94 122 Z" fill={`url(#${id("top-left")})`} opacity="0.86" />
            <path d="M114 69 L134 122 L181 140 L114 140 Z" fill={`url(#${id("top-right")})`} opacity="0.84" />
            <path d="M48 140 L94 156 L114 208 L114 140 Z" fill={`url(#${id("bottom-left")})`} opacity="0.78" />
            <path d="M181 140 L137 154 L114 208 L114 140 Z" fill={`url(#${id("bottom-right")})`} opacity="0.9" />
          </g>
          <g>
            <path d="M114 78 L114 140 L99 124 Z" fill="var(--abyssa-bond-light)" opacity="0.55" />
            <path d="M114 78 L128 124 L114 140 Z" fill="var(--abyssa-bond-accent)" opacity="0.7" />
            <path d="M58 140 L101 132 L114 140 Z" fill="var(--abyssa-bond-accent)" opacity="0.7" />
            <path d="M170 140 L127 132 L114 140 Z" fill="var(--abyssa-bond-light)" opacity="0.58" />
            <path d="M114 140 L101 155 L114 198 Z" fill="var(--abyssa-bond-mid)" opacity="0.76" />
            <path d="M114 140 L128 154 L114 198 Z" fill="var(--abyssa-bond-bright)" opacity="0.7" />
          </g>
          <ellipse
            cx="114"
            cy="140"
            rx="15"
            ry="23"
            fill="var(--abyssa-bond-light)"
            opacity="0.28"
            filter={`url(#${id("strong-glow")})`}
          />
          <circle
            cx="114"
            cy="140"
            r="5"
            fill="var(--abyssa-bond-light)"
            opacity="0.72"
            filter={`url(#${id("soft-glow")})`}
          />
          <path
            d="M114 31 L218 140 L114 247"
            fill="none"
            stroke="var(--abyssa-bond-frame-highlight)"
            strokeWidth="1.2"
            opacity="0.3"
          />
          <path
            d="M8 140 L114 31"
            fill="none"
            stroke="var(--abyssa-bond-frame-shadow)"
            strokeWidth="1.3"
            opacity="0.34"
          />
        </g>
      )}

      {state === "current" && ratio > 0 && (
        <g
          className="abyssa-bond-crystal__progress"
          clipPath={`url(#${id("inner-clip")})`}
        >
          <g clipPath={`url(#${id("progress-clip")})`}>
            <polygon
              points="114,58 192,140 114,218 36,140"
              fill={`url(#${id("progress-fill")})`}
            />
            <g fill="none" stroke="var(--abyssa-bond-bright)" strokeWidth="1.4" opacity="0.34">
              <path d="M114 67 L83 124 L44 140 L84 155 L114 211" />
              <path d="M114 67 L145 124 L184 140 L144 155 L114 211" />
              <path d="M55 140 L114 81 L174 140 L114 199 Z" />
            </g>
          </g>
        </g>
      )}

      <g
        className="abyssa-bond-crystal__patina"
        clipPath={`url(#${id("inner-clip")})`}
      >
        <rect
          x="30"
          y="54"
          width="168"
          height="172"
          filter={`url(#${id("aged-texture")})`}
          opacity={state === "locked" ? 0.42 : 0.68}
        />
        <g fill="#061113" opacity="0.26">
          <path d="M45 139 Q66 128 82 138 L71 150 Q56 153 45 139 Z" />
          <path d="M137 83 Q157 96 169 119 L151 116 Q142 103 137 83 Z" />
          <path d="M117 183 Q137 170 158 174 L143 193 Q127 199 117 183 Z" />
        </g>
        <g fill="none" stroke="var(--abyssa-bond-frame-highlight)" strokeWidth="2.4" opacity="0.28">
          <path d="M65 122 L92 131 L111 128" />
          <path d="M128 101 L150 116 L163 119" />
          <path d="M76 166 L98 158 L121 163" />
          <path d="M129 179 L146 169 L158 171" />
        </g>
      </g>

      <g
        className="abyssa-bond-crystal__frame-wear"
        fill="none"
        stroke="#071012"
        strokeWidth="5"
        strokeLinecap="round"
        opacity="0.38"
      >
        <path d="M39 107 L54 91" />
        <path d="M167 84 L181 100" />
        <path d="M181 177 L165 194" />
        <path d="M64 192 L49 176" />
      </g>

      {state !== "current" && stageLabel && (
        <text
          className="abyssa-bond-crystal__stage-mark"
          x="114"
          y="140"
          dominantBaseline="central"
          textAnchor="middle"
        >
          {stageLabel}
        </text>
      )}

      {state === "current" && (
        <text
          className="abyssa-bond-crystal__percentage"
          x="114"
          y="151"
          textAnchor="middle"
        >
          {percentage}%
        </text>
      )}
    </svg>
  );
}
