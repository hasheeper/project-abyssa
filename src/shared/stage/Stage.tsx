import { useRef } from "react";
import type { CSSProperties, ReactNode } from "react";
import { cx } from "../lib/cx";
import { useStageScale } from "./useStageScale";

/**
 * 固定画布舞台 —— 「外 16:9 贴设备,内容等比缩放」的共享基底。
 *
 * ============ 为什么外 16:9 ============
 * 16:9 是设备形状的最优折中。按 contain 适配算有效面积:
 *              手机横屏2.17  Pixel2.22  iPad1.44  1920x1080  MBP14
 *   16:9           82.0%       80.0%      80.9%     100%      86.6%
 *   16:10          73.8%       72.0%      89.9%      90%      96.2%
 *   3:2            69.2%       67.5%      95.9%    84.4%      97.4%
 * 只有 16:9 在「手机横屏 + 桌面」两端都不低于 80%,而这正是目标场景。
 *
 * ============ 三层结构,各管一件事 ============
 *   .abyssa-stage           贴容器/视口,居中,让出安全区。缩放系数的量测源。
 *   .abyssa-stage__canvas   固定画布(默认 1600x900,精确 16:9),被 scale(k) 缩放。
 *   children                画布内的界面,一切尺寸保持设计原值。
 *
 * ============ 内容为什么一个 px 都不能改 ============
 * 整体 scale 的前提就是内容保持设计原值。凡是把内容尺寸改成视口相关单位
 * (vw / cqh)的做法,都会与外层 scale 叠加成二次缩放,构图必然漂移。
 * 详见 useStageScale.ts 顶部记录的失败路线。
 */

/**
 * 共享画布尺寸 —— 精确 16:9。
 *
 * 这是**唯一**来源。应用若需要在 JS 里参与几何计算(如满幅铺底的世界缩放),
 * 必须 import 这两个常量,不要重新写一遍 1600 / 900。
 * mansion 曾自己写 `const STAGE_WIDTH = 1600`,与这里的默认参数、
 * stage.css 的兜底值形成三份同义常量 —— 改画布尺寸得记住改三处。
 */
export const STAGE_CANVAS_WIDTH = 1600;
export const STAGE_CANVAS_HEIGHT = 900;

export interface StageProps {
  children: ReactNode;
  /** 画布宽。默认 STAGE_CANVAS_WIDTH。 */
  width?: number;
  /** 画布高。默认 STAGE_CANVAS_HEIGHT(与宽构成精确 16:9)。 */
  height?: number;
  /** 画布内的背景。挂在画布上而不是 body,底纹才会随界面缩放并止于画布边界。 */
  background?: string;
  /** 附加到画布元素,用于挂各应用自己的皮肤类。 */
  canvasClassName?: string;
  className?: string;
  style?: CSSProperties;
}

export function Stage({
  children,
  width = STAGE_CANVAS_WIDTH,
  height = STAGE_CANVAS_HEIGHT,
  background,
  canvasClassName,
  className,
  style
}: StageProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const scale = useStageScale(hostRef, width, height);

  return (
    <div className={cx("abyssa-stage", className)} style={style} ref={hostRef}>
      <div
        className={cx("abyssa-stage__canvas", canvasClassName)}
        style={
          {
            "--abyssa-stage-scale": scale,
            "--abyssa-stage-w": `${width}px`,
            "--abyssa-stage-h": `${height}px`,
            background
          } as CSSProperties
        }
      >
        {children}
      </div>
    </div>
  );
}
