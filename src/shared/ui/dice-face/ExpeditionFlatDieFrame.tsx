import { useId } from "react";
import type { CSSProperties } from "react";
import broadswordIcon from "../../../assets/icons/items/broadsword.svg";
import swapBagIcon from "../../../assets/icons/items/swap-bag.svg";
import splitCrossIcon from "../../../assets/icons/6-0-split-cross.svg";
import crossShieldIcon from "../../../assets/icons/game-icon-cross-shield.svg";
import hospitalCrossIcon from "../../../assets/icons/game-icon-hospital-cross.svg";
import magicPalmIcon from "../../../assets/icons/game-icon-magic-palm.svg";
import slashedShieldIcon from "../../../assets/icons/slashed-shield.svg";
import "./expedition-flat-die-frame.css";

export type ExpeditionDieStampAction =
  | "attack"
  | "guard"
  | "heal"
  | "coin"
  | "art"
  | "wild"
  | "blank";

export type ExpeditionDieStampLayout = {
  x: number;
  y: number;
  scale: number;
  rotate: number;
  opacity: number;
};

export type ExpeditionDieSuitShape = "diamond" | "triangle" | "square" | "circle";
export type ExpeditionDieSeal = "none" | "rust" | "plain" | "gild";

export const DEFAULT_EXPEDITION_DIE_STAMP_LAYOUT: ExpeditionDieStampLayout = {
  x: 2,
  y: 5,
  scale: 1,
  rotate: 0,
  opacity: 0.96
};

const STAMP_ICONS: Record<ExpeditionDieStampAction, string> = {
  attack: broadswordIcon,
  guard: crossShieldIcon,
  heal: hospitalCrossIcon,
  coin: swapBagIcon,
  art: magicPalmIcon,
  wild: splitCrossIcon,
  blank: slashedShieldIcon
};

const CROSS_PATH = `
  M85.873 14.444 H194.127
  C205.662 14.444 210.099 19.324 214.535 30.859
  C218.972 42.394 237.606 61.028 249.141 65.465
  C260.676 69.901 265.556 74.338 265.556 85.873
  V194.127
  C265.556 205.662 260.676 210.099 249.141 214.535
  C237.606 218.972 218.972 237.606 214.535 249.141
  C210.099 260.676 205.662 265.556 194.127 265.556
  H85.873
  C74.338 265.556 69.901 260.676 65.465 249.141
  C61.028 237.606 42.394 218.972 30.859 214.535
  C19.324 210.099 14.444 205.662 14.444 194.127
  V85.873
  C14.444 74.338 19.324 69.901 30.859 65.465
  C42.394 61.028 61.028 42.394 65.465 30.859
  C69.901 19.324 74.338 14.444 85.873 14.444 Z
`;

const FRAME_RING_PATH = `
  M8 0 H272 Q280 0 280 8 V272 Q280 280 272 280
  H8 Q0 280 0 272 V8 Q0 0 8 0 Z
  ${CROSS_PATH}
`;

export type ExpeditionFlatDieFrameProps = {
  action?: ExpeditionDieStampAction;
  fate?: number;
  power?: number;
  seal?: ExpeditionDieSeal;
  suitShape?: ExpeditionDieSuitShape;
  themeColor?: string;
  wildPip?: boolean;
  scoring?: boolean;
  layout?: ExpeditionDieStampLayout;
  textureRotation?: number;
  recessDepth?: number;
  showFrame?: boolean;
  showPanel?: boolean;
  showTexture?: boolean;
  showCorners?: boolean;
  showGuides?: boolean;
  className?: string;
  label?: string;
};

