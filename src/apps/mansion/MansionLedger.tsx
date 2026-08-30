import { useId } from "react";
import type { Ref } from "react";
import chestGlyph from "../../assets/svg/items/game-icons/chest.svg";
import { CurrencyAmount } from "../../shared/ui/primitives/CurrencyAmount";
import { DiamondWatermark } from "../../shared/ui/primitives/DiamondWatermark";

const W = 300;
const H = 111;
const SIDE_PAD = 21;
const HEADER_TOP = 13;
const HEADER_H = 28;
const WELL_TOP = 48;
const WELL_H = 50;
const WELL_GAP = 8;
const WELL_W = (W - SIDE_PAD * 2 - WELL_GAP) / 2;

const platePath = [
  "M9 5",
  `H${W - 27}`,
  `L${W - 5} 27`,
  `V${H - 9}`,
  `L${W - 14} ${H}`,
  "H14",
  `L5 ${H - 9}`,
  "V9",
  "Z"
].join(" ");

const ornamentPath = [
  "M17 14",
  `H${W - 31}`,
  `L${W - 14} 31`,
  `V${H - 17}`,
  `L${W - 22} ${H - 9}`,
  "H22",
  `L14 ${H - 17}`,
  "V17",
  "Z"
].join(" ");

export interface MansionLedgerProps {
  publicFund: number;
  partyFund: number;
  stockTotal: number;
  stockOpen: boolean;
  onToggleStock: () => void;
  /** 库存按钮。物品栏关闭后要把焦点还回这里。 */
  stockButtonRef?: Ref<HTMLButtonElement>;
}

/** 与牌面共用坐标的凹槽，避免文字层和装饰层各自维护尺寸。 */
function Well({ x }: { x: number }) {
  return (
    <g>
      <rect x={x} y={WELL_TOP} width={WELL_W} height={WELL_H} fill="var(--mansion-well-fill)" />
      <path
        d={`M${x} ${WELL_TOP + WELL_H} V${WELL_TOP} H${x + WELL_W}`}
        fill="none"
        stroke="#05090a"
        strokeWidth="1.8"
        opacity=".9"
      />
      <path
        d={`M${x} ${WELL_TOP + WELL_H} H${x + WELL_W} V${WELL_TOP}`}
        fill="none"
        stroke="var(--mansion-well-lip)"
        strokeWidth="1"
        opacity=".48"
      />
      <path
        d={`M${x + 7} ${WELL_TOP + 5} H${x + WELL_W - 7}`}
        fill="none"
        stroke="var(--mansion-plate-ornament)"
        strokeWidth=".65"
        opacity=".22"
      />
    </g>
  );
}

export function MansionLedger({
  publicFund,
  partyFund,
  stockTotal,
  stockOpen,
  onToggleStock,
  stockButtonRef
}: MansionLedgerProps) {
  const uid = useId().replace(/:/g, "");
  const patternId = `mansion-ledger-pattern-${uid}`;
  const clipId = `mansion-ledger-clip-${uid}`;

  return (
    <>
      <section
        className="mansion-ledger"
        aria-label="领地账簿"
        style={{
          ["--ledger-w" as string]: `${W}px`,
          ["--ledger-h" as string]: `${H}px`,
          ["--ledger-header-top" as string]: `${HEADER_TOP}px`,
          ["--ledger-header-h" as string]: `${HEADER_H}px`,
          ["--ledger-well-top" as string]: `${WELL_TOP}px`,
          ["--ledger-well-h" as string]: `${WELL_H}px`,
          ["--ledger-well-w" as string]: `${WELL_W}px`,
          ["--ledger-well-gap" as string]: `${WELL_GAP}px`,
          ["--ledger-side-pad" as string]: `${SIDE_PAD}px`,
          ["--ledger-content-w" as string]: `${W - SIDE_PAD * 2}px`
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

          <path d={platePath} fill="#05090a" opacity=".72" transform="translate(0 4)" />
          <path d={platePath} fill="var(--mansion-plate-fill)" />
          <rect width={W} height={H} fill={`url(#${patternId})`} clipPath={`url(#${clipId})`} />
          <path d={platePath} fill="none" stroke="var(--abyssa-frame-dark)" strokeWidth="7" />
          <path d={platePath} fill="none" stroke="var(--mansion-plate-edge)" strokeWidth="4" />
          <path d={platePath} fill="none" stroke="var(--abyssa-frame-deep)" strokeWidth="2" />
          <path d={ornamentPath} fill="none" stroke="var(--mansion-plate-ornament)" strokeWidth="1" opacity=".72" />

          <Well x={SIDE_PAD} />
          <Well x={SIDE_PAD + WELL_W + WELL_GAP} />

          <path
            d={`M${W - 20} 20 L${W - 16} 24 L${W - 20} 28 L${W - 24} 24 Z`}
            fill="var(--mansion-plate-ornament)"
            opacity=".76"
          />
        </svg>

        <header className="mansion-ledger__header">
          <span aria-hidden="true" />
          <h2>领地账簿</h2>
          <span aria-hidden="true" />
        </header>

        <dl className="mansion-ledger__funds">
          <div>
            <dt>维稳公款</dt>
            <dd><CurrencyAmount value={publicFund} label={`维稳公款 ${publicFund}`} /></dd>
          </div>
          <div>
            <dt>小队资金</dt>
            <dd><CurrencyAmount value={partyFund} label={`小队资金 ${partyFund}`} /></dd>
          </div>
        </dl>
      </section>

      {/* 圆形入口:传统 RPG 的「道具袋」按钮 —— 一枚圆章挂在铭牌右侧,
          图标居中,数量做成右上角标。
          原先是 174x32 的横向长条,写着「领地库存」+ 数字 + 一个折叠箭头,
          那是网页折叠面板的语汇(而且它现在打开的是模态,不是折叠层,
          箭头本身就是错的提示)。 */}
      <button
        ref={stockButtonRef}
        type="button"
        className="mansion-ledger__stock"
        aria-haspopup="dialog"
        aria-expanded={stockOpen}
        aria-label={`领地库存，共 ${stockTotal} 件`}
        onClick={onToggleStock}
      >
        <svg className="mansion-ledger__stock-plate" viewBox="0 0 56 56" aria-hidden="true">
          {/* 下沉垫底 + 牌面 + 方向性光照 + 三层描边,与相位推进键同族。 */}
          <circle cx="28" cy="28" r="24" fill="#070c0d" opacity=".6" transform="translate(0 2.5)" />
          <circle cx="28" cy="28" r="24" fill="var(--mansion-plate-fill)" />
          <path d="M4 28 A24 24 0 0 1 52 28 Z" fill="#4a5a52" opacity=".42" />
          <path d="M4 28 A24 24 0 0 0 52 28 Z" fill="#070c0d" opacity=".46" />
          <circle cx="28" cy="28" r="24" fill="none" stroke="var(--abyssa-frame-dark)" strokeWidth="5" />
          <circle cx="28" cy="28" r="24" fill="none" stroke="var(--mansion-plate-edge)" strokeWidth="2.4" />
          <circle cx="28" cy="28" r="24" fill="none" stroke="var(--abyssa-frame-deep)" strokeWidth="1" />
          <path d="M12 18 A24 24 0 0 1 44 18" fill="none" stroke="#c3d0d0" strokeWidth="1.2" strokeLinecap="round" opacity=".5" />
        </svg>
        <img src={chestGlyph} alt="" />
        {stockTotal > 0 && <b aria-hidden="true">{stockTotal}</b>}
      </button>
    </>
  );
}
