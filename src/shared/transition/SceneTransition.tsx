import type { SceneTransitionCopy, SceneTransitionPhase } from "./types";
import { RpgFrame } from "../ui/primitives/RpgFrame";

export interface SceneTransitionProps extends SceneTransitionCopy {
  phase: SceneTransitionPhase;
  className?: string;
}

/**
 * 场景级加载黑幕。
 *
 * 它故意不使用 Stage：黑幕必须覆盖刘海安全区和画布外黑边，才能在两个
 * 独立 HTML 文档之间保持同一首尾帧。视觉主体是一枚小尺寸六面骰和共享
 * RPG 组件库的小型承载牌，不把普通场景切换包装成宏大的系统启动仪式。
 */
export function SceneTransition({
  phase,
  destination = "守望者之崖",
  channel = "正在前往",
  className
}: SceneTransitionProps) {
  const active = phase !== "idle";
  const rootClass = ["scene-transition", className].filter(Boolean).join(" ");

  return (
    <>
      <div
        className={rootClass}
        data-phase={phase}
        data-active={active || undefined}
        aria-hidden="true"
      >
        <div className="scene-transition__veil" />
        <div className="scene-transition__content">
          <RpgFrame
            className="scene-transition__plaque"
            variant="dark"
            padding="none"
            ornamented
            watermark={{
              size: 34,
              outerOpacity: 0.38,
              innerOpacity: 0.2,
              innerInset: 8
            }}
          >
            <div className="scene-transition__plaque-body">
              <span className="scene-transition__plaque-index" aria-hidden="true">
                <i />
              </span>

              {/*
               * 骰子保持为六个真实 DOM 平面。不要在它或 spinner-wrap 上放
               * filter / backdrop-filter；分组滤镜会把 preserve-3d 压平。
               */}
              <div className="scene-transition__spinner-wrap">
                <div className="scene-transition__spinner">
                  <div data-plane="back" />
                  <div data-plane="right" />
                  <div data-plane="left" />
                  <div data-plane="top" />
                  <div data-plane="bottom" />
                  <div data-plane="front" />
                </div>
              </div>

              <div className="scene-transition__copy">
                <span className="scene-transition__channel">{channel}</span>
                <strong className="scene-transition__destination">{destination}</strong>
                <span className="scene-transition__activity" aria-hidden="true">
                  <i /><i /><i />
                </span>
              </div>
            </div>
          </RpgFrame>
        </div>
      </div>

      {active && (
        <span className="scene-transition__sr-status" role="status" aria-live="polite">
          正在切换至{destination}
        </span>
      )}
    </>
  );
}
