import { useId } from "react";
import type { CSSProperties, SVGProps } from "react";
import {
  DEFAULT_ABYSSA_LOGO_LAYOUT,
  normalizeAbyssaLogoLayout
} from "./abyssaLogoLayout";
import type {
  AbyssaLogoLayout,
  AbyssaLogoPartId,
  AbyssaLogoPartTransform
} from "./abyssaLogoLayout";
import {
  ABYSSA_LOGO_INTRO_DURATION,
  ABYSSA_LOGO_INTRO_PIECES,
  getAbyssaLogoIntroStep
} from "./abyssaLogoIntro";
import type { AbyssaLogoIntroPieceId } from "./abyssaLogoIntro";
import wordmarkArt from "../../../assets/ui/abyssa-wordmark.svg";

/** Whether the logo paints its own dark plate, or composites onto a scene. */
export type AbyssaLogoBackground = "radial" | "none";

/** `full` keeps the authored view box; `tight` trims to the artwork. */
export type AbyssaLogoCrop = "full" | "tight";

/**
 * `tight` keeps the authored x=512 / y=492 construction axis at its exact
 * centre. Its 800 × 656 box therefore spans x=112..912 and y=164..820, with
 * enough room for the current default wordmark and ornament filter fringe.
 *
 * A layout that pushes parts outward will therefore overflow `tight` — that is
 * why `full` stays the default and why the logo studio never sets `crop`.
 */
export const ABYSSA_LOGO_VIEW_BOXES: Record<AbyssaLogoCrop, string> = {
  full: "0 112 1024 760",
  tight: "112 164 800 656"
};

export interface AbyssaLogoProps extends Omit<SVGProps<SVGSVGElement>, "onSelect"> {
  /** Per-part visual transforms. Missing values fall back to the shipped composition. */
  layout?: AbyssaLogoLayout;
  /** Marks one part in editor-like consumers without changing the exported artwork. */
  selectedPart?: AbyssaLogoPartId | null;
  /** Called when one of the eight editable groups is clicked. */
  onPartSelect?: (part: AbyssaLogoPartId) => void;
  /**
   * `radial` (default) paints the authored near-black plate, which is what the
   * standalone lockup and the logo studio need. Use `none` to composite the
   * lockup over a scene — without it the plate covers the backdrop with an
   * opaque rectangle.
   */
  background?: AbyssaLogoBackground;
  /** Trim the view box to the artwork. See `ABYSSA_LOGO_VIEW_BOXES`. */
  crop?: AbyssaLogoCrop;
  /**
   * Play the reading-order entrance animation. Off by default so the logo
   * studio and the component catalog keep rendering a static lockup.
   */
  intro?: boolean;
  title?: string;
}

const PIVOTS: Record<AbyssaLogoPartId, readonly [number, number]> = {
  stamp: [512, 492],
  sideOrnaments: [512, 395],
  titleTop: [484, 325],
  titleMiddle: [518, 387],
  titleBottom: [526, 448],
  questionMark: [684, 428],
  divider: [512, 493],
  wordmark: [512, 610]
};

function partTransform(part: AbyssaLogoPartTransform, pivot: readonly [number, number]): string {
  const [cx, cy] = pivot;
  return `translate(${part.x} ${part.y}) translate(${cx} ${cy}) rotate(${part.rotate}) scale(${part.scale}) translate(${-cx} ${-cy})`;
}

