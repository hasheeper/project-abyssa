import { useId } from "react";
import { CurrencyAmount } from "../../shared/ui/primitives/CurrencyAmount";
import { DiamondWatermark } from "../../shared/ui/primitives/DiamondWatermark";

/**
 * 右上的资源与状态铭牌。
 *
 * ============ 上一版的三个毛病 ============
 * 1. **金额溢出**：槽写死 42px 高，而里面要塞「标签 11px + 数字 16px」，
 *    实测撑破槽底。现在槽高由内容推导（见下方常量），不再手拍。
 * 2. **金币图标没了**：我上一版把 CurrencyAmount 换成裸 `<b>{value}</b>`，
 *    而那个组件里有一整套 conic-gradient 金币（components.css:54）。
 *    换掉 = 白扔组件库资产。现已换回 CurrencyAmount。
 * 3. 三个裸 div 靠 text-shadow 硬保可读性，没有「牌子」。
 *
 * ============ 呼吸灯为什么必须删 ============
 * 那两颗 `border-radius:50% + box-shadow:0 0 8px + 无限 pulse` 是 SaaS
 * 仪表盘的「服务在线」灯，是本项目里最强的 web 信号之一。而且语义是错的：
 *   · 游戏 UI 里呼吸/闪烁表示**需要玩家处理**（可收取、有新事件），
 *     用它表示「一切正常」等于把最强的注意力信号浪费在最没信息量的状态上。
 *   · 洋馆里真正该动的是产出角标（mansion-production-marker），它本来就在
 *     用 pulse。两处都在呼吸，玩家反而分不清哪个要点。
 * 改成**静态刻面宝石**：不动本身就是「正常」的表达。
 *
 * ============ 版式:三带式,与相位栏同一套思路 ============
 *     ┌──────────────────────────┐  0
 *     │ ◆ 艾比希斯 · 情绪平稳     │  状态带 22..62（两行，每行 20）
 *     │ ◆ 核心结界 · 正常         │
 *     │ ─────────────────────── │  分隔线 70
 *     │ ┌────────┐ ┌────────┐  │  槽带 80..125（高度由内容推导）
 *     │ │维稳公款│ │小队资金│  │
 *     │ │◉12,800 │ │◉ 1,450 │  │
 *     │ └────────┘ └────────┘  │
 *     └──────────────────────────┘  137
 */

/* ============ 版式常量 ============
   所有 y 值逐级推导,不手写。上一版「库存标签掉在牌子外面」就是因为
   它没进这条推导链,而是用 margin:-2px 硬挂在牌下方。 */
const W = 300;
const SIDE_PAD = 24;
const STATE_TOP = 22;
const STATE_ROW = 20;
const DIVIDER_Y = STATE_TOP + STATE_ROW * 2 + 8;
/** 槽高 = 标签 11 + 间隙 4 + 数字行 18 + 上下 padding 12。 */
const WELL_H = 11 + 4 + 18 + 12;
const WELL_TOP = DIVIDER_Y + 10;
const WELL_GAP = 8;
const WELL_W = (W - SIDE_PAD * 2 - WELL_GAP) / 2;
const WELL_BOTTOM = WELL_TOP + WELL_H;
/** 库存带:**在牌内**,不再挂到牌外。 */
const STOCK_H = 26;
const STOCK_TOP = WELL_BOTTOM + 8;
const STOCK_W = W - SIDE_PAD * 2;
/** 底部留白:库存底到 path 底。要够容纳 7px 外框描边的一半(3.5)再加呼吸。 */
const H = STOCK_TOP + STOCK_H + 14;

const platePath = [
  "M8 6",
  `H${W - 26}`,
  `L${W - 6} 26`,
  `V${H - 8}`,
  "H26",
  `L6 ${H - 28}`,
  "Z"
].join(" ");

const ornamentPath = [
  "M17 15",
  `H${W - 30}`,
  `L${W - 15} 30`,
  `V${H - 17}`,
  "H30",
  `L15 ${H - 32}`,
  "Z"
].join(" ");

export interface MansionLedgerProps {
  abyssState: string;
  wardState: string;
  publicFund: number;
  partyFund: number;
  stockTotal: number;
  stockOpen: boolean;
  onToggleStock: () => void;
}

