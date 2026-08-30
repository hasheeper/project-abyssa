import { useEffect, useState } from "react";
import type { RefObject } from "react";

/**
 * 固定画布的等比缩放系数。
 *
 * ============ 为什么必须由 JS 算,不能纯 CSS ============
 * 等比缩放需要一个**无量纲**系数 k = min(容器宽/画布宽, 容器高/画布高),
 * 然后 transform: scale(k)。而 CSS 的 calc() 不支持 长度÷长度→数字,
 * 所以 k 在纯 CSS 里根本算不出来。
 *
 * 曾经试过并失败的替代路线,记下来免得重走:
 *   · container query 单位(cqh):只能做 长度÷数字→长度,即把每个尺寸逐个
 *     改写成 calc(N * 100cqh / 画布高)。这要求改动内容层几百个 px 值,
 *     漏改任何一处就会「外框缩了、内容没缩」而挤在一起。shop 试点第一版
 *     就是这么翻车的,实测内容溢出 219px 被裁。
 *   · 媒体查询重排:那是「换布局」不是「等比缩小」,构图会变。
 *
 * 结论:JS 提供 k,CSS 内部一切尺寸保持设计原值不动。这是固定画布类游戏
 * UI 的标准做法,也是唯一能做到像素级还原的路径。
 *
 * ============ 为什么量测容器而不是 window ============
 * 观察容器的 contentRect,天然扣掉了容器上的 safe-area padding,
 * 刘海/小白条的让位不必在这里重复算一遍。
 */
export function useStageScale(
  ref: RefObject<HTMLElement | null>,
  canvasWidth: number,
  canvasHeight: number
): number {
  const [scale, setScale] = useState(1);

  useEffect(() => {
    const el = ref.current;
    // jsdom 没实现 ResizeObserver。测试只断言行为不断言几何,
    // 缩放停在 1 即可,不必为此引入 polyfill。
    if (!el || typeof ResizeObserver === "undefined") return;

    const observer = new ResizeObserver((entries) => {
      const box = entries[0]?.contentRect;
      if (!box || box.width === 0 || box.height === 0) return;
      setScale(Math.min(box.width / canvasWidth, box.height / canvasHeight));
    });

    observer.observe(el);
    return () => observer.disconnect();
  }, [ref, canvasWidth, canvasHeight]);

  return scale;
}
