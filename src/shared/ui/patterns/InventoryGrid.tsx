import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties } from "react";
import { cx } from "../../lib/cx";
import { ItemSlot } from "../primitives/ItemSlot";
import type { ItemRarity } from "../items/rarity";

/* ============ 背包网格 ============
 *
 * shared 层不许 import apps/ 或 content/(scripts/check-module-boundaries.mjs
 * 会拦),所以这里只吃朴素 view-model:绝不认识 MansionProduction、也不认识
 * shop 的 Item。各应用自己映射成 InventoryEntry。
 *
 * 键盘用 **roving tabindex**:整个网格只有一个 tabIndex=0,方向键在格间移动。
 * 这是 ARIA grid 的标准做法,也是库里第一次实现 —— 之前没有任何 role="grid"。
 * 若给每格都留 tabIndex=0,18 格就要按 18 次 Tab 才能走出背包,那是网页列表
 * 的行为,不是背包的行为。
 *
 * 空槽**参与网格与焦点**(它们是可点的落位目标),但不参与"选中"语义。
 */

export interface InventoryEntry {
  id: string;
  name: string;
  /** 图标 URL。由应用侧解析(通常走 assets/svg/items/catalog 的 resolveItemIcon)。 */
  icon: string;
  rarity?: ItemRarity | string;
  quantity?: number;
  unit?: string;
  description?: string;
  category?: string;
  /** 任意附加字段,渲染详情时回传给应用。 */
  meta?: Record<string, string | number>;
}

export interface InventoryGridProps {
  entries: InventoryEntry[];
  columns?: number;
  rows?: number;
  /** 仓储上限,显示在页脚容量位。省略则按当前页数推算。 */
  capacity?: number;
  selectedId?: string | null;
  onSelect?: (entry: InventoryEntry | null) => void;
  /** 双击/回车确认时触发(例如"使用")。 */
  onActivate?: (entry: InventoryEntry) => void;
  /** 当前页,受控。省略则内部自管。 */
  page?: number;
  onPageChange?: (page: number) => void;
  label?: string;
  className?: string;
  style?: CSSProperties;
}

