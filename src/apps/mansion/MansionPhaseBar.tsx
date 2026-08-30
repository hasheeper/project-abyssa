import { useId } from "react";
import type { MansionPhase, MansionPhaseId } from "./data";

/**
 * 顶部中央的相位（时间）刻度。
 *
 * ============ 三次弯路,记下来免得重走 ============
 *   v1  604x92  外框牌 + 菱形 34 —— 格子太小气,汉字被描边挤成一个点。
 *   v2  604x124 外框牌 + 菱形 52 —— 方向错了:要「放大格子」,我却靠加高
 *       牌子去换,整块面板又大又臃肿。
 *   v3  424x78  外框牌 + 菱形 50 —— 缩小了,但**根本毛病没动**:
 *       外面一块三层描边的牌,里面四个又是三层描边的菱形,
 *       **同一种轮廓语言套两层** = 框套框,再怎么调比例都浊。
 *
 * ============ v4:把外框整个删掉 ============
 * 关键认识:这个组件要表达的是「四个时刻串成一条时间线」,
 * 而「线 + 节点」本身就是完整的图形语言,**不需要容器**。
 * 外框不但没有增加信息,还与节点抢同一种视觉语言。
 *
 * 而且仓库自己的 RpgDiamondNodeTrack 就是这个构造(一条 __line 串 N 个
 * 菱形,没有外框)。我在 v1 否掉它时只看了语义(它是通用节点选择器,
 * 表达不了「时刻」),没看到它的**视觉构造其实是对的** —— 这一版把它的
 * 构造学回来,只在语义层做特化(三态 + 时间方向 + 说明文字)。
 *
 * 结果:不透明金属面积只剩 v3 的 27%、v2 的 12%,而菱形反而从 50 放大到 58。
 * 「高级」不是靠多加一层框,是靠**减少同类元素的层数**,把省下的对比度
 * 全给唯一的主体(当前时刻那一格)。
 *
 * ============ 质感从哪来(既然没有框了) ============
 * 全部落在菱形自身,用的是仓库既有手法:
 *   1. 斜面高光 —— 上两条棱受光、下两条棱背光,做出「切削过的金属块」。
 *      这是 v1..v3 都没做的一层,也是它们看着扁的真正原因
 *      (它们只有三层同心描边,没有方向性光照)。
 *   2. 三层描边 6/3/1.1(--abyssa-frame-dark / edge / --abyssa-frame-deep)
 *      与 RpgHeader / RpgNotchedPillButton 完全同族。
 *   3. 下沉投影 —— 节点浮在导轨之上。
 *   4. 导轨做成内陷凹槽(上沿暗、下沿亮),节点嵌在槽里而不是飘着。
 */

/* ============ 版式常量 ============ */
/** 刻度菱形边长。v1 的 34 太小气,这版 58 —— 去掉外框才腾出的空间。 */
const SLOT = 58;
/** 四格中心间距。 */
const STEP = 104;
const PHASE_COUNT = 4;
/** 导轨从首格中心延伸到末格中心,两端各再探出一小段。 */
const RAIL_OVERHANG = 26;
const TRACK_W = STEP * (PHASE_COUNT - 1);
const BAR_W = TRACK_W + SLOT + RAIL_OVERHANG * 2;
const BAR_H = SLOT + 14;
const CENTER_Y = BAR_H / 2;
const FIRST_X = (BAR_W - TRACK_W) / 2;

export interface MansionPhaseBarProps {
  phases: MansionPhase[];
  value: MansionPhaseId;
  caption: string;
  onSelect: (id: MansionPhaseId) => void;
  onAdvance: () => void;
}

function slotCenter(index: number) {
  return FIRST_X + STEP * index;
}

/**
 * 一格刻度。斜面高光是这一版质感的全部来源,所以这里不用 <path> 堆同心
 * 描边就完事 —— 上棱与下棱分开画,才有方向性光照。
 */
