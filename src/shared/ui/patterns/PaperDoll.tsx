import { forwardRef, useMemo } from "react";
import type { HTMLAttributes } from "react";
import { cx } from "../../lib/cx";
import { FACE_UNDER_EYES, getExpressionParts, hasCharacter } from "./expressions";
import type { ExpressionId } from "./expressions";
import { getCalibration } from "./spriteCalibration";
import type { SpriteCalibration } from "./spriteCalibration";

/**
 * 纸娃娃立绘组件。
 *
 * 把某个角色的 `base + eyes + mouth (+ face)` 四张同尺寸全画布 PNG 绝对定位叠在一起,
 * 根据表情代号切换眼睛/嘴巴/腮红组件,从而拼出完整表情。
 *
 * 所有组件 PNG 坐标已对齐,直接层叠即可,无需任何偏移计算。
 */

// 默认路径兼容组件库现有用法；独立产品构建可通过 spriteBaseUrl
// 指向随产物复制的素材目录，避免把全部 PNG eager import 进每个入口。
const DEFAULT_SPRITE_BASE = import.meta.env.DEV ? "/src/assets/png/" : "../src/assets/png/";

function partUrl(base: string, characterId: string, part: string): string {
  return `${base}${characterId}/${part}.png`;
}

export interface PaperDollProps extends HTMLAttributes<HTMLDivElement> {
  /** 角色 id(对应 src/assets/png/<id>/ 目录)。 */
  characterId: string;
  /** 表情代号(a~n 或特殊表情),默认 "a"。 */
  expression?: ExpressionId;
  /** 立绘渲染宽度(高度按比例自适应),默认填满容器。 */
  width?: number | string;
  /** 立绘 alt 文本前缀。 */
  alt?: string;
  /**
   * 取景:full 整张全身(默认);upper 上半身(约 68%,切在大腿中部);
   * knee 保留 4/5(切在膝下,去掉脚与小腿)。
   * 三者都锚定立绘**顶部**,裁的是容器下缘,动效不会露馅。
   */
  crop?: "full" | "upper" | "knee";
  /** 覆盖逐角色校准(scale/x/y);不传则用 spriteCalibration 表里的值。 */
  calibration?: SpriteCalibration;
  /** 立绘根路径,需以 `/` 结尾。拼成 `<base><characterId>/<part>.png`。 */
  spriteBaseUrl?: string;
}

export const PaperDoll = forwardRef<HTMLDivElement, PaperDollProps>(
  function PaperDoll({ characterId, expression = "a", width, alt, crop = "full", calibration, spriteBaseUrl = DEFAULT_SPRITE_BASE, className, style, ...props }, ref) {
    const parts = getExpressionParts(characterId, expression) ?? getExpressionParts(characterId, "a");
    const cal = calibration ? { scale: 1, x: 0, y: 0, ...calibration } : getCalibration(characterId);

    // part 与 key 分开:key 变化触发换图动画,part 决定层叠顺序。
    const layers = useMemo(() => {
      if (!parts) return [] as { part: string; key: string; url: string }[];
      const keys: [string, string][] = [
        ["base", "base"],
        ["eyes", `eyes_${parts.eyes}`],
        ["mouth", `mouth_${parts.mouth}`]
      ];
      if (parts.face !== undefined) keys.push(["face", `face_${parts.face}`]);
      return keys.map(([part, key]) => ({ part, key, url: partUrl(spriteBaseUrl, characterId, key) }));
    }, [characterId, parts, spriteBaseUrl]);

    if (!hasCharacter(characterId) || layers.length === 0) return null;

    const widthStyle = width === undefined ? undefined : typeof width === "number" ? `${width}px` : width;

    return (
      <div
        ref={ref}
        className={cx("abyssa-paper-doll", className)}
        style={{ ...(widthStyle ? { width: widthStyle } : null), ...style }}
        role="img"
        aria-label={alt ?? `${characterId} 立绘`}
        data-character={characterId}
        data-expression={expression}
        data-crop={crop}
        data-face-under={FACE_UNDER_EYES.has(characterId) ? "true" : undefined}
        {...props}
      >
        <div
          className="abyssa-paper-doll__calibration"
          style={{
            transform: `translate(${cal.x * 100}%, ${cal.y * 100}%) scale(${cal.scale})`
          }}
        >
          {layers.map((layer) => (
            <img
              key={layer.key}
              className="abyssa-paper-doll__layer"
              data-part={layer.part}
              src={layer.url}
              alt=""
              draggable={false}
              aria-hidden="true"
            />
          ))}
        </div>
      </div>
    );
  }
);