export function InventoryGrid({
  entries,
  columns = 6,
  rows = 4,
  capacity,
  selectedId,
  onSelect,
  onActivate,
  page: pageProp,
  onPageChange,
  label = "物品栏",
  className,
  style
}: InventoryGridProps) {
  const perPage = columns * rows;
  const pageCount = Math.max(1, Math.ceil(entries.length / perPage));

  const [internalPage, setInternalPage] = useState(0);
  const page = Math.min(pageProp ?? internalPage, pageCount - 1);

  const setPage = useCallback(
    (next: number) => {
      const clamped = Math.max(0, Math.min(next, pageCount - 1));
      if (pageProp == null) setInternalPage(clamped);
      onPageChange?.(clamped);
    },
    [onPageChange, pageProp, pageCount]
  );

  /* 焦点游标是**页内**索引 0..perPage-1,不是全局索引 —— 翻页后光标该留在
     同一个视觉位置上,而不是跟着物品跑。 */
  const [cursor, setCursor] = useState(0);
  const gridRef = useRef<HTMLDivElement>(null);
  const shouldFocusRef = useRef(false);

  const pageEntries = useMemo(
    () => entries.slice(page * perPage, page * perPage + perPage),
    [entries, page, perPage]
  );

  // 固定格数:不足的用 null 补成空槽,网格因此永不塌陷、不跳动。
  const cells = useMemo(
    () => Array.from({ length: perPage }, (_, index) => pageEntries[index] ?? null),
    [pageEntries, perPage]
  );

  useEffect(() => {
    if (cursor > perPage - 1) setCursor(perPage - 1);
  }, [cursor, perPage]);

  /* 只在键盘导航之后才真的抢焦点。若无条件 focus,鼠标点击也会被强行
     移动焦点,并且首次挂载就会把焦点从触发按钮偷走。 */
  useEffect(() => {
    if (!shouldFocusRef.current) return;
    shouldFocusRef.current = false;
    const grid = gridRef.current;
    if (!grid) return;
    grid.querySelectorAll<HTMLElement>("[data-slot-index]")[cursor]?.focus();
  }, [cursor, page]);

  const moveTo = useCallback((next: number) => {
    shouldFocusRef.current = true;
    setCursor(next);
  }, []);

  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLDivElement>) => {
      const column = cursor % columns;
      const row = Math.floor(cursor / columns);

      switch (event.key) {
        case "ArrowRight":
          event.preventDefault();
          if (column < columns - 1) moveTo(cursor + 1);
          else if (page < pageCount - 1) {
            setPage(page + 1);
            moveTo(row * columns);
          }
          return;
        case "ArrowLeft":
          event.preventDefault();
          if (column > 0) moveTo(cursor - 1);
          else if (page > 0) {
            setPage(page - 1);
            moveTo(row * columns + columns - 1);
          }
          return;
        case "ArrowDown":
          event.preventDefault();
          if (row < rows - 1) moveTo(cursor + columns);
          return;
        case "ArrowUp":
          event.preventDefault();
          if (row > 0) moveTo(cursor - columns);
          return;
        case "Home":
          event.preventDefault();
          moveTo(0);
          return;
        case "End":
          event.preventDefault();
          moveTo(perPage - 1);
          return;
        case "PageDown":
          event.preventDefault();
          if (page < pageCount - 1) setPage(page + 1);
          return;
        case "PageUp":
          event.preventDefault();
          if (page > 0) setPage(page - 1);
          return;
        default:
          return;
      }
    },
    [columns, cursor, moveTo, page, pageCount, perPage, rows, setPage]
  );

  const gridStyle = {
    ...style,
    ["--inv-cols" as string]: String(columns),
    ["--inv-rows" as string]: String(rows)
  } as CSSProperties;

  return (
    <div className={cx("abyssa-inventory__main", className)} style={gridStyle}>
      <div
        ref={gridRef}
        className="abyssa-inventory__grid"
        role="grid"
        aria-label={label}
        aria-rowcount={rows}
        aria-colcount={columns}
        onKeyDown={handleKeyDown}
      >
        {Array.from({ length: rows }, (_, rowIndex) => (
          <div className="abyssa-inventory__row" role="row" key={rowIndex} aria-rowindex={rowIndex + 1}>
            {Array.from({ length: columns }, (_, columnIndex) => {
              const index = rowIndex * columns + columnIndex;
              const entry = cells[index];
              return (
                <div role="gridcell" key={columnIndex} aria-colindex={columnIndex + 1}>
                  <ItemSlot
                    data-slot-index={index}
                    icon={entry?.icon}
                    name={entry?.name}
                    rarity={entry?.rarity}
                    quantity={entry?.quantity}
                    unit={entry?.unit}
                    selected={entry != null && entry.id === selectedId}
                    tabIndex={index === cursor ? 0 : -1}
                    onClick={() => {
                      setCursor(index);
                      onSelect?.(entry);
                    }}
                    onDoubleClick={() => {
                      if (entry) onActivate?.(entry);
                    }}
                    onKeyDown={(event) => {
                      if (entry && (event.key === "Enter" || event.key === " ")) {
                        event.preventDefault();
                        onSelect?.(entry);
                        onActivate?.(entry);
                      }
                    }}
                  />
                </div>
              );
            })}
          </div>
        ))}
      </div>

      {/* 页脚恒在:容量在左、分页在右。分页按钮即使只有一页也渲染(禁用),
          否则翻到末页时网格会上跳一整行高。 */}
      <div className="abyssa-inventory__footer">
        <span className="abyssa-inventory__capacity">
          容量
          <b>{entries.length}</b>
          <s>/</s>
          <b>{capacity ?? perPage * pageCount}</b>
        </span>
        <nav className="abyssa-inventory__pagination" aria-label="物品栏分页">
          <button type="button" aria-label="上一页" disabled={page === 0} onClick={() => setPage(page - 1)}>
            ‹
          </button>
          <span>
            {page + 1} / {pageCount}
          </span>
          <button
            type="button"
            aria-label="下一页"
            disabled={page >= pageCount - 1}
            onClick={() => setPage(page + 1)}
          >
            ›
          </button>
        </nav>
      </div>
    </div>
  );
}