/** 内陷槽：槽底深一层 + 上沿暗、下沿亮 => 读起来是「凹进去」。 */
function Well({ x }: { x: number }) {
  return (
    <g>
      <rect x={x} y={WELL_TOP} width={WELL_W} height={WELL_H} fill="var(--mansion-well-fill)" />
      {/* 上沿与左沿压暗 = 光从上方来，凹槽的上壁背光。 */}
      <path
        d={`M${x} ${WELL_TOP + WELL_H} V${WELL_TOP} H${x + WELL_W}`}
        fill="none"
        stroke="#05090a"
        strokeWidth="1.8"
        opacity=".9"
      />
      {/* 下沿与右沿提亮 = 凹槽的下壁受光。 */}
      <path
        d={`M${x} ${WELL_TOP + WELL_H} H${x + WELL_W} V${WELL_TOP}`}
        fill="none"
        stroke="var(--mansion-well-lip)"
        strokeWidth="1"
        opacity=".5"
      />
    </g>
  );
}

/** 静态刻面宝石 —— 取代呼吸灯。不动即正常。 */
function Gem({ y, tone }: { y: number; tone: string }) {
  return (
    <g transform={`translate(30 ${y})`}>
      <path d="M0 -6.5 L6.5 0 L0 6.5 L-6.5 0 Z" fill={tone} />
      <path d="M0 -6.5 L6.5 0 L0 6.5 L-6.5 0 Z" fill="none" stroke="var(--abyssa-frame-dark)" strokeWidth="2.8" />
      <path d="M0 -6.5 L6.5 0 L0 6.5 L-6.5 0 Z" fill="none" stroke="var(--abyssa-frame-deep)" strokeWidth="1" />
      {/* 刻面高光：一条固定的斜切亮线，不发光也不闪。 */}
      <path d="M-2.8 -1.5 L0 -4.3 L2.8 -1.5" fill="none" stroke="#e8f1ef" strokeWidth=".9" opacity=".6" strokeLinecap="round" />
    </g>
  );
}