export function AbyssaLogo({
  layout = DEFAULT_ABYSSA_LOGO_LAYOUT,
  selectedPart = null,
  onPartSelect,
  background = "radial",
  crop = "full",
  intro = false,
  title = "伺候魔王也算拯救世界吗？",
  className,
  ...svgProps
}: AbyssaLogoProps) {
  const normalized = normalizeAbyssaLogoLayout(layout);
  const reactId = useId().replace(/:/g, "");
  const id = (name: string) => `abyssa-logo-${name}-${reactId}`;

  function editable(idValue: AbyssaLogoPartId) {
    const part = normalized[idValue];
    const step = intro ? getAbyssaLogoIntroStep(idValue) : null;

    /* 入场动画只加 CSS 自定义属性与 data 标记,**不碰** transform/opacity 属性:
       - SVG 的 transform 属性就是 CSS transform 属性,直接动画会把
         partTransform 的布局整个覆盖掉。keyframes 因此只动 `translate`
         (独立的变换属性,与 transform 复合而非替换)。
       - opacity 属性会被 CSS opacity 覆盖,而 stamp 的设计值是 0.37 不是 1。
         所以 keyframes 的终值是 var(--abyssa-logo-part-opacity),
         由这里注入,动画结束后与属性值一致。 */
    const introStyle = step
      ? {
          "--abyssa-logo-part-opacity": part.opacity,
          /* 部件轴心。keyframes 用它做缩放补偿:
             translate(cx*(1-k), cy*(1-k)) scale(k) 等价于「绕轴心缩放」,
             而且在 transform-origin: 0 0 下与布局矩阵可交换 ——
             详见 logo.css 入场动画一节的推导。 */
          "--abyssa-logo-pivot-x": PIVOTS[idValue][0],
          "--abyssa-logo-pivot-y": PIVOTS[idValue][1],
          animationDelay: `${step.delay}ms`,
          animationDuration: `${ABYSSA_LOGO_INTRO_DURATION[step.kind]}ms`
        }
      : null;

    return {
      "data-logo-part": idValue,
      "data-selected": selectedPart === idValue || undefined,
      "data-intro": step?.kind,
      transform: partTransform(part, PIVOTS[idValue]),
      opacity: part.opacity,
      onClick: onPartSelect ? () => onPartSelect(idValue) : undefined,
      style:
        onPartSelect || introStyle
          ? ({
              ...(onPartSelect ? { cursor: "pointer" } : null),
              ...introStyle
            } as CSSProperties)
          : undefined
    };
  }

  function introPiece(piece: AbyssaLogoIntroPieceId): CSSProperties | undefined {
    if (!intro) return undefined;
    const timing = ABYSSA_LOGO_INTRO_PIECES[piece];
    return {
      animationDelay: `${timing.delay}ms`,
      animationDuration: `${timing.duration}ms`
    };
  }

  return (
    <svg
      {...svgProps}
      className={["abyssa-logo", className].filter(Boolean).join(" ")}
      viewBox={ABYSSA_LOGO_VIEW_BOXES[crop]}
      data-background={background}
      data-crop={crop}
      data-intro={intro || undefined}
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      aria-label={title}
    >
      <defs>
        {background === "radial" && (
          <radialGradient id={id("background")} cx="50%" cy="56%" r="64%">
            <stop offset="0" stopColor="#090703" />
            <stop offset=".38" stopColor="#050301" />
            <stop offset=".72" stopColor="#020201" />
            <stop offset="1" stopColor="#000" />
          </radialGradient>
        )}
        <linearGradient id={id("ivory")} x1="0" y1="275" x2="0" y2="490" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#fffef8" />
          <stop offset=".18" stopColor="#fff9e9" />
          <stop offset=".47" stopColor="#f9ebce" />
          <stop offset=".73" stopColor="#f0d7aa" />
          <stop offset="1" stopColor="#e4bd80" />
        </linearGradient>
        <linearGradient id={id("ivory-edge")} x1="0" y1="280" x2="0" y2="490" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#b88a4d" />
          <stop offset=".55" stopColor="#8f602d" />
          <stop offset="1" stopColor="#69401b" />
        </linearGradient>
        <linearGradient id={id("crimson")} x1="0" y1="290" x2="0" y2="500" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#ff1538" />
          <stop offset=".43" stopColor="#ed002d" />
          <stop offset=".75" stopColor="#d00025" />
          <stop offset="1" stopColor="#a8001c" />
        </linearGradient>
        <linearGradient id={id("copper")} x1="270" y1="210" x2="750" y2="750" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#8b6230" />
          <stop offset=".16" stopColor="#5d3e20" />
          <stop offset=".34" stopColor="#805526" />
          <stop offset=".53" stopColor="#493019" />
          <stop offset=".72" stopColor="#755026" />
          <stop offset=".88" stopColor="#51351b" />
          <stop offset="1" stopColor="#835a2b" />
        </linearGradient>
        <linearGradient id={id("divider-pale-gold")} x1="0" y1="19" x2="0" y2="38" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#fff5d8" />
          <stop offset=".42" stopColor="#efd19a" />
          <stop offset=".72" stopColor="#d8aa68" />
          <stop offset="1" stopColor="#f4d59d" />
        </linearGradient>
        <linearGradient id={id("divider-center-gold")} x1="371" y1="9" x2="403" y2="44" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#dbc18e" />
          <stop offset=".32" stopColor="#b58c55" />
          <stop offset=".62" stopColor="#caa870" />
          <stop offset="1" stopColor="#94663a" />
        </linearGradient>
        <linearGradient id={id("divider-tip-left")} x1="12" y1="0" x2="18" y2="0" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#dfbd80" stopOpacity="0" />
          <stop offset="1" stopColor="#efd19a" stopOpacity=".68" />
        </linearGradient>
        <linearGradient id={id("divider-tip-right")} x1="760" y1="0" x2="766" y2="0" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#efd19a" stopOpacity=".68" />
          <stop offset="1" stopColor="#dfbd80" stopOpacity="0" />
        </linearGradient>
        <linearGradient id={id("fade-left")} x1="319" y1="0" x2="403" y2="0" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#dfba78" stopOpacity=".28" />
          <stop offset=".46" stopColor="#f1d8aa" stopOpacity=".58" />
          <stop offset="1" stopColor="#fff1d0" stopOpacity=".88" />
        </linearGradient>
        <linearGradient id={id("fade-right")} x1="621" y1="0" x2="705" y2="0" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#fff1d0" stopOpacity=".88" />
          <stop offset=".54" stopColor="#f1d8aa" stopOpacity=".58" />
          <stop offset="1" stopColor="#dfba78" stopOpacity=".28" />
        </linearGradient>
        <linearGradient id={id("ornament-patina")} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#dfc492" />
          <stop offset=".3" stopColor="#c19a63" />
          <stop offset=".56" stopColor="#cfad76" />
          <stop offset=".8" stopColor="#a97a44" />
          <stop offset="1" stopColor="#c39d68" />
        </linearGradient>
        <linearGradient
          id={id("wordmark-diamond-gold")}
          x1="0"
          y1="-108"
          x2="0"
          y2="32"
          gradientUnits="userSpaceOnUse"
        >
          <stop offset="0" stopColor="#ead09a" />
          <stop offset=".42" stopColor="#d8ae6f" />
          <stop offset=".74" stopColor="#c48f4a" />
          <stop offset="1" stopColor="#dfba78" />
        </linearGradient>
        <clipPath id={id("question-hook")} clipPathUnits="userSpaceOnUse">
          <rect x="4" y="0" width="150" height="130" />
        </clipPath>
        <filter id={id("ornament-paper")} x="-20%" y="-80%" width="140%" height="260%" colorInterpolationFilters="sRGB">
          <feTurbulence type="fractalNoise" baseFrequency=".025 .12" numOctaves="2" seed="19" result="grain" />
          <feGaussianBlur in="grain" stdDeviation=".18" result="softGrain" />
          <feColorMatrix in="softGrain" type="saturate" values="0" result="mono" />
          <feComponentTransfer in="mono" result="paperTone">
            <feFuncR type="linear" slope=".16" intercept=".42" />
            <feFuncG type="linear" slope=".16" intercept=".42" />
            <feFuncB type="linear" slope=".16" intercept=".42" />
            <feFuncA type="linear" slope=".1" />
          </feComponentTransfer>
          <feComposite in="paperTone" in2="SourceAlpha" operator="in" result="paper" />
          <feBlend in="SourceGraphic" in2="paper" mode="soft-light" />
        </filter>
        <filter id={id("wordmark-diamond-paper")} x="-2%" y="-2%" width="104%" height="104%" colorInterpolationFilters="sRGB">
          <feTurbulence type="fractalNoise" baseFrequency=".016 .038" numOctaves="2" seed="11" result="noise" />
          <feGaussianBlur in="noise" stdDeviation=".45" result="softNoise" />
          <feColorMatrix in="softNoise" type="saturate" values="0" result="mono" />
          <feComponentTransfer in="mono" result="lowContrast">
            <feFuncR type="linear" slope=".24" intercept=".38" />
            <feFuncG type="linear" slope=".24" intercept=".38" />
            <feFuncB type="linear" slope=".24" intercept=".38" />
            <feFuncA type="linear" slope=".10" />
          </feComponentTransfer>
          <feComposite in="lowContrast" in2="SourceAlpha" operator="in" result="paper" />
          <feBlend in="SourceGraphic" in2="paper" mode="soft-light" />
        </filter>
      </defs>

      {background === "radial" && (
        <rect y="112" width="1024" height="760" fill={`url(#${id("background")})`} />
      )}

      <g {...editable("stamp")} fill="none" stroke={`url(#${id("copper")})`} strokeLinejoin="miter">
        <path d="M512 218 750 492 512 766 274 492Z" strokeWidth="4.2" />
        <path d="M512 231 739 492 512 753 285 492Z" strokeWidth="1.45" strokeDasharray="150 13 73 9" />
        <path d="M512 249 723 492 512 735 301 492Z" strokeWidth="2.65" />
        <path d="M512 268 706 492 512 716 318 492Z" strokeWidth="1.2" />
        <path d="M512 305 665 492 512 679 359 492Z" strokeWidth="2.6" strokeDasharray="78 8 34 11 63 7" />
        <path d="M512 333 642 492 512 651 382 492Z" strokeWidth="1.15" strokeDasharray="49 7 83 11 27 8" />
        <path d="M347 312 677 672M677 312 347 672" strokeWidth="1.05" strokeDasharray="61 11 27 8" />
        <path d="M512 281V704M333 492H691" strokeWidth=".75" strokeDasharray="24 15 8 12" />
        <path d="M303 492 512 250 594 345M721 492 512 733 428 636" stroke="#a8783b" strokeWidth="1.8" strokeDasharray="112 12 47 9" />
      </g>

      <g {...editable("sideOrnaments")}>
        <path d="M319 395H403" fill="none" stroke={`url(#${id("fade-left")})`} strokeWidth="1.1" strokeLinecap="round" />
        <path d="M621 395H705" fill="none" stroke={`url(#${id("fade-right")})`} strokeWidth="1.1" strokeLinecap="round" />
        <g filter={`url(#${id("ornament-paper")})`}>
          <path
            d="M309 386.5C312 390.2 316 393.9 319 395C316 396.1 312 399.8 309 403.5C306 399.8 302 396.1 299 395C302 393.9 306 390.2 309 386.5ZM715 386.5C718 390.2 722 393.9 725 395C722 396.1 718 399.8 715 403.5C712 399.8 708 396.1 705 395C708 393.9 712 390.2 715 386.5Z"
            fill={`url(#${id("ivory")})`}
            stroke="#d4ad75"
            strokeOpacity=".48"
            strokeWidth=".45"
          />
          <path
            d="M309 390C310.8 392 313.4 394.3 315 395C313.4 395.7 310.8 398 309 400C307.2 398 304.6 395.7 303 395C304.6 394.3 307.2 392 309 390ZM715 390C716.8 392 719.4 394.3 721 395C719.4 395.7 716.8 398 715 400C713.2 398 710.6 395.7 709 395C710.6 394.3 713.2 392 715 390Z"
            fill="none"
            stroke="#fff1d2"
            strokeOpacity=".46"
            strokeWidth=".45"
          />
        </g>
      </g>

      <g
        {...editable("titleTop")}
        className="abyssa-logo__chinese"
        stroke={`url(#${id("ivory-edge")})`}
        strokeWidth=".42"
        paintOrder="stroke fill"
      >
        <g data-title-piece="top-lead" style={introPiece("titleTopLead")}>
          <text x="420" y="347" textAnchor="middle" fontSize="56" letterSpacing="-.5" fill={`url(#${id("ivory")})`}>伺候</text>
        </g>
        <g data-title-piece="top-accent" style={introPiece("titleTopAccent")}>
          <text x="540.5" y="347" textAnchor="middle" fontSize="64" letterSpacing="-1" fill={`url(#${id("crimson")})`} stroke="#700014">魔王</text>
        </g>
      </g>
      <g {...editable("titleMiddle")} className="abyssa-logo__chinese">
        <g data-title-piece="middle-bridge" style={introPiece("titleMiddleBridge")}>
          <text x="518" y="400" textAnchor="middle" fontSize="42" letterSpacing="2" fill={`url(#${id("ivory")})`} stroke={`url(#${id("ivory-edge")})`} strokeWidth=".36" paintOrder="stroke fill">也算</text>
        </g>
      </g>
      <g {...editable("titleBottom")} className="abyssa-logo__chinese">
        <g data-title-piece="bottom-lead" style={introPiece("titleBottomLead")}>
          <text x="498.25" y="468" textAnchor="middle" fill={`url(#${id("ivory")})`} stroke={`url(#${id("ivory-edge")})`} strokeWidth=".42" paintOrder="stroke fill" fontSize="62" letterSpacing="-1.1">拯救世界</text>
        </g>
        <g data-title-piece="bottom-tail" style={introPiece("titleBottomTail")}>
          <text x="648.8" y="467" textAnchor="middle" fill={`url(#${id("ivory")})`} stroke={`url(#${id("ivory-edge")})`} strokeWidth=".42" paintOrder="stroke fill" fontSize="54" letterSpacing="-.5">吗</text>
        </g>
      </g>

      <g {...editable("questionMark")}>
        <g transform="translate(645 369) scale(.51)">
          <g clipPath={`url(#${id("question-hook")})`}>
            <text
              className="abyssa-logo__question"
              x="76"
              y="172"
              textAnchor="middle"
              fontSize="154"
              fill={`url(#${id("ivory")})`}
              stroke="#8c622f"
              strokeWidth=".7"
              paintOrder="stroke fill"
            >?</text>
          </g>
          <path
            d="M76.5 164 94.5 184 76.5 204 58.5 184Z"
            transform="translate(-4 -16)"
            fill={`url(#${id("crimson")})`}
            stroke="#780015"
            strokeWidth=".8"
          />
        </g>
      </g>

      <g {...editable("divider")}>
        {/* The supplied divider uses a 778 × 58 local canvas. Offsetting it by
            (123, 466.5) keeps its centre locked to the logo's original 512 × 493 pivot. */}
        <g transform="translate(123 466.5)" shapeRendering="geometricPrecision">
          {/* 横线单独一层:它「拉开」,而三颗菱形逐个弹出后再归位。
              data-divider-piece 只在入场动画期间被 CSS 选中,静态时无副作用。 */}
          <g data-divider-piece="rule">
            <path
              d="M29 26.5H749"
              fill="none"
              stroke={`url(#${id("divider-pale-gold")})`}
              strokeWidth="1.05"
              strokeLinecap="square"
            />
            <path d="M12 26.5H18" fill="none" stroke={`url(#${id("divider-tip-left")})`} strokeWidth=".8" />
            <path d="M760 26.5H766" fill="none" stroke={`url(#${id("divider-tip-right")})`} strokeWidth=".8" />
          </g>
          <g data-divider-piece="gem-left" style={{ "--abyssa-logo-gem-x": 28, "--abyssa-logo-gem-y": 26.5 } as CSSProperties}>
            <path d="M28 20 31.2 24.1 38 26.5 31.2 28.9 28 33 24.8 28.9 18 26.5 24.8 24.1Z" fill={`url(#${id("divider-pale-gold")})`} />
          </g>
          <g data-divider-piece="gem-right" style={{ "--abyssa-logo-gem-x": 750, "--abyssa-logo-gem-y": 26.5 } as CSSProperties}>
            <path d="M750 20 753.2 24.1 760 26.5 753.2 28.9 750 33 746.8 28.9 740 26.5 746.8 24.1Z" fill={`url(#${id("divider-pale-gold")})`} />
          </g>

          <g fill={`url(#${id("ornament-patina")})`} filter={`url(#${id("ornament-paper")})`}>
            <path d="M345 23.7C346.2 24.8 348 26 349 26.5C348 27 346.2 28.2 345 29.3C343.8 28.2 342 27 341 26.5C342 26 343.8 24.8 345 23.7Z" />
            <path d="M354.3 24.1C355.3 25 356.8 26 357.6 26.5C356.8 27 355.3 28 354.3 28.9C353.3 28 351.8 27 351 26.5C351.8 26 353.3 25 354.3 24.1Z" />
            <path d="M364.2 23.1C365.5 24.4 367.4 25.8 368.4 26.5C367.4 27.2 365.5 28.6 364.2 29.9C362.9 28.6 361 27.2 360 26.5C361 25.8 362.9 24.4 364.2 23.1Z" />
            <path d="M409.8 23.1C411.1 24.4 413 25.8 414 26.5C413 27.2 411.1 28.6 409.8 29.9C408.5 28.6 406.6 27.2 405.6 26.5C406.6 25.8 408.5 24.4 409.8 23.1Z" />
            <path d="M419.7 24.1C420.7 25 422.2 26 423 26.5C422.2 27 420.7 28 419.7 28.9C418.7 28 417.2 27 416.4 26.5C417.2 26 418.7 25 419.7 24.1Z" />
            <path d="M429 23.7C430.2 24.8 432 26 433 26.5C432 27 430.2 28.2 429 29.3C427.8 28.2 426 27 425 26.5C426 26 427.8 24.8 429 23.7Z" />
          </g>

          <g data-divider-piece="gem-centre" style={{ "--abyssa-logo-gem-x": 387, "--abyssa-logo-gem-y": 26.5 } as CSSProperties}>
            <path
              d="M387 11.5C391.2 15.8 401.4 23.6 405 26.5C401.4 29.4 391.2 37.2 387 41.5C382.8 37.2 372.6 29.4 369 26.5C372.6 23.6 382.8 15.8 387 11.5Z"
              fill={`url(#${id("divider-center-gold")})`}
              filter={`url(#${id("ornament-paper")})`}
              stroke="#79512d"
              strokeOpacity=".34"
              strokeWidth=".45"
            />
            <path
              d="M387 17C389.8 19.8 396 24.7 398.5 26.5C396 28.3 389.8 33.2 387 36C384.2 33.2 378 28.3 375.5 26.5C378 24.7 384.2 19.8 387 17Z"
              fill="#030201"
              stroke="#c8a570"
              strokeOpacity=".74"
              strokeWidth=".55"
              strokeLinejoin="round"
            />
          </g>
        </g>
      </g>

      <g {...editable("wordmark")}>
        {/* 三颗菱形从原 wordmark 资源中拆出,才能逐颗弹入；嵌套 SVG 复用
            原资源的 viewBox,因此静态坐标与拆分前完全一致。 */}
        <svg
          x="139"
          y="426"
          width="783.8"
          height="281.2"
          viewBox="0 -112 1045 375"
          preserveAspectRatio="xMidYMid meet"
          pointerEvents="none"
          aria-hidden="true"
        >
          <g
            fill={`url(#${id("wordmark-diamond-gold")})`}
            stroke="#79522e"
            strokeOpacity=".38"
            strokeWidth=".55"
            strokeLinejoin="round"
            filter={`url(#${id("wordmark-diamond-paper")})`}
          >
            <g data-wordmark-gem="near" style={introPiece("wordmarkGemNear")}>
              <path d="M884 -4 893 12 884 28 875 12Z" />
            </g>
            <g data-wordmark-gem="middle" style={introPiece("wordmarkGemMiddle")}>
              <path d="M920 -47 937 -16 920 15 903 -16Z" />
            </g>
            <g data-wordmark-gem="far" style={introPiece("wordmarkGemFar")}>
              <path d="M974 -75 995 -35 974 5 953 -35Z" />
            </g>
          </g>
        </svg>

        <g data-wordmark-piece="art" style={introPiece("wordmarkArt")}>
          <rect
            x="142"
            y="521"
            width="740"
            height="165"
            fill="transparent"
            pointerEvents="all"
          />
          <image
            href={wordmarkArt}
            x="139"
            y="426"
            width="783.8"
            height="281.2"
            preserveAspectRatio="xMidYMid meet"
            pointerEvents="none"
          />
        </g>
      </g>
    </svg>
  );
}
