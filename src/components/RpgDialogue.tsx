import { forwardRef, useId } from "react";
import type { HTMLAttributes, ReactNode } from "react";
import { cx } from "../utils/cx";
import { DiamondWatermark, resolveDiamondWatermark } from "./DiamondWatermark";
import type { DiamondWatermarkConfig } from "./DiamondWatermark";

export type RpgDialogueVariant = "dark" | "light";

export interface RpgDialogueProps
  extends Omit<HTMLAttributes<HTMLElement>, "children"> {
  name: string;
  text?: string;
  children?: ReactNode;
  variant?: RpgDialogueVariant;
  label?: string;
  watermark?: DiamondWatermarkConfig;
}

const namePath = "M18 64 V11 H458 L468 43 C472 56 484 63 505 64 Z";
const panelPath = "M10 63 H1190 V250 H10 Z";

export const RpgDialogue = forwardRef<HTMLElement, RpgDialogueProps>(
  function RpgDialogue(
    { name, text, children, variant = "dark", label, watermark, className, ...props },
    ref
  ) {
    const uid = useId().replace(/:/g, "");
    const panelPatternId = `abyssa-dialogue-panel-pattern-${uid}`;
    const namePatternId = `abyssa-dialogue-name-pattern-${uid}`;
    const panelClipId = `abyssa-dialogue-panel-clip-${uid}`;
    const nameClipId = `abyssa-dialogue-name-clip-${uid}`;
    const content = children ?? text;
    const watermarkOptions = resolveDiamondWatermark(watermark, { size: 94, outerOpacity: 0.48, innerOpacity: 0.38, innerInset: 21 });
    const nameWatermarkSize = (watermarkOptions?.size ?? 94) * (64 / 94);

    return (
      <section
        ref={ref}
        className={cx("abyssa-dialogue", className)}
        data-variant={variant}
        aria-label={label ?? `${name}的对话`}
        {...props}
      >
        <svg viewBox="0 0 1200 260" preserveAspectRatio="none" aria-hidden="true">
          <defs>
            {watermarkOptions && <DiamondWatermark as="pattern" id={panelPatternId} outerFill="var(--abyssa-dialogue-pattern-main)" innerFill="var(--abyssa-dialogue-pattern-second)" patternTransform="translate(0 -12)" {...watermarkOptions} />}
            {watermarkOptions && <DiamondWatermark as="pattern" id={namePatternId} size={nameWatermarkSize} outerFill="rgb(255 255 255 / 2.2%)" innerFill="rgb(255 255 255 / 1.1%)" innerInset={nameWatermarkSize * (15 / 64)} outerOpacity={watermarkOptions.outerOpacity} innerOpacity={watermarkOptions.innerOpacity} />}
            <clipPath id={panelClipId}><path d={panelPath} /></clipPath>
            <clipPath id={nameClipId}><path d={namePath} /></clipPath>
          </defs>

          <path d={namePath} fill="#111515" />
          {watermarkOptions && <rect x="14" y="7" width="500" height="61" fill={`url(#${namePatternId})`} clipPath={`url(#${nameClipId})`} />}
          <path d={namePath} fill="none" stroke="var(--abyssa-frame-dark)" strokeWidth="8" strokeLinejoin="round" />
          <path d={namePath} fill="none" stroke="#667475" strokeWidth="4" strokeLinejoin="round" />
          <path d={namePath} fill="none" stroke="var(--abyssa-frame-deep)" strokeWidth="1.5" strokeLinejoin="round" />
          <path d="M29 18 H447 L454 42 C458 54 466 58 480 60" fill="none" stroke="#596465" strokeWidth="1.15" strokeLinejoin="round" opacity=".8" />
          <g fill="#596465"><circle cx="87" cy="57" r="1.1" /><circle cx="96" cy="57" r="1.45" /><circle cx="105" cy="57" r="1.1" /></g>

          <path d={panelPath} fill="var(--abyssa-dialogue-fill)" />
          {watermarkOptions && <rect x="7" y="60" width="1186" height="193" fill={`url(#${panelPatternId})`} clipPath={`url(#${panelClipId})`} />}
          <path d={panelPath} fill="none" stroke="var(--abyssa-frame-dark)" strokeWidth="9" />
          <path d={panelPath} fill="none" stroke="var(--abyssa-dialogue-middle)" strokeWidth="5" />
          <path d={panelPath} fill="none" stroke="var(--abyssa-frame-deep)" strokeWidth="2" />
          <rect x="19" y="72" width="1162" height="167" fill="none" stroke="var(--abyssa-dialogue-ornament)" strokeWidth="1.35" opacity=".92" />
          <rect x="24" y="77" width="1152" height="157" fill="none" stroke="var(--abyssa-dialogue-ornament)" strokeWidth=".65" opacity=".52" />
          <g fill="none" stroke="var(--abyssa-dialogue-ornament)" strokeLinecap="square">
            <path d="M24 94 V77 H41 M1159 77 H1176 V94 M24 217 V234 H41 M1159 234 H1176 V217" strokeWidth="1.5" />
            <path d="M29 90 V82 H37 M1163 82 H1171 V90 M29 221 V229 H37 M1163 229 H1171 V221" strokeWidth=".85" />
          </g>
          <g fill="var(--abyssa-dialogue-ornament)">
            <rect x="28" y="81" width="4" height="4" /><rect x="35" y="81" width="2" height="2" opacity=".65" />
            <rect x="1168" y="81" width="4" height="4" /><rect x="1163" y="81" width="2" height="2" opacity=".65" />
            <rect x="28" y="226" width="4" height="4" /><rect x="35" y="228" width="2" height="2" opacity=".65" />
            <rect x="1168" y="226" width="4" height="4" /><rect x="1163" y="228" width="2" height="2" opacity=".65" />
          </g>
        </svg>
        <div className="abyssa-dialogue__name">{name}</div>
        {content != null && content !== "" && <div className="abyssa-dialogue__content">{content}</div>}
      </section>
    );
  }
);

export const RetroRpgDialogue = RpgDialogue;