export function MansionLedger({
  abyssState,
  wardState,
  publicFund,
  partyFund,
  stockTotal,
  stockOpen,
  onToggleStock
}: MansionLedgerProps) {
  const uid = useId().replace(/:/g, "");
  const patternId = `mansion-ledger-pattern-${uid}`;
  const clipId = `mansion-ledger-clip-${uid}`;

  return (
    <div
      className="mansion-ledger"
      style={{
        // 版式常量交给 CSS，让 HTML 文字层与 SVG 槽用同一组数字定位。
        // 「金额溢出槽」就是因为上一版两边各写一套数字。
        ["--ledger-w" as string]: `${W}px`,
        ["--ledger-h" as string]: `${H}px`,
        ["--ledger-state-top" as string]: `${STATE_TOP}px`,
        ["--ledger-state-row" as string]: `${STATE_ROW}px`,
        ["--ledger-well-top" as string]: `${WELL_TOP}px`,
        ["--ledger-well-h" as string]: `${WELL_H}px`,
        ["--ledger-well-w" as string]: `${WELL_W}px`,
        ["--ledger-well-gap" as string]: `${WELL_GAP}px`,
        ["--ledger-side-pad" as string]: `${SIDE_PAD}px`,
        ["--ledger-stock-top" as string]: `${STOCK_TOP}px`,
        ["--ledger-stock-h" as string]: `${STOCK_H}px`,
        ["--ledger-stock-w" as string]: `${STOCK_W}px`
      }}
    >
      <svg className="mansion-ledger__plate" viewBox={`0 0 ${W} ${H}`} aria-hidden="true">
        <defs>
          <DiamondWatermark
            as="pattern"
            id={patternId}
            size={26}
            outerFill="rgb(255 255 255 / 3%)"
            innerFill="rgb(255 255 255 / 1.2%)"
            innerInset={6}
          />
          <clipPath id={clipId}>
            <path d={platePath} />
          </clipPath>
        </defs>

        <path d={platePath} fill="#0b1011" opacity=".74" transform="translate(0 4)" />
        <path d={platePath} fill="var(--mansion-plate-fill)" />
        <rect width={W} height={H} fill={`url(#${patternId})`} clipPath={`url(#${clipId})`} />

        <path d={platePath} fill="none" stroke="var(--abyssa-frame-dark)" strokeWidth="7" strokeLinejoin="miter" />
        <path d={platePath} fill="none" stroke="var(--mansion-plate-edge)" strokeWidth="4" strokeLinejoin="miter" />
        <path d={platePath} fill="none" stroke="var(--abyssa-frame-deep)" strokeWidth="2" strokeLinejoin="miter" />
        <path d={ornamentPath} fill="none" stroke="var(--mansion-plate-ornament)" strokeWidth="1.1" strokeLinejoin="miter" opacity=".82" />

        {/* 状态带与槽带之间的分隔线。 */}
        <path d={`M${SIDE_PAD} ${DIVIDER_Y} H${W - SIDE_PAD}`} fill="none" stroke="var(--abyssa-frame-deep)" strokeWidth="1.6" />
        <path d={`M${SIDE_PAD} ${DIVIDER_Y + 1.4} H${W - SIDE_PAD}`} fill="none" stroke="var(--mansion-plate-ornament)" strokeWidth=".7" opacity=".32" />

        {/* 两颗静态宝石，与两行状态文字各自居中对齐。 */}
        <Gem y={STATE_TOP + STATE_ROW / 2} tone="var(--mansion-gem-safe)" />
        <Gem y={STATE_TOP + STATE_ROW + STATE_ROW / 2} tone="var(--mansion-gem-ward)" />

        {/* 两个资金内陷槽。 */}
        <Well x={SIDE_PAD} />
        <Well x={SIDE_PAD + WELL_W + WELL_GAP} />

        {/* 库存带:同族的内陷槽,画在牌内。上一版是一块挂在牌外的独立
            小牌子(margin:-2px),实测 y=135..165 而牌外沿只到 132.5,
            整个掉在牌子下面 —— 就是你看到的「下面溢出」。 */}
        <rect x={SIDE_PAD} y={STOCK_TOP} width={STOCK_W} height={STOCK_H} fill="var(--mansion-well-fill)" />
        <path
          d={`M${SIDE_PAD} ${STOCK_TOP + STOCK_H} V${STOCK_TOP} H${SIDE_PAD + STOCK_W}`}
          fill="none"
          stroke="#05090a"
          strokeWidth="1.8"
          opacity=".9"
        />
        <path
          d={`M${SIDE_PAD} ${STOCK_TOP + STOCK_H} H${SIDE_PAD + STOCK_W} V${STOCK_TOP}`}
          fill="none"
          stroke="var(--mansion-well-lip)"
          strokeWidth="1"
          opacity=".5"
        />

        {/* 铆点。 */}
        <g fill="var(--mansion-plate-ornament)" opacity=".8">
          <path d={`M${W - 20} 20 L${W - 16} 24 L${W - 20} 28 L${W - 24} 24 Z`} />
        </g>
      </svg>

      {/* 文字层。SVG 只画牌子与槽，文字用 HTML —— 便于本地化与选中，
          且不必把字号焊进 viewBox。 */}
      <div className="mansion-ledger__states">
        <span>艾比希斯 · {abyssState}</span>
        <span>核心结界 · {wardState}</span>
      </div>

      {/* 资金：CurrencyAmount 自带金币图标（components.css:54 的
          conic-gradient 硬币），不要再用裸 <b> 重写一遍。 */}
      <div className="mansion-ledger__funds">
        <span>
          <small>维稳公款</small>
          <CurrencyAmount value={publicFund} label={`维稳公款 ${publicFund}`} />
        </span>
        <span>
          <small>小队资金</small>
          <CurrencyAmount value={partyFund} label={`小队资金 ${partyFund}`} />
        </span>
      </div>

      {/* 库存:坐在牌内的库存槽里。槽由上面的 plate SVG 画,
          这里只放可点的文字层 —— 不再自带一套边框。 */}
      <button
        type="button"
        className="mansion-ledger__stock"
        aria-expanded={stockOpen}
        onClick={onToggleStock}
      >
        <small>领地库存</small>
        <b>{stockTotal}</b>
      </button>
    </div>
  );
}
