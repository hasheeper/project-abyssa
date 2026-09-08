import { useEffect, useRef, useState } from "react";
import type { CSSProperties } from "react";
import { TITLE_CG_FRAMES } from "./titleCg";
import { loadImage } from "../../shared/loading/images";

export interface TitleCgPanelProps {
  side: "left" | "right";
  /** 左右使用不同停留、首切、淡化与步长，维持原本错拍节奏。 */
  dwellMs: number;
  initialIndex?: number;
  initialDelayMs: number;
  fadeMs: number;
  step: number;
}

type Frame = { index: number; active: boolean };

/** 首屏只解码当下的 CG；下一帧提前准备，解码成功后才交叉淡化。 */
export function TitleCgPanel({ side, dwellMs, initialIndex = 0, initialDelayMs, fadeMs, step }: TitleCgPanelProps) {
  const [frames, setFrames] = useState<Frame[]>([{ index: initialIndex % TITLE_CG_FRAMES.length, active: true }]);
  const ready = useRef<(index: number, image: HTMLImageElement) => void>(() => {});
  const failed = useRef<(index: number) => void>(() => {});

  useEffect(() => {
    if (TITLE_CG_FRAMES.length < 2) return;
    const query = window.matchMedia?.("(prefers-reduced-motion: reduce)");
    let current = initialIndex % TITLE_CG_FRAMES.length;
    let candidate = current;
    let generation = 0;
    const timers = new Set<number>();
    const later = (callback: () => void, ms: number) => {
      const id = window.setTimeout(() => { timers.delete(id); callback(); }, ms);
      timers.add(id);
    };
    const stop = () => {
      generation++;
      timers.forEach(window.clearTimeout); timers.clear();
      ready.current = failed.current = () => {};
    };
    function schedule(delay: number) {
      const version = generation, due = performance.now() + delay;
      // 首切 6.2/7.6 秒，预备帧避开约 4 秒的 Logo 入场。
      later(() => {
        candidate = (candidate + step) % TITLE_CG_FRAMES.length;
        const next = candidate;
        ready.current = async (index, image) => {
          if (index !== next) return;
          ready.current = () => {};
          try { await loadImage(TITLE_CG_FRAMES[index].src, image, true); }
          catch { failed.current(next); return; }
          if (version !== generation) return;
          later(() => {
            current = next;
            setFrames(previous => previous.map(frame => ({ ...frame, active: frame.index === current })));
            later(() => setFrames([{ index: current, active: true }]), fadeMs);
            schedule(dwellMs);
          }, Math.max(32, due - performance.now()));
        };
        failed.current = index => {
          if (index !== next || version !== generation) return;
          ready.current = failed.current = () => {};
          setFrames([{ index: current, active: true }]);
          schedule(dwellMs);
        };
        setFrames([{ index: current, active: true }, { index: next, active: false }]);
      }, Math.max(0, delay - 1500));
    }
    const resume = () => {
      stop();
      setFrames([{ index: current, active: true }]);
      if (!document.hidden && !query?.matches) schedule(initialDelayMs);
    };
    resume();
    document.addEventListener("visibilitychange", resume);
    query?.addEventListener("change", resume);
    return () => {
      stop();
      document.removeEventListener("visibilitychange", resume);
      query?.removeEventListener("change", resume);
    };
  }, [initialIndex, dwellMs, initialDelayMs, fadeMs, step]);

  return (
    <div className="title-cg" data-side={side} data-initial-delay={initialDelayMs} data-playback-step={step}
      style={{ "--title-cg-fade-duration": `${fadeMs}ms` } as CSSProperties} aria-hidden="true">
      {frames.map(frame => (
        <img key={frame.index} className="title-cg__frame" src={TITLE_CG_FRAMES[frame.index].src} alt=""
          data-active={frame.active || undefined} decoding="async" loading="eager" draggable={false}
          onLoad={event => ready.current(frame.index, event.currentTarget)} onError={() => failed.current(frame.index)} />
      ))}
    </div>
  );
}
