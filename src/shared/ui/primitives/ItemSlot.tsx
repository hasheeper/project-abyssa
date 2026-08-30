import { forwardRef } from "react";
import type { ButtonHTMLAttributes, CSSProperties, HTMLAttributes } from "react";
import {
  ITEM_RARITY_LABELS,
  ITEM_RARITY_RANKS,
  normalizeItemRarity,
  type ItemRarity
} from "../items/rarity";

/* ============ 物品格位 ============
 *
 * 六层堆叠原样取自 shop 的 .abyssa-shop-detail__preview(ShopPage.tsx 里的
 * ShopItemPreview) —— 那是全库唯一一个真正"RPG 物品槽"质感的东西,已经调好:
 *   surface / halo-a / halo-b / glyph-depth / glyph / glyph-highlight + 宝石
 *
 * 图标用 **mask-image + 渐变背景**而不是 <img>。原因不是风格偏好:
 * assets 里 317 个 game-icons 是以 `?url&no-inline` 引入的 URL,走 mask 才能
 * 让 --item-rarity 渐变透过图标形状着色。换成 <img> 稀有度配色立刻失效。
 *
 * 在原版基础上补两件背包必需、商店不需要的东西:
 *   1. 数量徽标(右下角,不是行内文字)
 *   2. 空槽态 —— 网页列表没有"空位"概念,这是观感差别最大的一处
 */

export interface ItemSlotProps {
  /** 图标 URL。缺省则按空槽渲染。 */
  icon?: string;
  /** 物品名,用于无障碍名。 */
  name?: string;
  rarity?: ItemRarity | string;
  /** 数量。<= 1 时不显示徽标(单件物品不该挂 "×1")。 */
  quantity?: number;
  /** 数量单位,只进无障碍名与 title,不占视觉。 */
  unit?: string;
  selected?: boolean;
  /** 覆盖格位边长,默认取 CSS 的 76px。 */
  size?: number;
  /** 是否画稀有度宝石,默认画。 */
  showRarity?: boolean;
  className?: string;
  style?: CSSProperties;
}

export interface ItemSlotButtonProps
  extends ItemSlotProps,
    Omit<ButtonHTMLAttributes<HTMLButtonElement>, keyof ItemSlotProps | "children"> {
  /** 空槽默认不可聚焦,除非显式给了 onClick 语义。 */
  interactive?: true;
}

export interface ItemSlotStaticProps
  extends ItemSlotProps,
    Omit<HTMLAttributes<HTMLDivElement>, keyof ItemSlotProps | "children"> {
  interactive?: false;
}

function maskStyle(icon: string): CSSProperties {
  return {
    WebkitMaskImage: `url("${icon}")`,
    maskImage: `url("${icon}")`
  };
}

/** 组装无障碍名:名字 + 数量 + 单位 + 稀有度,拼成一句能读的话。 */
function buildLabel(
  name: string | undefined,
  quantity: number | undefined,
  unit: string | undefined,
  rarity: ItemRarity
): string {
  if (!name) return "空格位";
  const count = quantity != null && quantity > 1 ? ` ${quantity}${unit ?? ""}` : "";
  return `${name}${count} ${ITEM_RARITY_LABELS[rarity]}`;
}

function SlotLayers({
  icon,
  rarity,
  quantity,
  showRarity
}: {
  icon?: string;
  rarity: ItemRarity;
  quantity?: number;
  showRarity: boolean;
}) {
  if (!icon) {
    return <span data-layer="socket" aria-hidden="true" />;
  }
  const mask = maskStyle(icon);
  return (
    <>
      <span data-layer="surface" aria-hidden="true" />
      <span data-layer="halo-a" aria-hidden="true" />
      <span data-layer="halo-b" aria-hidden="true" />
      <i data-layer="glyph-depth" style={mask} aria-hidden="true" />
      <i data-layer="glyph" style={mask} aria-hidden="true" />
      <i data-layer="glyph-highlight" style={mask} aria-hidden="true" />
      {showRarity && (
        <span data-layer="rarity" aria-hidden="true">
          {Array.from({ length: ITEM_RARITY_RANKS[rarity] }, (_, index) => (
            <i key={index} />
          ))}
        </span>
      )}
      {quantity != null && quantity > 1 && (
        <span className="abyssa-item-slot__badge" aria-hidden="true">
          {quantity}
        </span>
      )}
    </>
  );
}

/** 可点击格位。背包网格用这个。 */
export const ItemSlot = forwardRef<HTMLButtonElement, ItemSlotButtonProps>(function ItemSlot(
  {
    icon,
    name,
    rarity,
    quantity,
    unit,
    selected,
    size,
    showRarity = true,
    className,
    style,
    ...rest
  },
  ref
) {
  const tier = normalizeItemRarity(rarity);
  const label = buildLabel(name, quantity, unit, tier);
  return (
    <button
      {...rest}
      ref={ref}
      type="button"
      className={["abyssa-item-slot", className].filter(Boolean).join(" ")}
      data-rarity={tier}
      data-empty={icon ? undefined : true}
      data-selected={selected || undefined}
      data-interactive=""
      aria-label={label}
      aria-pressed={selected != null ? selected : undefined}
      title={name ? `${name}${quantity != null && quantity > 1 ? ` ×${quantity}${unit ?? ""}` : ""}` : undefined}
      style={size ? { ...style, ["--slot-size" as string]: `${size}px` } : style}
    >
      <SlotLayers icon={icon} rarity={tier} quantity={quantity} showRarity={showRarity} />
    </button>
  );
});

/** 静态格位,不可点。详情侧栏的大图预览用这个。 */
export function ItemSlotStatic({
  icon,
  name,
  rarity,
  quantity,
  unit,
  size,
  showRarity = true,
  className,
  style,
  ...rest
}: ItemSlotStaticProps) {
  const tier = normalizeItemRarity(rarity);
  return (
    <div
      {...rest}
      className={["abyssa-item-slot", className].filter(Boolean).join(" ")}
      data-rarity={tier}
      data-empty={icon ? undefined : true}
      role="img"
      aria-label={buildLabel(name, quantity, unit, tier)}
      style={size ? { ...style, ["--slot-size" as string]: `${size}px` } : style}
    >
      <SlotLayers icon={icon} rarity={tier} quantity={quantity} showRarity={showRarity} />
    </div>
  );
}
