import { useId } from "react";

export type MetalCornerProps = {
  corner: "tl" | "tr" | "br" | "bl";
};

export function MetalCorner({ corner }: MetalCornerProps) {
  const prefix = `metal-corner-${useId().replace(/:/g, "")}`;
  const id = (name: string) => `${prefix}-${name}`;

  return (
    <svg
      className="abyssa-metal-corner"
      data-corner={corner}
      viewBox="0 0 216 198"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      focusable="false"
    >
      <defs>
        <linearGradient id={id("metal-body")} x1="12" y1="4" x2="115" y2="151" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#3c2815" />
          <stop offset=".10" stopColor="#86653a" />
          <stop offset=".26" stopColor="#b08a50" />
          <stop offset=".48" stopColor="#74532d" />
          <stop offset=".72" stopColor="#9a7440" />
          <stop offset="1" stopColor="#4b321b" />
        </linearGradient>
        <linearGradient id={id("top-rail")} x1="0" y1="0" x2="0" y2="9">
          <stop offset="0" stopColor="#2a1a0d" />
          <stop offset=".25" stopColor="#957145" />
          <stop offset=".55" stopColor="#6f5030" />
          <stop offset=".78" stopColor="#352312" />
          <stop offset="1" stopColor="#120d08" />
        </linearGradient>
        <linearGradient id={id("line-gold")} x1="25" y1="25" x2="106" y2="108" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#e0bd73" />
          <stop offset=".32" stopColor="#9e733a" />
          <stop offset=".66" stopColor="#d0a55d" />
          <stop offset="1" stopColor="#765027" />
        </linearGradient>
        <radialGradient id={id("rivet-large")} cx="34%" cy="27%" r="68%">
          <stop offset="0" stopColor="#e5c37b" />
          <stop offset=".18" stopColor="#bc9150" />
          <stop offset=".48" stopColor="#8a6333" />
          <stop offset=".78" stopColor="#4a3018" />
          <stop offset="1" stopColor="#21150b" />
        </radialGradient>
        <radialGradient id={id("rivet-small")} cx="34%" cy="28%" r="68%">
          <stop offset="0" stopColor="#e4c27a" />
          <stop offset=".20" stopColor="#b98c4b" />
          <stop offset=".54" stopColor="#79542b" />
          <stop offset=".82" stopColor="#3d2815" />
          <stop offset="1" stopColor="#1d130a" />
        </radialGradient>
        <filter id={id("rivet-shadow")} x="-50%" y="-50%" width="200%" height="200%">
          <feDropShadow dx="1.2" dy="1.8" stdDeviation="1.4" floodColor="#100a05" floodOpacity=".9" />
        </filter>
        <clipPath id={id("plate-clip")}>
          <path d="M 9 7 L 180 7 L 150 47 C 122 51, 95 56, 79 72 C 64 87, 59 105, 56 122 C 54 132, 53 138, 49 143 L 10 185 Z" />
        </clipPath>
      </defs>

      <path d="M0 0H216V8H9V198H5V7H0Z" fill={`url(#${id("top-rail")})`} stroke="#1a1109" strokeWidth="2" strokeLinejoin="miter" />
      <path
        d="M 9 7 L 180 7 L 150 47 C 122 51, 95 56, 79 72 C 64 87, 59 105, 56 122 C 54 132, 53 138, 49 143 L 10 185 Z"
        fill={`url(#${id("metal-body")})`}
        clipPath={`url(#${id("plate-clip")})`}
      />
      <path
        d="M 9 7 L 180 7 L 150 47 C 122 51, 95 56, 79 72 C 64 87, 59 105, 56 122 C 54 132, 53 138, 49 143 L 10 185 Z"
        fill="none"
        stroke="#20150b"
        strokeWidth="2.25"
        strokeLinejoin="miter"
      />
      <path
        d="M 176 10 L 147 43 C 119 48, 92 54, 76 70 C 61 85, 56 105, 53 122 C 51 133, 50 137, 46 141 L 14 176"
        fill="none"
        stroke="#c39a59"
        strokeWidth="1.1"
        opacity=".72"
      />
      <path d="M29 124V29H129" fill="none" stroke="#2a1a0d" strokeWidth="10" strokeLinecap="butt" strokeLinejoin="miter" />
      <path d="M29 123V29H129" fill="none" stroke={`url(#${id("line-gold")})`} strokeWidth="6" strokeLinecap="butt" strokeLinejoin="miter" />
      <path d="M27.5 121V27.5H128" fill="none" stroke="#efd18a" strokeWidth="1.35" strokeLinecap="butt" strokeLinejoin="miter" opacity=".75" />

      <g filter={`url(#${id("rivet-shadow")})`}>
        <circle cx="58" cy="56" r="12.2" fill="#2a1a0d" />
        <circle cx="58" cy="56" r="10.4" fill={`url(#${id("rivet-large")})`} stroke="#684722" strokeWidth="1" />
        <ellipse cx="54.8" cy="52.5" rx="3.1" ry="2.2" fill="#f0d394" opacity=".47" />
      </g>
      <g filter={`url(#${id("rivet-shadow")})`}>
        <circle cx="147" cy="26" r="7.8" fill="#28190d" />
        <circle cx="147" cy="26" r="6.2" fill={`url(#${id("rivet-small")})`} stroke="#684722" strokeWidth=".9" />
        <ellipse cx="145.2" cy="24.2" rx="1.8" ry="1.3" fill="#f0d394" opacity=".52" />
      </g>
      <g filter={`url(#${id("rivet-shadow")})`}>
        <circle cx="32" cy="142" r="7.8" fill="#28190d" />
        <circle cx="32" cy="142" r="6.2" fill={`url(#${id("rivet-small")})`} stroke="#684722" strokeWidth=".9" />
        <ellipse cx="30.2" cy="140.1" rx="1.8" ry="1.3" fill="#f0d394" opacity=".5" />
      </g>
    </svg>
  );
}
