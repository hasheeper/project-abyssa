import { forwardRef, useEffect, useId, useRef, useState } from "react";
import type { CSSProperties, HTMLAttributes, ReactNode } from "react";
import { cx } from "../../lib/cx";
import { DiamondWatermark, resolveDiamondWatermark } from "./DiamondWatermark";
import type { DiamondWatermarkConfig } from "./DiamondWatermark";

export type RpgDialogueVariant = "dark" | "light";

export interface RpgDialogueProps
  extends Omit<HTMLAttributes<HTMLElement>, "children"> {
  name: string;
  /** 英文/罗马字副名,接在主名右侧作小字。牌宽会把它一并计入。 */
  secondaryName?: string;
  text?: string;
  children?: ReactNode;
  variant?: RpgDialogueVariant;
  label?: string;
  showNameplate?: boolean;
  typing?: boolean;
  typingSpeed?: number;
  /** 打字机自然走完时回调(typing=true 且 text 为字符串时才会触发)。
      配合受控 typing:父级把 typing 翻成 false 即「快进到终态」。 */
  onTypingEnd?: () => void;
  autoHeight?: boolean;
  watermark?: DiamondWatermarkConfig;
}

const panelPath = "M10 63 H1190 V250 H10 Z";

/* ---- 名牌几何(viewBox 单位,1200 宽)----
   原先是一条硬编码路径(平顶右缘钉在 458),名字再短牌子也那么宽,
   短名就孤零零飘在中间。现在牌宽由**名字实测宽度**推导:
     文字左缘 NAME_TEXT_X 固定,右侧留 NAME_PAD_R,再接 NAME_TAIL 段斜切尾。
   量测走 getBoundingClientRect 的比值(名字宽 / 组件宽),
   与画布 scale 无关 —— 两者都被同一个 transform 缩放,比值不变。 */
const NAME_LEFT = 18;
/* 文字左缘。牌左 18 + 30 内缩 —— 与牌高 53 配起来是稳的内距关系。 */
const NAME_TEXT_X = 48;
/* 名字右缘到**斜切起点**的留白。
   视觉右缘不在切角起点,也不在尾端(right+47),而在斜切段的
   视觉重心处,约 right + 47*0.34 ≈ right+16。
   等距配平时 pad_R = pad_L(30) + 16 = 46;这里刻意收到 40,
   右侧比左侧紧 6 单位 —— 斜切尾自带向右的视觉延伸,
   等距反而显得右边空,收紧后整块牌的收尾更利。 */
const NAME_PAD_R = 40;
const NAME_TAIL = 47;
const NAME_MIN_RIGHT = 150;
const NAME_MAX_RIGHT = 720;
const NAME_UNIT_PER_CHAR = 30;

/* 牌体顶边(y 11~64 = 53 单位),牌底恒为 y=64,压在面板上沿之上一格。 */
const NAME_TOP = 11;

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function nameGeometry(units: number) {
  const right = clamp(NAME_TEXT_X + units + NAME_PAD_R, NAME_MIN_RIGHT, NAME_MAX_RIGHT);
  const top = NAME_TOP;
  /* 斜切段:从右上角斜下到牌底。切角高度跟着牌高走(占 40%),
     固定值会让高牌子的切角显得过于平缓,失掉原形态的斜度。 */
  const cut = (64 - top) * 0.4;
  const shoulder = 64 - cut;
  return {
    right,
    top,
    height: 64 - top,
    /** 牌体:平顶 → 斜切 → 圆角收尾。右缘与顶边都可变,形态不变。 */
    path: `M${NAME_LEFT} 64 V${top} H${right} L${right + 10} ${shoulder} C${right + 14} ${shoulder + cut * 0.3} ${right + 26} 63 ${right + NAME_TAIL} 64 Z`,
    /** 牌内装饰内线,与牌体等距内缩。 */
    inner: `M29 ${top + 7} H${right - 11} L${right - 4} ${shoulder - 1} C${right} ${shoulder + cut * 0.28} ${right + 8} ${shoulder + cut * 0.42} ${right + 22} 60`
  };
}

