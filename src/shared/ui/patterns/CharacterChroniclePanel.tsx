import { useEffect, useMemo, useRef, useState } from "react";
import type { HTMLAttributes } from "react";
import { cx } from "../../lib/cx";
import { RpgFrame } from "../primitives/RpgFrame";
import {
  chronicleCategories,
  chronicleMarker,
  chronicleTone,
  countChronicleEntries
} from "../../domain/characters/chronicle";
import type {
  CharacterChronicle,
  ChronicleBlock,
  ChronicleCategory
} from "../../domain/characters/chronicle";
import slashedShieldIcon from "../../../assets/svg/ui/slashed-shield.svg";

type ChronicleFilter = "all" | Exclude<ChronicleCategory, "daily">;

const CHRONICLE_FILTERS: readonly {
  id: ChronicleFilter;
  label: string;
}[] = [
  { id: "all", label: "全部" },
  { id: "bond", label: "羁绊" },
  { id: "battle", label: "战事" },
  { id: "pact", label: "私约" }
];

const EMPTY_BLOCKS: ChronicleBlock[] = [];

/* ============ 记事页 ============
 *
 * 一条连续竖轴时间线：章节是轴上的水准线节点，条目依轻重挂在轴上。
 *
 * ============ 这一层只排版，不理解 ============
 * 契约里全是字符串插槽（stamp / badge / struck），组件原样渲染：
 *   - 不解析 badge（"Lv.4" 与 "II" 走同一条路径）
 *   - 不假设 stamp 是天数
 *   - 不跨文件比对好感等级
 * 机制未对齐，任何推导都会在业务变更时变成迁移债。
 *
 * 复用而非重造：
 *   RpgFrame  外框（自带分层描边 + 四角 + 水印）
 *   章节文字沿用 RP 应用的 chapter 语汇（Cinzel + 字距 + 单侧渐变线）
 *   筛选刻意不用重边框组件，只复用主题令牌与键盘语义
 *
 * 图标一律走 mask-image 的 SVG 资源，**禁 emoji 与文字符号**；
 * 节点形状是纯 CSS 几何。
 */

/** mask 图标的行内样式。走 mask 才能被令牌色着色。 */
function maskStyle(icon: string) {
  return {
    WebkitMaskImage: `url("${icon}")`,
    maskImage: `url("${icon}")`
  };
}

/** 按章节分组过滤：章节下没有命中条目时，章节本身也不出现。 */
function filteredChronicleBlocks(
  blocks: readonly ChronicleBlock[],
  filter: ChronicleFilter
): ChronicleBlock[] {
  if (filter === "all") return [...blocks];

  const visible: ChronicleBlock[] = [];
  let pendingChapter: Extract<ChronicleBlock, { kind: "chapter" }> | undefined;

  for (const block of blocks) {
    if (block.kind === "chapter") {
      pendingChapter = block;
      continue;
    }

    if (!chronicleCategories(block.categories).includes(filter)) continue;
    if (pendingChapter) {
      visible.push(pendingChapter);
      pendingChapter = undefined;
    }
    visible.push(block);
  }

  return visible;
}

export interface CharacterChroniclePanelProps
  extends HTMLAttributes<HTMLDivElement> {
  chronicle?: CharacterChronicle;
  characterName?: string;
  /** 摘要行右侧的两枚派生读数。由调用方给出字符串，
      本组件不从 chronicle 推导任何数值。 */
  summary?: { label: string; value: string }[];
}

function ChronicleBlockView({ block }: { block: ChronicleBlock }) {
  if (block.kind === "chapter") {
    /* 章节沿用同一两栏骨架:戳记落在 meta 栏,标题占内容栏。
       对齐轴与条目完全一致,所以分段不会把版面切歪。 */
    return (
      <li className="abyssa-chronicle__chapter">
        <div className="abyssa-chronicle__meta">
          {block.stamp && (
            <span className="abyssa-chronicle__stamp">{block.stamp}</span>
          )}
        </div>
        <span className="abyssa-chronicle__chapter-title">{block.title}</span>
      </li>
    );
  }

  const marker = chronicleMarker(block.marker);
  const tone = chronicleTone(block.tone);
  const categories = chronicleCategories(block.categories);

  /* 两栏时间线：[meta 元信息] │轴│ [content 内容]
     戳记住在 meta 栏、右对齐贴着轴 —— 它**不再**和标题同处一个 flex 行。
     这样内容栏只有一条左边界，标题起点不会随日期长度漂移。 */
  return (
    <li
      className="abyssa-chronicle__entry"
      data-marker={marker}
      data-tone={tone}
      data-categories={categories.join(" ")}
    >
      <div className="abyssa-chronicle__meta">
        {block.stamp && (
          <span className="abyssa-chronicle__stamp">{block.stamp}</span>
        )}
      </div>
      <span className="abyssa-chronicle__node" aria-hidden="true">
        {block.iconUrl && <i style={maskStyle(block.iconUrl)} />}
      </span>
      <div className="abyssa-chronicle__body">
        <div className="abyssa-chronicle__head">
          <h4>{block.title}</h4>
          {/* badge 原样渲染 —— 不解析、不比较。 */}
          {block.badge && (
            <span className="abyssa-chronicle__badge">{block.badge}</span>
          )}
        </div>
        {block.struck && (
          <p className="abyssa-chronicle__struck">
            <del>{block.struck}</del>
          </p>
        )}
        {block.body && <p className="abyssa-chronicle__text">{block.body}</p>}
        {block.voice && (
          <p className="abyssa-chronicle__voice">{block.voice}</p>
        )}
      </div>
    </li>
  );
}

