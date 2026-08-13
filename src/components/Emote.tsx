import { forwardRef } from "react";
import type { CSSProperties, HTMLAttributes } from "react";
import { cx } from "../utils/cx";
import { hasEmote, resolveEmotePlacement } from "./emotes";
import type { EmotePlacement } from "./emotes";

/**
 * 漫符层 —— 立绘头顶的循环 APNG。
 *
 * 挂在 .abyssa-rp__actor-beat 内部(与 PaperDoll 同级),因此:
 *   · 跟着一次性动作与持续态一起动 —— 点头时漫符随头走,这是对的,
 *     漫符在语义上「属于」这个人,固定不动会读成背景装饰。
 *   · 坐标系是立绘盒子而非席位框,换取景/换视口时数值仍然成立。
 *
 * ============ 为什么用 .png 扩展名装 APNG ============
 * APNG 靠文件内 acTL 块识别,与扩展名无关。而 .apng 不在 Vite 的静态资源
 * MIME 表里,dev server 会回 application/octet-stream,<img> 直接不渲染。
 * 用 .png 走 image/png,浏览器读到 acTL 自动按动画播放。
 */

// 与 PaperDoll 同一套路径策略:素材不打进产物,运行时按路径引用。
// dev 下文档在服务根,构建产物在 <outDir>/ 下,故相对回退一级。
const DEFAULT_EMOTE_BASE = import.meta.env.DEV ? "/src/assets/emote/" : "../src/assets/emote/";

export interface EmoteProps extends Omit<HTMLAttributes<HTMLDivElement>, "children"> {
  /** 漫符 id(对应 src/assets/emote/<id>.png)。 */
  emoteId: string;
  /** 所属角色 id —— 决定取哪一组逐角色偏移。 */
  characterId: string;
  /** 覆盖解析出的位置。studio 用它做实时预览,业务代码一般不传。 */
  placement?: Partial<EmotePlacement>;
  /**
   * 换成静态首帧。
   * 不传则跟随 prefers-reduced-motion —— 见 emote.css 里的说明:
   * APNG 无法被 JS 暂停,动效敏感者那条路径只能换图。
   */
  still?: boolean;
  /** 素材根路径,需以 `/` 结尾。 */
  emoteBaseUrl?: string;
}

export const Emote = forwardRef<HTMLDivElement, EmoteProps>(function Emote(
  { emoteId, characterId, placement, still, emoteBaseUrl = DEFAULT_EMOTE_BASE, className, style, ...props },
  ref
) {
  if (!hasEmote(emoteId)) return null;

  const p = { ...resolveEmotePlacement(characterId, emoteId), ...placement };

  return (
    <div
      ref={ref}
      className={cx("abyssa-emote", className)}
      data-emote={emoteId}
      data-still={still ? "true" : undefined}
      aria-hidden="true"
      style={
        {
          "--abyssa-emote-x": `${p.x}%`,
          "--abyssa-emote-y": `${p.y}%`,
          "--abyssa-emote-size": `${p.size}%`,
          ...style
        } as CSSProperties
      }
      {...props}
    >
      {/*
        两张图都摆在 DOM 里,由 CSS 按 prefers-reduced-motion 二选一显示。
        用 JS 读 matchMedia 再选一张也行,但那样首帧会闪一下动画版 ——
        媒体查询在样式计算阶段就生效,没有这个窗口。

        key 挂 emoteId:换漫符时强制换元素,让 APNG 从第一帧重新播。
        只改 src 的话浏览器会沿用已解码的动画进度,新漫符会从中间接上。
      */}
      <img
        key={`${emoteId}-anim`}
        className="abyssa-emote__anim"
        src={`${emoteBaseUrl}${emoteId}.png`}
        alt=""
        draggable={false}
      />
      <img
        key={`${emoteId}-still`}
        className="abyssa-emote__still"
        src={`${emoteBaseUrl}${emoteId}-still.png`}
        alt=""
        draggable={false}
      />
    </div>
  );
});
