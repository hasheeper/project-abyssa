import type { CSSProperties, ReactNode } from "react";
import { cx } from "../../lib/cx";

/* 头像框。
   ------------------------------------------------------------------
   形制是**左上/右下切角的六边形**，不是圆也不是圆角矩形 ——
   与画框、菱形节点、骰面外框同属一套「切角」语汇。
   圆形头像是社交产品的语汇，放进这套木金/羊皮纸界面里会立刻显廉价。

   五层同路径描边由外向内：深框 9 → 中间色 5 → 极深 2，
   再加一圈内装饰线与左上/右下的角括号、底部三点缀饰。
   照片 inset 8.5% 落在「内 2px 极深描边」的里侧，不压住装饰线。

   颜色全部走令牌，调用方换四个变量即可换皮：
     --abyssa-avatar-fill      底色
     --abyssa-avatar-frame     外层深框
     --abyssa-avatar-middle    中间色（这层承载阵营色）
     --abyssa-avatar-deep      极深描边
     --abyssa-avatar-ornament  装饰线与缀饰

   形制取自 RP 对话头像（rp-scene/RpMessageView.tsx 的 AvatarFrameArt
   与 rp-message-layout.css 的 .abyssa-rp__avatar-photo），路径与
   inset 8.5% / object-position 50% 10% 都是那边实测调好的值。

   RP 自己**没有**改用本件：它的头像还挂着「当前发言时整框退场、
   把槽位让给气泡」那套动画，与本文件通篇的「不许重排」机制绑死
   （见 rp-message-layout.css:69-83）。为一次视觉统一去动它，
   风险远大于收益。两处形状若要改，记得一起改。 */

const AVATAR_PATH = "M22 8 H137 V122 L122 137 H8 V22 Z";
const AVATAR_INNER_PATH = "M24 16 H129 V118 L118 129 H16 V24 Z";
const AVATAR_BRACKETS = "M20 34 V20 H34 M111 129 H125 V115";

/** 照片区的裁切，复刻外框的切角。与 AVATAR_PATH 同形。 */
export const AVATAR_PHOTO_CLIP = "polygon(11% 0, 100% 0, 100% 81%, 81% 100%, 0 100%, 0 11%)";

export interface AvatarFrameArtProps {
  /** 同一路径叠两层，交叉淡入用。单独使用时省略。 */
  state?: "idle" | "active";
  className?: string;
}

/** 只有外框描边，不含照片。需要整套请用 AvatarFrame。 */
export function AvatarFrameArt({ state, className }: AvatarFrameArtProps) {
  return (
    <svg
      className={cx("abyssa-avatar__art", className)}
      data-state={state}
      viewBox="0 0 145 145"
      aria-hidden="true"
    >
      <path d={AVATAR_PATH} fill="var(--abyssa-avatar-fill)" />
      <path d={AVATAR_PATH} fill="none" stroke="var(--abyssa-avatar-frame)" strokeWidth="9" />
      <path d={AVATAR_PATH} fill="none" stroke="var(--abyssa-avatar-middle)" strokeWidth="5" />
      <path d={AVATAR_PATH} fill="none" stroke="var(--abyssa-avatar-deep)" strokeWidth="2" />
      <path
        d={AVATAR_INNER_PATH}
        fill="none"
        stroke="var(--abyssa-avatar-ornament)"
        strokeWidth="1.15"
        opacity="0.9"
      />
      <path
        d={AVATAR_BRACKETS}
        fill="none"
        stroke="var(--abyssa-avatar-ornament)"
        strokeWidth="1"
        opacity="0.75"
      />
      <g fill="var(--abyssa-avatar-ornament)">
        <circle cx="65" cy="132" r="1.1" />
        <circle cx="72.5" cy="132.5" r="1.55" />
        <circle cx="80" cy="132" r="1.1" />
      </g>
    </svg>
  );
}

export interface AvatarFrameProps {
  /** 头像图源。缺图时渲染 fallback。 */
  src?: string;
  /** 无图时的占位内容，通常是名字首字。 */
  fallback?: ReactNode;
  /** 边长（正方形）。 */
  size?: number;
  /**
   * 自定义照片区内容，优先于 src。
   * 用于素材不是方形头像、需要自己取景的场合（例如只有全身立绘的角色）。
   */
  children?: ReactNode;
  className?: string;
  style?: CSSProperties;
  "data-kind"?: string;
}

/** 外框 + 嵌入式照片的整套头像。 */
export function AvatarFrame({
  src,
  fallback,
  size,
  children,
  className,
  style,
  ...rest
}: AvatarFrameProps) {
  return (
    <span
      className={cx("abyssa-avatar", className)}
      style={size === undefined ? style : { width: size, height: size, ...style }}
      {...rest}
    >
      <AvatarFrameArt />
      <span className="abyssa-avatar__photo">
        {children ?? (src ? <img src={src} alt="" draggable={false} /> : fallback)}
      </span>
    </span>
  );
}