function PowerMark({
  power,
  shortWedgeId,
  longWedgeId
}: {
  power: number;
  shortWedgeId: string;
  longWedgeId: string;
}) {
  if (power === 0) {
    return <use href={`#${longWedgeId}`} transform="rotate(90 16 16)" />;
  }
  if (power === 1) return <use href={`#${shortWedgeId}`} />;
  if (power === 2) {
    return (
      <>
        <use href={`#${shortWedgeId}`} transform="translate(-3.8 -3.8)" />
        <use href={`#${shortWedgeId}`} transform="translate(3.8 3.8)" />
      </>
    );
  }
  if (power === 3) {
    return (
      <>
        <use href={`#${shortWedgeId}`} transform="translate(-6.5 -6.5)" />
        <use href={`#${shortWedgeId}`} />
        <use href={`#${shortWedgeId}`} transform="translate(6.5 6.5)" />
      </>
    );
  }
  if (power === 4) return <use href={`#${longWedgeId}`} />;
  if (power === 5) {
    return (
      <>
        <use href={`#${longWedgeId}`} transform="translate(-3 -3)" />
        <use href={`#${shortWedgeId}`} transform="translate(6 6)" />
      </>
    );
  }
  return (
    <>
      <use href={`#${longWedgeId}`} />
      <use href={`#${shortWedgeId}`} transform="translate(-6.8 -6.8)" />
      <use href={`#${shortWedgeId}`} transform="translate(6.8 6.8)" />
    </>
  );
}

function SealMark({ seal }: { seal: ExpeditionDieSeal }) {
  if (seal === "none") {
    return (
      <circle
        cx="12"
        cy="12"
        r="7.5"
        fill="none"
        stroke="var(--seal)"
        strokeWidth="2"
        strokeDasharray="3.2 3.6"
        strokeLinecap="round"
      />
    );
  }
  if (seal === "rust") {
    return (
      <>
        <path
          d="M6.2 17.8A8.2 8.2 0 0 1 17.8 6.2L15.5 8.5A5 5 0 0 0 8.5 15.5Z"
          fill="var(--seal)"
        />
        <path
          d="M19 7.4A8.2 8.2 0 0 1 7.4 19L9.7 16.7A5 5 0 0 0 16.7 9.7Z"
          fill="var(--seal)"
          transform="translate(1 1)"
        />
      </>
    );
  }
  if (seal === "plain") {
    return <circle cx="12" cy="12" r="6.2" fill="var(--seal)" />;
  }
  return (
    <path
      d="M12 2.2L14.3 9.7L21.8 12L14.3 14.3L12 21.8L9.7 14.3L2.2 12L9.7 9.7Z"
      fill="var(--seal)"
    />
  );
}

/**
 * 一张可装配进六面体的双层骰面。
 *
 * 木面位于局部 Z 轴负方向；金纸外框使用 evenodd 真镂空，不再用木色或
 * 黑色覆盖伪造孔洞。中央动词随木面一起下沉，四角信息留在最外层框面。
 */