export function CharacterChroniclePanel({
  chronicle,
  characterName,
  summary,
  className,
  ...props
}: CharacterChroniclePanelProps) {
  const blocks = chronicle?.blocks ?? EMPTY_BLOCKS;
  const characterId = chronicle?.characterId ?? "";
  const scrollRef = useRef<HTMLDivElement>(null);
  const [filterState, setFilterState] = useState<{
    characterId: string;
    filter: ChronicleFilter;
  }>(() => ({ characterId, filter: "all" }));
  const activeFilter =
    filterState.characterId === characterId ? filterState.filter : "all";
  const visibleBlocks = useMemo(
    () => filteredChronicleBlocks(blocks, activeFilter),
    [activeFilter, blocks]
  );

  /* 切角色时不继承上一人的筛选；切筛选时回到本卷顶部。 */
  useEffect(() => {
    setFilterState((current) =>
      current.characterId === characterId
        ? current
        : { characterId, filter: "all" }
    );
  }, [characterId]);
  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = 0;
  }, [activeFilter, characterId]);

  /* 占位态：记事尚未录入。宁可明说，也不渲染一条假年表。 */
  if (blocks.length === 0) {
    return (
      <div
        className={cx("abyssa-chronicle", className)}
        data-placeholder="true"
        {...props}
      >
        <RpgFrame className="abyssa-chronicle__placeholder-frame" padding="lg">
          <div className="abyssa-chronicle__placeholder" role="note">
            <i
              className="abyssa-chronicle__placeholder-glyph"
              style={maskStyle(slashedShieldIcon)}
              aria-hidden="true"
            />
            <strong>尚无记事</strong>
            <p>{chronicle?.placeholderNote ?? "这一页还空着"}</p>
          </div>
        </RpgFrame>
      </div>
    );
  }

  const entryCount = countChronicleEntries(blocks);

  return (
    <div className={cx("abyssa-chronicle", className)} {...props}>
      <RpgFrame className="abyssa-chronicle__frame" padding="sm">
        <div className="abyssa-chronicle__inner">
          <div className="abyssa-chronicle__band-title">
            <span className="abyssa-chronicle__kicker">CHRONICLE</span>
            <b>记事{characterName ? ` · ${characterName}` : ""}</b>
            <span className="abyssa-chronicle__summary">
              {summary?.map((item) => (
                <em key={item.label}>
                  {item.label}
                  <i>{item.value}</i>
                </em>
              ))}
              <em>
                记事
                <i>{entryCount}</i>
              </em>
            </span>
          </div>

          <div
            className="abyssa-chronicle__filters"
            role="group"
            aria-label="记事筛选"
          >
            {CHRONICLE_FILTERS.map((item) => {
              const selected = activeFilter === item.id;
              return (
                <button
                  type="button"
                  data-selected={selected || undefined}
                  aria-pressed={selected}
                  onClick={() =>
                    setFilterState({ characterId, filter: item.id })
                  }
                  key={item.id}
                >
                  {item.label}
                </button>
              );
            })}
          </div>

          <div
            ref={scrollRef}
            className="abyssa-chronicle__scroll"
            tabIndex={0}
            aria-live="polite"
          >
            {visibleBlocks.some((block) => block.kind === "entry") ? (
              <ol className="abyssa-chronicle__list">
                {visibleBlocks.map((block) => (
                  <ChronicleBlockView block={block} key={block.id} />
                ))}
              </ol>
            ) : (
              <p className="abyssa-chronicle__filter-empty" role="status">
                此分类暂无记事
              </p>
            )}
          </div>
        </div>
      </RpgFrame>
    </div>
  );
}
