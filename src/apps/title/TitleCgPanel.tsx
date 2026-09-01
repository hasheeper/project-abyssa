import { useEffect, useState } from "react";
import type { CSSProperties } from "react";
import { TITLE_CG_FRAMES } from "./titleCg";

export interface TitleCgPanelProps {
  side: "left" | "right";
  /** 停留时长。左右刻意不同,避免两侧同步闪切。 */
  dwellMs: number;
  /** 起手帧下标,右侧错开一张。 */
  initialIndex?: number;
  /** 首次换帧前的等待；它与常规停留分开,左右才能真正错拍。 */
  initialDelayMs: number;
  /** 单次交叉淡化时长。 */
  fadeMs: number;
  /** 每次跨过几帧；与帧数互质时仍会遍历全部图片。 */
  step: number;
}

/**
 * 单侧 CG 轮播。
 *
 * 所有帧都常驻 DOM,只切 opacity —— 交叉淡入必须两张同时在场,
 * 换 src 会先闪一下空白。五张都已压成轻量 WebP,常驻的代价可控。
 *
 * 只做淡入淡出,**不做滑动**:背景场本身在缓慢自转,再加位移会两种运动打架。
 */
export function TitleCgPanel({
  side,
  dwellMs,
  initialIndex = 0,
  initialDelayMs,
  fadeMs,
  step
}: TitleCgPanelProps) {
  const [index, setIndex] = useState(initialIndex % TITLE_CG_FRAMES.length);

  useEffect(() => {
    if (TITLE_CG_FRAMES.length < 2) return;

    // 尊重系统的降低动效设置:此时定格在首帧,不做轮播。
    const query = window.matchMedia?.("(prefers-reduced-motion: reduce)");
    if (query?.matches) return;

    let interval: number | undefined;
    const advance = () => {
      setIndex((current) => (current + step) % TITLE_CG_FRAMES.length);
    };

    const first = window.setTimeout(() => {
      advance();
      interval = window.setInterval(advance, dwellMs);
    }, initialDelayMs);

    return () => {
      window.clearTimeout(first);
      if (interval !== undefined) window.clearInterval(interval);
    };
  }, [dwellMs, initialDelayMs, step]);

  const playbackStyle = {
    "--title-cg-fade-duration": `${fadeMs}ms`
  } as CSSProperties;

  return (
    <div
      className="title-cg"
      data-side={side}
      data-initial-delay={initialDelayMs}
      data-playback-step={step}
      style={playbackStyle}
      aria-hidden="true"
    >
      {TITLE_CG_FRAMES.map((frame, frameIndex) => (
        <img
          key={frame.src}
          className="title-cg__frame"
          src={frame.src}
          alt=""
          data-active={frameIndex === index || undefined}
          decoding="async"
          /* 首帧要参与转场的资源等待(TransitionProvider 会等 document.images),
             所以不能用 lazy —— 否则黑幕揭开时 CG 还是空的。 */
          loading="eager"
          draggable={false}
        />
      ))}
    </div>
  );
}
