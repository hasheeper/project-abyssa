import { useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { ItemSlotStatic } from "../primitives/ItemSlot";
import { RpgModal } from "../primitives/RpgModal";
import { VerticalIndicator } from "../primitives/VerticalIndicator";
import { InventoryGrid } from "./InventoryGrid";
import type { InventoryEntry } from "./InventoryGrid";
import { ITEM_RARITY_LABELS, normalizeItemRarity } from "../items/rarity";

/* ============ 背包 / 仓储弹窗 ============
 *
 * 组装:RpgModal(遮罩 + 焦点陷阱 + 画框 + 四角金属件)
 *     + InventoryGrid(固定格数 + 空槽 + 方向键)
 *     + 详情侧栏
 *
 * 分类导轨**默认关闭**。洋馆只有 5 种产出,给 5 项加一条竖导轨是为了对称
 * 而加的装饰,不是信息需要。categories 非空时才出现。
 */

export interface InventoryCategory {
  id: string;
  label: string;
  /** 归类判定。省略则按 entry.category === id 比对。 */
  match?: (entry: InventoryEntry) => boolean;
}

export interface InventoryDialogProps {
  open: boolean;
  onClose: () => void;
  entries: InventoryEntry[];
  title?: string;
  /** 顶部名牌主名(中文)。 */
  signboard?: string;
  /** 名牌副名(罗马字)。 */
  signboardSecondary?: string;
  columns?: number;
  rows?: number;
  /** 仓储上限,显示在页脚。 */
  capacity?: number;
  categories?: InventoryCategory[];
  /** 是否显示右侧详情栏,默认 true。 */
  detail?: boolean;
  /** 详情栏底部的动作区(使用/丢弃/装备等)。 */
  renderActions?: (entry: InventoryEntry) => ReactNode;
  onActivate?: (entry: InventoryEntry) => void;
  footer?: ReactNode;
  /** 空背包时的提示语。 */
  emptyHint?: string;
  returnFocusRef?: React.RefObject<HTMLElement | null>;
}

export function InventoryDialog({
  open,
  onClose,
  entries,
  title = "物品栏",
  signboard,
  signboardSecondary,
  columns = 6,
  rows = 4,
  capacity,
  categories,
  detail = true,
  renderActions,
  onActivate,
  footer,
  emptyHint = "空无一物。",
  returnFocusRef
}: InventoryDialogProps) {
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const matcherFor = (category: InventoryCategory) =>
    category.match ?? ((entry: InventoryEntry) => entry.category === category.id);

  const visible = useMemo(() => {
    if (!categoryId || !categories) return entries;
    const category = categories.find((item) => item.id === categoryId);
    if (!category) return entries;
    return entries.filter(matcherFor(category));
  }, [categories, categoryId, entries]);

  const hasRail = categories != null && categories.length > 0;

  /** 「全部」在最前,每档带实时计数 —— 计数是分类导轨的信息价值所在,
      没有它就只是一排标签。 */
  const railItems = useMemo(
    () =>
      hasRail
        ? [
            { id: null as string | null, label: "全部", count: entries.length },
            ...categories!.map((category) => ({
              id: category.id as string | null,
              label: category.label,
              count: entries.filter(matcherFor(category)).length
            }))
          ]
        : [],
    [categories, entries, hasRail]
  );

  /* 选中项必须跟着可见集合收敛:切分类或物品被消耗后,原选中项可能已不在
     列表里,此时详情栏会显示一个不存在的东西。 */
  useEffect(() => {
    if (selectedId && !visible.some((entry) => entry.id === selectedId)) {
      setSelectedId(null);
    }
  }, [selectedId, visible]);

  // 关闭时复位,下次打开是干净状态。
  useEffect(() => {
    if (!open) {
      setSelectedId(null);
      setCategoryId(null);
    }
  }, [open]);

  const selected = visible.find((entry) => entry.id === selectedId) ?? null;

  return (
    <RpgModal
      open={open}
      onClose={onClose}
      title={title}
      signboard={signboard}
      signboardSecondary={signboardSecondary}
      footer={footer}
      returnFocusRef={returnFocusRef}
    >
      {/* 列/行数必须定在 .abyssa-inventory 上:--inv-grid-w 是在这一层由
          --inv-cols 推导的,若只写在内层网格上,外层仍按默认 6 列算宽度,
          面板就会比网格宽出一截。 */}
      <div
        className="abyssa-inventory"
        data-detail={detail ? "true" : "false"}
        data-rail={hasRail ? "true" : "false"}
        style={
          {
            ["--inv-cols"]: String(columns),
            ["--inv-rows"]: String(rows)
          } as React.CSSProperties
        }
      >
        {hasRail && (
          <nav className="abyssa-inventory__rail" aria-label="物品分类">
            {railItems.map(({ id, label, count }) => {
              const active = categoryId === id;
              return (
                <button
                  key={id ?? "all"}
                  type="button"
                  className="abyssa-inventory__rail-item"
                  aria-label={`${label} ${count}`}
                  aria-pressed={active}
                  disabled={count === 0 && id != null}
                  onClick={() => setCategoryId(id)}
                >
                  <VerticalIndicator variant={active ? "teal" : "dark"} label={`${label}分类`} compact />
                  {/* 逐字拆开竖排,而不是 writing-mode —— 后者会把计数数字
                      一起转向。与 shop 的分类轨同一手法。 */}
                  <span className="abyssa-inventory__rail-label" aria-hidden="true">
                    {Array.from(label).map((character, index) => (
                      <i key={`${character}-${index}`}>{character}</i>
                    ))}
                  </span>
                  <small className="abyssa-inventory__rail-count" aria-hidden="true">
                    {count}
                  </small>
                </button>
              );
            })}
          </nav>
        )}

        <InventoryGrid
          entries={visible}
          columns={columns}
          rows={rows}
          capacity={capacity}
          selectedId={selectedId}
          onSelect={(entry) => setSelectedId(entry?.id ?? null)}
          onActivate={onActivate}
          label={title}
        />

        {detail && (
          <aside className="abyssa-inventory__detail" aria-live="polite">
            {selected ? (
              <>
                {/* 大图 + 标题横排,和 shop 的 .abyssa-shop-detail 同构
                    (auto + 1fr),不要把大图单独占一行。 */}
                <div className="abyssa-inventory__detail-top">
                  <ItemSlotStatic
                    className="abyssa-inventory__detail-preview"
                    icon={selected.icon}
                    name={selected.name}
                    rarity={selected.rarity}
                    size={128}
                  />
                  <div className="abyssa-inventory__detail-head">
                    <h3>{selected.name}</h3>
                    <span
                      className="abyssa-inventory__detail-rarity abyssa-rarity"
                      data-rarity={normalizeItemRarity(selected.rarity)}
                    >
                      {ITEM_RARITY_LABELS[normalizeItemRarity(selected.rarity)]}
                    </span>
                    <span className="abyssa-inventory__detail-count">
                      <b>{selected.quantity ?? 1}</b>
                      {selected.unit ?? ""}
                    </span>
                  </div>
                </div>
                {selected.description && (
                  <p className="abyssa-inventory__detail-body">{selected.description}</p>
                )}
                <dl className="abyssa-inventory__detail-meta">
                  {Object.entries(selected.meta ?? {}).map(([key, value]) => (
                    <div key={key} style={{ display: "contents" }}>
                      <dt>{key}</dt>
                      <dd>{value}</dd>
                    </div>
                  ))}
                </dl>
                {renderActions?.(selected)}
              </>
            ) : (
              <p className="abyssa-inventory__detail-empty">
                {visible.length === 0 ? emptyHint : "选择一件物品查看详情。"}
              </p>
            )}
          </aside>
        )}
      </div>
    </RpgModal>
  );
}