function AutoDialogueFrame({ showNameplate }: { showNameplate: boolean }) {
  return (
    <span className="abyssa-dialogue__auto-frame" aria-hidden="true">
      <span data-part="surface" />
      <span data-part="outer" />
      <span data-part="middle" />
      <span data-part="inner" />
      <span data-part="rail" data-edge="top" />
      <span data-part="rail" data-edge="right" />
      <span data-part="rail" data-edge="bottom" />
      <span data-part="rail" data-edge="left" />
      <span data-part="corner" data-corner="tl" />
      <span data-part="corner" data-corner="tr" />
      <span data-part="corner" data-corner="br" />
      <span data-part="corner" data-corner="bl" />
      {showNameplate && <span data-part="nameplate" />}
    </span>
  );
}

export const RpgDialogue = forwardRef<HTMLElement, RpgDialogueProps>(
  function RpgDialogue(
    { name, secondaryName, text, children, variant = "dark", label, showNameplate = true, typing = false, typingSpeed = 28, onTypingEnd, autoHeight = false, watermark, className, ...props },
    ref
  ) {
    const uid = useId().replace(/:/g, "");
    const panelPatternId = `abyssa-dialogue-panel-pattern-${uid}`;
    const namePatternId = `abyssa-dialogue-name-pattern-${uid}`;
    const panelClipId = `abyssa-dialogue-panel-clip-${uid}`;
    const nameClipId = `abyssa-dialogue-name-clip-${uid}`;
    const content = children ?? text;
    const [displayedContent, setDisplayedContent] = useState<ReactNode>(
      typing && typeof content === "string" ? "" : content
    );

    // 回调走 ref:父级每次渲染换新函数不该重启打字机。
    const onTypingEndRef = useRef(onTypingEnd);
    onTypingEndRef.current = onTypingEnd;

    useEffect(() => {
      if (!typing || typeof content !== "string") {
        setDisplayedContent(content);
        return;
      }

      const characters = Array.from(content);
      let index = 0;
      setDisplayedContent("");
      const timer = window.setInterval(() => {
        index += 1;
        setDisplayedContent(characters.slice(0, index).join(""));
        if (index >= characters.length) {
          window.clearInterval(timer);
          onTypingEndRef.current?.();
        }
      }, typingSpeed);
      return () => window.clearInterval(timer);
    }, [content, typing, typingSpeed]);
    const watermarkOptions = resolveDiamondWatermark(watermark, { size: 94, outerOpacity: 0.48, innerOpacity: 0.38, innerInset: 21 });
    const nameWatermarkSize = (watermarkOptions?.size ?? 94) * (64 / 94);

    // —— 名牌宽度随名字长短伸缩 ——
    // 先用字数估算(首帧就接近正确,不会看到牌子突变),
    // 挂载后用实测宽度校正:量的是「名字宽 / 组件宽」的比值再乘 1200,
    // 因此与画布 scale 无关(两者同被 stage 的 transform 缩放)。
    const hostRef = useRef<HTMLElement | null>(null);
    const measureRef = useRef<HTMLSpanElement>(null);
    const [nameUnits, setNameUnits] = useState(
      () =>
        name.length * NAME_UNIT_PER_CHAR +
        (secondaryName ? secondaryName.length * NAME_UNIT_PER_CHAR * 0.42 : 0)
    );

    useEffect(() => {
      if (!showNameplate) return;
      const measure = () => {
        const inner = measureRef.current;
        const host = hostRef.current;
        if (!inner || !host) return;
        const hostWidth = host.getBoundingClientRect().width;
        if (!hostWidth) return;
        // 量 measure 层的实际盒宽:分数精度,且含子元素的 margin。
        // 不用父层 scrollWidth —— 那是整数,且父层宽度本身受牌宽约束,
        // 会把测量值系统性压小(实测少 25 单位,牌子右侧只剩 5 单位余量)。
        const ratio = inner.getBoundingClientRect().width / hostWidth;
        const units = ratio * 1200;
        if (Number.isFinite(units) && units > 0) {
          setNameUnits((prev) => (Math.abs(prev - units) > 0.5 ? units : prev));
        }
      };
      // 等一帧再量:首帧的字号/字体可能还没落定。
      const raf = requestAnimationFrame(measure);
      // 字体异步就位后重量一次,否则回退字体的宽度会被固化。
      const fonts = (document as Document & { fonts?: FontFaceSet }).fonts;
      fonts?.ready?.then(measure).catch(() => {});
      return () => cancelAnimationFrame(raf);
    }, [name, secondaryName, showNameplate]);

    const nameGeom = nameGeometry(nameUnits);

    return (
      <section
        ref={(node) => {
          hostRef.current = node;
          if (typeof ref === "function") ref(node);
          else if (ref) ref.current = node;
        }}
        className={cx("abyssa-dialogue", className)}
        data-variant={variant}
        data-nameplate={showNameplate ? "true" : "false"}
        data-auto-height={autoHeight || undefined}
        aria-label={label ?? `${name}的对话`}
        {...props}
      >
        {autoHeight ? <AutoDialogueFrame showNameplate={showNameplate} /> : <svg viewBox={showNameplate ? "0 0 1200 260" : "0 63 1200 187"} preserveAspectRatio="none" aria-hidden="true">
          <defs>
            {watermarkOptions && <DiamondWatermark as="pattern" id={panelPatternId} outerFill="var(--abyssa-dialogue-pattern-main)" innerFill="var(--abyssa-dialogue-pattern-second)" patternTransform="translate(0 -12)" {...watermarkOptions} />}
            {showNameplate && watermarkOptions && <DiamondWatermark as="pattern" id={namePatternId} size={nameWatermarkSize} outerFill="rgb(255 255 255 / 2.2%)" innerFill="rgb(255 255 255 / 1.1%)" innerInset={nameWatermarkSize * (15 / 64)} outerOpacity={watermarkOptions.outerOpacity} innerOpacity={watermarkOptions.innerOpacity} />}
            <clipPath id={panelClipId}><path d={panelPath} /></clipPath>
            {showNameplate && <clipPath id={nameClipId}><path d={nameGeom.path} /></clipPath>}
          </defs>

          {showNameplate && <>
            <path d={nameGeom.path} fill="#111515" />
            {watermarkOptions && <rect x="14" y={nameGeom.top + 3} width={nameGeom.right + NAME_TAIL - 4} height={nameGeom.height + 2} fill={`url(#${namePatternId})`} clipPath={`url(#${nameClipId})`} />}
            <path d={nameGeom.path} fill="none" stroke="var(--abyssa-frame-dark)" strokeWidth="8" strokeLinejoin="round" />
            <path d={nameGeom.path} fill="none" stroke="#667475" strokeWidth="4" strokeLinejoin="round" />
            <path d={nameGeom.path} fill="none" stroke="var(--abyssa-frame-deep)" strokeWidth="1.5" strokeLinejoin="round" />
            <path d={nameGeom.inner} fill="none" stroke="#596465" strokeWidth="1.15" strokeLinejoin="round" opacity=".8" />
            <g fill="#596465"><circle cx="87" cy="57" r="1.1" /><circle cx="96" cy="57" r="1.45" /><circle cx="105" cy="57" r="1.1" /></g>
          </>}

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
        </svg>}
        {showNameplate && (
          <div
            className="abyssa-dialogue__name"
            style={
              {
                "--abyssa-dialogue-name-max": NAME_MAX_RIGHT,
                "--abyssa-dialogue-name-top": nameGeom.top
              } as CSSProperties
            }
          >
            {/* measure 层:牌宽的量测基准。inline-flex 收缩包裹内容,
                量到的就是纯文字宽度,与牌宽无关(否则循环依赖)。 */}
            <span className="abyssa-dialogue__name-measure" ref={measureRef}>
              <span className="abyssa-dialogue__name-main">{name}</span>
              {secondaryName && (
                <span className="abyssa-dialogue__name-secondary">{secondaryName}</span>
              )}
            </span>
          </div>
        )}
        {displayedContent != null && displayedContent !== "" && <div className="abyssa-dialogue__content">{displayedContent}</div>}
      </section>
    );
  }
);

export const RetroRpgDialogue = RpgDialogue;
