import cargoCrateGlyph from "../../assets/svg/items/game-icons/cargo-crate.svg";
import hammerNailsGlyph from "../../assets/svg/items/game-icons/hammer-nails.svg";
import herbsBundleGlyph from "../../assets/svg/items/game-icons/herbs-bundle.svg";
import hotMealGlyph from "../../assets/svg/items/game-icons/hot-meal.svg";
import scrollQuillGlyph from "../../assets/svg/items/game-icons/scroll-quill.svg";
import toolboxGlyph from "../../assets/svg/items/game-icons/toolbox.svg";
import type { MansionProductionIcon } from "./data";

/**
 * 世界图钉的图标与外壳。
 *
 * ============ 上一版的病根 ============
 * 三个标记都是「带字的色块」,不是图标:
 *   修缮  66px 圆 + 汉字「修」(font-size:27px) —— 汉字当图标
 *   产出  108x70 圆角块 + 「＋2」,填 #dce0ba 是全场最亮 —— 最次要的
 *         信息拿了最强的视觉权重,还挂着无限 pulse
 *   对话  54x42 圆 + 「…」,且只在 hover 时出现
 * 三者共用 `border:5px solid` + `border-radius:50%` + `box-shadow`,
 * 这是**网页 badge** 的做法。而仓库里所有真图标(IconButton /
 * RpgStatusNode / RpgHeader)都是 SVG 三层描边,这三个完全没接进来。
 *
 * ============ 这一版 ============
 * 统一成「盾形铭牌 + 素材库 SVG 图标」:
 *   1. 下沉垫底 —— 图钉浮在世界之上
 *   2. 盾形牌面 + 方向性光照(上半受光、下半背光)
 *   3. 三层描边 5/2.4/1(同族按比例缩小,大件用 7/4/2)
 *   4. 图标取自项目 game-icons 素材库,不再在业务组件里临时手绘
 * 尺寸走同一条阶梯:产出/修缮 44、对话 30,不再各自拍数。
 */

/* ============ 尺寸阶梯 ============
 * 注意:这些值在**世界坐标系**(5162x1910)里,会被 WORLD_SCALE≈0.4712
 * 一起缩小。所以要按「想要的屏上尺寸 ÷ 0.4712」来写。
 * 我第一版直接写了 44/52,实测屏上只有 20.7/24.5px —— 忘了这层换算。
 *   屏上 44px -> 世界 93     屏上 52px -> 世界 110     屏上 30px -> 世界 64
 */
/** 图钉:屏上约 29px。
 *  它只是提示层，继续压低一级，避免修缮与收获图标抢过房间和角色。 */
export const MARKER_SIZE = 62;

/**
 * 八边形牌面 —— **等宽等高**,图标居中。
 *
 * 上一版是盾形(下方收尖到 y=40),导致图标区只占牌高的 43%,
 * 而且两个图钉并排时两个尖角互相错位,读起来就是「乱拼的」。
 * 等宽等高 + 重心在几何中心,并排时轮廓与图标中心都在同一条线上。
 */
const PLATE = "M14 3 H30 L41 14 V30 L30 41 H14 L3 30 V14 Z";

interface ShellProps {
  children: React.ReactNode;
  tone: "repair" | "production" | "promote";
}