function Facet({ state }: { state: "current" | "elapsed" | "coming" }) {
  const d = "M29 3 L55 29 L29 55 L3 29 Z";
  return (
    <svg viewBox="0 0 58 58" aria-hidden="true">
      {/* 下沉投影 —— 节点浮在导轨之上。 */}
      <path d={d} fill="#070c0d" opacity=".62" transform="translate(0 2.5)" />

      {/* 牌面。 */}
      <path d={d} fill="var(--mansion-slot-fill)" />

      {/* 斜面高光:把菱形切成上下两半,上半受光、下半背光。
          这一层是 v1..v3 缺的,它们只有同心描边所以看着扁。 */}
      <path d="M29 3 L55 29 L29 29 Z" fill="var(--mansion-slot-lit)" opacity=".92" />
      <path d="M29 3 L3 29 L29 29 Z" fill="var(--mansion-slot-lit)" opacity=".55" />
      <path d="M29 55 L55 29 L29 29 Z" fill="var(--mansion-slot-shade)" opacity=".5" />
      <path d="M29 55 L3 29 L29 29 Z" fill="var(--mansion-slot-shade)" opacity=".82" />

      {/* 三层描边 6/3/1.1 —— 与 RpgHeader / RpgNotchedPillButton 同族。 */}
      <path d={d} fill="none" stroke="var(--abyssa-frame-dark)" strokeWidth="6" strokeLinejoin="miter" />
      <path d={d} fill="none" stroke="var(--mansion-slot-edge)" strokeWidth="3" strokeLinejoin="miter" />
      <path d={d} fill="none" stroke="var(--abyssa-frame-deep)" strokeWidth="1.1" strokeLinejoin="miter" />

      {/* 上棱提亮 —— 受光边比整圈描边更亮,强化切削感。 */}
      <path
        d="M29 3 L55 29"
        fill="none"
        stroke="var(--mansion-slot-rim)"
        strokeWidth="1.5"
        strokeLinecap="round"
        opacity=".85"
      />
      <path
        d="M29 3 L3 29"
        fill="none"
        stroke="var(--mansion-slot-rim)"
        strokeWidth="1.2"
        strokeLinecap="round"
        opacity=".55"
      />

      {/* 当前格多一圈内环,只在它身上出现 —— 唯一主体值得多一层细节。 */}
      {state === "current" && (
        <path
          d="M29 12 L46 29 L29 46 L12 29 Z"
          fill="none"
          stroke="var(--mansion-slot-inner)"
          strokeWidth="1"
          opacity=".62"
        />
      )}
    </svg>
  );
}