export function ExpeditionFlatDieFrame({
  action = "attack",
  fate = 1,
  power = 1,
  seal = "plain",
  suitShape = "diamond",
  themeColor = "#bda260",
  wildPip = false,
  scoring = false,
  layout = DEFAULT_EXPEDITION_DIE_STAMP_LAYOUT,
  textureRotation = 0,
  recessDepth = 6,
  showFrame = true,
  showPanel = true,
  showTexture = true,
  showCorners = true,
  showGuides = false,
  className,
  label = "双层镂空染色象牙外框与下沉深色木面的战斗骰面"
}: ExpeditionFlatDieFrameProps) {
  const uid = useId().replace(/:/g, "");
  const panelCrossId = `expedition-panel-cross-${uid}`;
  const panelClipId = `expedition-panel-clip-${uid}`;
  const woodFiberId = `expedition-wood-fiber-${uid}`;
  const woodMottleId = `expedition-wood-mottle-${uid}`;
  const frameCrossId = `expedition-frame-cross-${uid}`;
  const frameRingId = `expedition-frame-ring-${uid}`;
  const frameIvoryId = `expedition-frame-ivory-${uid}`;
  const frameIvoryTextureId = `expedition-frame-ivory-texture-${uid}`;
  const shortWedgeId = `expedition-power-short-${uid}`;
  const longWedgeId = `expedition-power-long-${uid}`;
  const displayedFate = Math.max(1, Math.min(6, Math.round(fate)));
  const displayedPower = Math.max(0, Math.min(6, Math.round(power)));
  const fateDigits = String(displayedFate).length > 1 ? "multi" : "single";
  const fateX = suitShape === "triangle" || suitShape === "square" ? 29 : 30;
  const fateY = suitShape === "triangle" ? 33 : suitShape === "square" ? 29 : 30;
  const rootClass = ["expedition-flat-die-frame", className].filter(Boolean).join(" ");
  const rootStyle = {
    "--expedition-die-stamp-icon": `url("${STAMP_ICONS[action]}")`,
    "--expedition-die-stamp-x": `${layout.x / 2.8}%`,
    "--expedition-die-stamp-y": `${layout.y / 2.8}%`,
    "--expedition-die-stamp-scale": layout.scale,
    "--expedition-die-stamp-rotate": `${layout.rotate}deg`,
    "--expedition-die-stamp-opacity": layout.opacity,
    "--expedition-die-recess-depth": `${Math.max(0, recessDepth)}px`,
    "--expedition-die-theme-color": themeColor
  } as CSSProperties;

  return (
    <span
      className={rootClass}
      data-action={action}
      data-guides={showGuides || undefined}
      data-scoring={scoring || undefined}
      role="img"
      aria-label={label}
      style={rootStyle}
    >
      {showPanel && (
        <span className="expedition-flat-die-frame__panel-layer" aria-hidden="true">
          <svg
            className="expedition-flat-die-frame__panel-surface"
            viewBox="0 0 280 280"
            xmlns="http://www.w3.org/2000/svg"
          >
            <defs>
              <path id={panelCrossId} d={CROSS_PATH} />
              <clipPath id={panelClipId}>
                <use href={`#${panelCrossId}`} />
              </clipPath>
              <pattern id={woodFiberId} width="42" height="72" patternUnits="userSpaceOnUse">
                <path
                  d="M5 0C4 15 6 28 5 43C4 55 6 63 5 72M14 0C15 12 13 25 15 39C16 51 14 62 15 72M24 0C23 16 25 30 23 45C22 57 24 64 23 72M35 0C36 12 34 25 36 40C37 53 35 63 36 72"
                  fill="none"
                  stroke="var(--wood-fiber-dark)"
                  strokeWidth=".5"
                  opacity=".29"
                />
                <path
                  d="M9 6V20M19 34V51M29 9V27M38 46V64"
                  fill="none"
                  stroke="var(--wood-fiber-light)"
                  strokeWidth=".36"
                  opacity=".2"
                />
                <path
                  d="M2 25H7M18 15H24M27 53H33M10 63H16"
                  fill="none"
                  stroke="var(--wood-fiber-dark)"
                  strokeWidth=".45"
                  opacity=".31"
                />
                <circle cx="19" cy="26" r=".55" fill="var(--wood-fiber-dark)" opacity=".27" />
              </pattern>
              <pattern id={woodMottleId} width="104" height="98" patternUnits="userSpaceOnUse">
                <path
                  d="M8 14C19 10 31 12 38 17C31 22 19 23 8 19ZM62 64C72 58 86 59 94 64C86 69 72 70 62 67Z"
                  fill="var(--wood-fiber-dark)"
                  opacity=".08"
                />
                <path
                  d="M39 43C46 39 57 40 62 44C57 48 46 49 39 46Z"
                  fill="var(--wood-fiber-light)"
                  opacity=".055"
                />
              </pattern>
            </defs>

            <use href={`#${panelCrossId}`} fill="var(--wood-base)" />
            {showTexture && (
              <g
                className="expedition-flat-die-frame__texture"
                clipPath={`url(#${panelClipId})`}
                transform={`rotate(${textureRotation} 140 140)`}
              >
                <rect width="280" height="280" fill="var(--wood-mid)" opacity=".17" />
                <rect width="280" height="280" fill={`url(#${woodFiberId})`} />
                <rect width="280" height="280" fill={`url(#${woodMottleId})`} />
                <g fill="none" strokeLinecap="round">
                  <path d="M72 30C68 78 76 119 71 160" stroke="var(--wood-fiber-dark)" strokeWidth=".85" opacity=".3" />
                  <path d="M108 21C113 66 105 108 111 151" stroke="var(--wood-fiber-light)" strokeWidth=".45" opacity=".23" />
                  <path d="M146 18C140 65 150 109 144 156" stroke="var(--wood-fiber-dark)" strokeWidth=".7" opacity=".29" />
                  <path d="M188 23C193 69 185 109 191 154" stroke="var(--wood-fiber-light)" strokeWidth=".45" opacity=".22" />
                  <path d="M224 36C219 77 227 116 222 159" stroke="var(--wood-fiber-dark)" strokeWidth=".75" opacity=".29" />
                  <path d="M92 172C87 208 96 239 91 269" stroke="var(--wood-fiber-dark)" strokeWidth=".75" opacity=".3" />
                  <path d="M137 166C142 204 133 237 139 271" stroke="var(--wood-fiber-light)" strokeWidth=".45" opacity=".22" />
                  <path d="M184 173C178 210 188 241 182 270" stroke="var(--wood-fiber-dark)" strokeWidth=".7" opacity=".29" />
                </g>
              </g>
            )}
            <use href={`#${panelCrossId}`} fill="none" stroke="var(--wood-dark)" strokeWidth="1.6" />
          </svg>
          <i className="expedition-flat-die-frame__main-stamp" />
        </span>
      )}

      {showFrame && (
        <span className="expedition-flat-die-frame__frame-layer" aria-hidden="true">
          <svg
            className="expedition-flat-die-frame__frame-surface"
            viewBox="0 0 280 280"
            xmlns="http://www.w3.org/2000/svg"
          >
            <defs>
              <path id={frameCrossId} d={CROSS_PATH} />
              <path id={frameRingId} d={FRAME_RING_PATH} fillRule="evenodd" clipRule="evenodd" />
              <linearGradient
                id={frameIvoryId}
                x1="18"
                y1="12"
                x2="264"
                y2="270"
                gradientUnits="userSpaceOnUse"
              >
                <stop offset="0" stopColor="var(--frame-ivory-light)" />
                <stop offset=".34" stopColor="var(--frame-ivory-base)" />
                <stop offset=".72" stopColor="var(--frame-ivory-mid)" />
                <stop offset="1" stopColor="var(--frame-ivory-shadow)" />
              </linearGradient>
              <pattern id={frameIvoryTextureId} width="30" height="28" patternUnits="userSpaceOnUse">
                <path
                  d="M5 8C7 7 8 7 10 8M20 20C22 18 24 18 26 19"
                  fill="none"
                  stroke="var(--frame-fiber-light)"
                  strokeWidth=".42"
                  opacity=".18"
                />
                <path
                  d="M13 3L12 7M4 21L7 23M25 8L23 11"
                  fill="none"
                  stroke="var(--frame-fiber-dark)"
                  strokeWidth=".38"
                  opacity=".16"
                />
                <circle cx="4" cy="5" r=".42" fill="var(--frame-fiber-dark)" opacity=".18" />
                <circle cx="17" cy="13" r=".32" fill="var(--frame-fiber-dark)" opacity=".13" />
                <circle cx="27" cy="25" r=".38" fill="var(--frame-fiber-light)" opacity=".2" />
              </pattern>
              <g id={shortWedgeId}>
                <path
                  data-wedge="light"
                  d="M8 24L11.3 16.1L16.1 11.3L24 8Z"
                  fill="var(--wedge-light)"
                  stroke="var(--wedge-bevel)"
                  strokeWidth=".35"
                />
                <path data-wedge="dark" d="M8 24L15.9 20.7L20.7 15.9L24 8Z" fill="var(--wedge-dark)" />
                <path data-wedge="seam" d="M8 24L24 8" fill="none" stroke="var(--wedge-seam)" strokeWidth=".9" />
                <path
                  data-wedge="line"
                  d="M8 24L11.3 16.1L16.1 11.3L24 8L20.7 15.9L15.9 20.7Z"
                  fill="none"
                  stroke="var(--wedge-line)"
                  strokeWidth="1"
                  strokeLinejoin="round"
                />
              </g>
              <g id={longWedgeId}>
                <path
                  data-wedge="light"
                  d="M3 29L8.3 17.7L17.7 8.3L29 3Z"
                  fill="var(--wedge-light)"
                  stroke="var(--wedge-bevel)"
                  strokeWidth=".35"
                />
                <path data-wedge="dark" d="M3 29L14.3 23.7L23.7 14.3L29 3Z" fill="var(--wedge-dark)" />
                <path data-wedge="seam" d="M3 29L29 3" fill="none" stroke="var(--wedge-seam)" strokeWidth="1" />
                <path
                  data-wedge="line"
                  d="M3 29L8.3 17.7L17.7 8.3L29 3L23.7 14.3L14.3 23.7Z"
                  fill="none"
                  stroke="var(--wedge-line)"
                  strokeWidth="1"
                  strokeLinejoin="round"
                />
              </g>
            </defs>

            <use href={`#${frameRingId}`} fill={`url(#${frameIvoryId})`} fillRule="evenodd" />
            {showTexture && (
              <use
                className="expedition-flat-die-frame__texture"
                href={`#${frameRingId}`}
                fill={`url(#${frameIvoryTextureId})`}
                fillRule="evenodd"
              />
            )}
            <rect x="1.5" y="1.5" width="277" height="277" rx="6.5" fill="none" stroke="var(--frame-ivory-deep)" strokeWidth="2" />
            <rect
              x="3.5"
              y="3.5"
              width="273"
              height="273"
              rx="5.5"
              fill="none"
              stroke="var(--frame-ivory-light)"
              strokeWidth=".65"
              opacity=".42"
            />
            <use href={`#${frameCrossId}`} fill="none" stroke="var(--frame-ivory-deep)" strokeWidth="4" />
            <use href={`#${frameCrossId}`} fill="none" stroke="var(--frame-ivory-base)" strokeWidth="1.8" />
            <use
              href={`#${frameCrossId}`}
              fill="none"
              stroke="var(--frame-ivory-light)"
              strokeWidth=".5"
              opacity=".4"
            />

            {showCorners && (
              <g className="expedition-flat-die-frame__corner-slots">
                <g
                  className="expedition-flat-die-frame__suit-fate"
                  data-shape={suitShape}
                  data-digits={fateDigits}
                >
                  {suitShape === "diamond" && <path d="M30 5L55 30L30 55L5 30Z" />}
                  {suitShape === "triangle" && <path d="M29 4L51 47H7Z" />}
                  {suitShape === "square" && <path d="M9 9H49V49H9Z" />}
                  {suitShape === "circle" && <circle cx="30" cy="30" r="24" />}
                  {wildPip ? (
                    <g className="expedition-flat-die-frame__wild-pip">
                      <path d="M30 15L45 30L30 45L15 30Z" />
                      <path d="M30 20.5L39.5 30L30 39.5L20.5 30Z" />
                    </g>
                  ) : (
                    <text
                      className="expedition-flat-die-frame__fate"
                      x={fateX}
                      y={fateY}
                      textAnchor="middle"
                      dominantBaseline="central"
                      textLength={fateDigits === "multi" ? (suitShape === "triangle" ? 25 : 30) : undefined}
                      lengthAdjust="spacingAndGlyphs"
                    >
                      {displayedFate}
                    </text>
                  )}
                </g>
                <svg
                  className="expedition-flat-die-frame__seal"
                  data-seal={seal}
                  x="227"
                  y="11"
                  width="42"
                  height="42"
                  viewBox="0 0 24 24"
                  overflow="visible"
                >
                  <SealMark seal={seal} />
                </svg>
                <svg
                  className="expedition-flat-die-frame__power"
                  data-power={displayedPower}
                  x="224"
                  y="224"
                  width="54"
                  height="54"
                  viewBox="0 0 32 32"
                  overflow="visible"
                >
                  <PowerMark
                    power={displayedPower}
                    shortWedgeId={shortWedgeId}
                    longWedgeId={longWedgeId}
                  />
                </svg>
              </g>
            )}
          </svg>
        </span>
      )}

      {showGuides && (
        <span className="expedition-flat-die-frame__guides" aria-hidden="true">
          <i data-axis="x" />
          <i data-axis="y" />
          <b>280 × 280</b>
        </span>
      )}
    </span>
  );
}