/** 共用外壳:垫底 + 牌面 + 光照 + 三层描边。 */
function Shell({ children, tone }: ShellProps) {
  return (
    <svg viewBox="0 0 44 44" aria-hidden="true" data-tone={tone}>
      {/* 1. 下沉垫底。 */}
      <path d={PLATE} fill="#070c0d" opacity=".58" transform="translate(0 2.5)" />

      {/* 轮廓冷光位于牌面背后，只勾切角边缘，不铺成整块光斑。 */}
      <path
        className="mansion-marker__edge-glow"
        d={PLATE}
        fill="none"
        stroke="var(--marker-glow)"
        strokeWidth="1.4"
        strokeLinejoin="miter"
      />

      {/* 2. 牌面。 */}
      <path d={PLATE} fill="var(--marker-fill)" />

      {/* 3. 方向性光照 —— 上半受光、下半背光,与相位刻度同一手法。 */}
      <path d="M14 3 H30 L41 14 V22 H3 V14 Z" fill="var(--marker-lit)" opacity=".5" />
      <path d="M3 22 H41 V30 L30 41 H14 L3 30 Z" fill="var(--marker-shade)" opacity=".55" />

      {/* 4. 三层描边 5 / 2.4 / 1。 */}
      <path d={PLATE} fill="none" stroke="var(--abyssa-frame-dark)" strokeWidth="5" strokeLinejoin="miter" />
      <path d={PLATE} fill="none" stroke="var(--marker-edge)" strokeWidth="2.4" strokeLinejoin="miter" />
      <path d={PLATE} fill="none" stroke="var(--abyssa-frame-deep)" strokeWidth="1" strokeLinejoin="miter" />

      {/* 5. 上棱提亮,强化切削感。 */}
      <path d="M15 4 H29" fill="none" stroke="var(--marker-rim)" strokeWidth="1.2" strokeLinecap="round" opacity=".7" />

      {children}
    </svg>
  );
}

/** 修缮：项目素材库中的 verified 锤子与钉子。 */
export function RepairIcon() {
  return (
    <Shell tone="repair">
      <image
        className="mansion-marker__library-glyph"
        href={hammerNailsGlyph}
        x="9.5"
        y="9.5"
        width="25"
        height="25"
        preserveAspectRatio="xMidYMid meet"
      />
    </Shell>
  );
}

/** 可升级:向上的箭头。与修缮键上的图示同一形,让"这两件事相连"看得出来。 */
export function PromoteIcon() {
  return (
    <Shell tone="promote">
      <path
        d="M22 31 V14 M14.5 21.5 L22 14 L29.5 21.5"
        fill="none"
        stroke="var(--marker-promote-ink, #2a2109)"
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Shell>
  );
}

/** 产出图标表。物品栏与世界图钉共用同一份,避免两处各配一套图标而漂移。 */
export const PRODUCTION_GLYPHS: Record<MansionProductionIcon, string> = {
  meal: hotMealGlyph,
  maintenance: toolboxGlyph,
  supplies: cargoCrateGlyph,
  records: scrollQuillGlyph,
  herbs: herbsBundleGlyph
};

/** 产出：图形跟随房间的实际产物；数量继续由右下角标表达。 */
export function ProductionIcon({ icon }: { icon: MansionProductionIcon }) {
  return (
    <Shell tone="production">
      <image
        className="mansion-marker__library-glyph"
        href={PRODUCTION_GLYPHS[icon]}
        x="8.5"
        y="8.5"
        width="27"
        height="27"
        preserveAspectRatio="xMidYMid meet"
      />
    </Shell>
  );
}

/**
 * 对话气泡。挂在角色头像右上,常驻但低调 ——
 * 上一版只在 hover 时出现,等于「可对话」这件事不可发现。
 */
export function DialogueBubble() {
  const shape = "M4 5 H26 V19 H14 L9 24 V19 H4 Z";
  return (
    <svg viewBox="0 0 30 26" aria-hidden="true">
      <path d={shape} fill="#070c0d" opacity=".5" transform="translate(0 1.6)" />
      <path d={shape} fill="var(--bubble-fill)" />
      <path d={shape} fill="none" stroke="var(--abyssa-frame-dark)" strokeWidth="4" strokeLinejoin="miter" />
      <path d={shape} fill="none" stroke="var(--bubble-edge)" strokeWidth="1.8" strokeLinejoin="miter" />
      <path d={shape} fill="none" stroke="var(--abyssa-frame-deep)" strokeWidth=".8" strokeLinejoin="miter" />
      {/* 三个点用**圆点**画,不是文字省略号。 */}
      <g fill="var(--bubble-ink)">
        <circle cx="10" cy="12" r="1.7" />
        <circle cx="15" cy="12" r="1.7" />
        <circle cx="20" cy="12" r="1.7" />
      </g>
    </svg>
  );
}