export function MansionPhaseBar({
  phases,
  value,
  caption,
  onSelect,
  onAdvance
}: MansionPhaseBarProps) {
  const uid = useId().replace(/:/g, "");
  const railClip = `mansion-rail-clip-${uid}`;
  const activeIndex = phases.findIndex((phase) => phase.id === value);
  const lastX = slotCenter(phases.length - 1);
  const railLeft = FIRST_X - RAIL_OVERHANG;
  const railRight = lastX + RAIL_OVERHANG;

  return (
    <div
      className="mansion-phasebar"
      style={{
        ["--phasebar-w" as string]: `${BAR_W}px`,
        ["--phasebar-h" as string]: `${BAR_H}px`,
        ["--phasebar-slot" as string]: `${SLOT}px`,
        ["--phasebar-center-y" as string]: `${CENTER_Y}px`
      }}
    >
      {/* 导轨。做成**内陷凹槽**:上沿暗、下沿亮 —— 于是节点是「嵌在槽里」
          而不是「飘在背景上」。这是唯一保留的容器类元素,而它只有 6px 高,
          不构成第二层轮廓。 */}
      <svg className="mansion-phasebar__rail" viewBox={`0 0 ${BAR_W} ${BAR_H}`} aria-hidden="true">
        <defs>
          <clipPath id={railClip}>
            <rect x={railLeft} y={CENTER_Y - 3} width={railRight - railLeft} height={6} rx="3" />
          </clipPath>
        </defs>

        {/* 槽底。 */}
        <rect
          x={railLeft}
          y={CENTER_Y - 3}
          width={railRight - railLeft}
          height={6}
          rx="3"
          fill="var(--mansion-well-fill)"
        />
        {/* 已过去的段落染暖色 —— 时间是有方向的。 */}
        {activeIndex > 0 && (
          <rect
            x={railLeft}
            y={CENTER_Y - 3}
            width={slotCenter(activeIndex) - railLeft}
            height={6}
            fill="var(--mansion-plate-elapsed)"
            opacity=".8"
            clipPath={`url(#${railClip})`}
          />
        )}
        {/* 上沿压暗、下沿提亮 = 凹槽。 */}
        <path
          d={`M${railLeft} ${CENTER_Y - 3} H${railRight}`}
          fill="none"
          stroke="#05090a"
          strokeWidth="1.6"
          opacity=".92"
        />
        <path
          d={`M${railLeft} ${CENTER_Y + 3} H${railRight}`}
          fill="none"
          stroke="var(--mansion-well-lip)"
          strokeWidth="1"
          opacity=".42"
        />
        {/* 两端收头的小菱形铆点 —— 让导轨有始有终,不是被裁断的。 */}
        <g fill="var(--mansion-plate-ornament)" opacity=".7">
          <path d={`M${railLeft} ${CENTER_Y - 4.5} L${railLeft + 4.5} ${CENTER_Y} L${railLeft} ${CENTER_Y + 4.5} L${railLeft - 4.5} ${CENTER_Y} Z`} />
          <path d={`M${railRight} ${CENTER_Y - 4.5} L${railRight + 4.5} ${CENTER_Y} L${railRight} ${CENTER_Y + 4.5} L${railRight - 4.5} ${CENTER_Y} Z`} />
        </g>
      </svg>

      <div className="mansion-phasebar__slots" role="group" aria-label="生活相位">
        {phases.map((phase, index) => {
          const state =
            phase.id === value ? "current" : index < activeIndex ? "elapsed" : "coming";
          return (
            <button
              key={phase.id}
              type="button"
              className="mansion-phasebar__slot"
              data-state={state}
              style={{ left: `${(slotCenter(index) / BAR_W) * 100}%` }}
              aria-label={phase.label}
              aria-pressed={phase.id === value}
              onClick={() => onSelect(phase.id)}
            >
              <Facet state={state} />
              {/* 时刻名用 HTML 而非 SVG <text>:字号不必焊进 viewBox,
                  且中文字体的 dominant-baseline 在各浏览器不一致。 */}
              <b>{phase.label}</b>
            </button>
          );
        })}
      </div>

      {/* 说明文字挂在刻度下方。当前时刻本身由高亮那一格表达,不重复写大字
          —— v2 正是为了塞那个冗余大字才被迫加高牌子的。 */}
      <small className="mansion-phasebar__caption">{caption}</small>

      {/* 推进键。圆形是这一组里唯一的非菱形轮廓,所以它天然读作「动作」
          而不是「又一格时刻」。 */}
      <button
        type="button"
        className="mansion-phasebar__advance"
        onClick={onAdvance}
        aria-label="推进相位"
      >
        <svg viewBox="0 0 50 50" aria-hidden="true">
          <circle cx="25" cy="25" r="20" fill="#070c0d" opacity=".6" transform="translate(0 2.5)" />
          <circle cx="25" cy="25" r="20" fill="var(--mansion-slot-fill)" />
          {/* 同样的方向性光照:上半受光、下半背光。 */}
          <path d="M5 25 A20 20 0 0 1 45 25 Z" fill="var(--mansion-slot-lit)" opacity=".7" />
          <path d="M5 25 A20 20 0 0 0 45 25 Z" fill="var(--mansion-slot-shade)" opacity=".72" />
          <circle cx="25" cy="25" r="20" fill="none" stroke="var(--abyssa-frame-dark)" strokeWidth="6" />
          <circle cx="25" cy="25" r="20" fill="none" stroke="var(--mansion-slot-edge)" strokeWidth="2.8" />
          <circle cx="25" cy="25" r="20" fill="none" stroke="var(--abyssa-frame-deep)" strokeWidth="1.1" />
          <path
            d="M9 16 A20 20 0 0 1 41 16"
            fill="none"
            stroke="var(--mansion-slot-rim)"
            strokeWidth="1.4"
            strokeLinecap="round"
            opacity=".7"
          />
          {/* 双箭头 = 推进一格。与 ArrowButton 的 double 同形。 */}
          <path
            d="M18 17 L26 25 L18 33 M27 17 L35 25 L27 33"
            fill="none"
            stroke="var(--mansion-advance-ink)"
            strokeWidth="2.9"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>
    </div>
  );
}
