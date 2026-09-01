import { ABYSSA_LOGO_PARTS } from "./abyssaLogoLayout";
import type { AbyssaLogoPartId } from "./abyssaLogoLayout";

/* ============ Logo 入场动画时序 ============
 *
 * 轻小说式的「逐个部件弹入」。顺序按**阅读习惯**排,而不是按 SVG 里的绘制
 * 顺序(绘制顺序是为了图层压盖关系,与阅读无关):
 *
 *   1. 图章 / 两侧短线   —— 环境层,先把舞台铺好
 *   2. 伺候 → 魔王 → 也算 → 拯救世界 → 吗 —— 细分到词尾重音
 *   3. 问号             —— 句子的收尾,单独一拍
 *   4. 中央分隔线        —— 横向展开,把上下分开
 *   5. 底部英文字标      —— 保留原有的渐变揭开
 *   6. 英文字标三颗菱形  —— 字标出现后由近到远逐颗弹入
 *
 * 环境层刻意比标题更慢、更淡地进入(见 KIND),它们不该抢第一行的注意。
 */

/** 部件的入场性质。决定用哪一条 keyframes。 */
export type AbyssaLogoIntroKind =
  /** 环境层:淡入 + 极轻微放大,不弹。 */
  | "ambient"
  /** 标题字:放大落定 + 轻微上浮,带回弹。 */
  | "pop"
  /** 从中心横向展开。分隔线专用 —— 线就该是「拉开」,不是「弹出」。 */
  | "sweep"
  /** 收尾的一拍:更慢、更沉,给问号用。 */
  | "accent"
  /** 从中心向两侧揭开。英文字标专用 —— 整块弹出太糊弄。 */
  | "reveal"
  /** 组本身保持静态,入场由内部的字词或装饰片段负责。 */
  | "composite";

export interface AbyssaLogoIntroStep {
  part: AbyssaLogoPartId;
  /** 相对入场起点的延迟(ms)。 */
  delay: number;
  kind: AbyssaLogoIntroKind;
}

/**
 * 阅读顺序时序表。
 *
 * 数值是「轻小说」而不是「3A 开场」的关键:起笔快、落定留余韵,
 * 各句的可见落点刻意不等距。总时长由底部字标的收尾决定。
 */
export const ABYSSA_LOGO_INTRO_SEQUENCE: readonly AbyssaLogoIntroStep[] = [
  { part: "stamp", delay: 0, kind: "ambient" },
  { part: "sideOrnaments", delay: 180, kind: "ambient" },
  { part: "titleTop", delay: 420, kind: "composite" },
  { part: "titleMiddle", delay: 1_268, kind: "composite" },
  { part: "titleBottom", delay: 1_460, kind: "composite" },
  /* 分隔线在三行标题落定之后才拉开,它是「上下分界」的宣告。 */
  { part: "divider", delay: 2_180, kind: "sweep" },
  /* 问号单独一拍,而且更慢 —— 它是整句话的语气,不该和标题同速。 */
  { part: "questionMark", delay: 2_450, kind: "accent" },
  /* 组内先保留原有的渐变揭开,再逐颗弹入装饰菱形。 */
  { part: "wordmark", delay: 2_920, kind: "composite" }
] as const;

/** 单拍时长(ms)。ambient 用更长的时间淡入,所以单独给。 */
export const ABYSSA_LOGO_INTRO_DURATION = {
  ambient: 1_000,
  pop: 540,
  sweep: 780,
  /* 收尾一拍最慢,留出停顿感。 */
  accent: 900,
  /* 揭开是整段最长的动作,压轴要沉得住。 */
  reveal: 1_050,
  /* composite 的真实时长由下面的内部片段表决定。 */
  composite: 0
} as const;

/** 需要从八个可编辑大部件中再拆细的内部动画。 */
export const ABYSSA_LOGO_INTRO_PIECES = {
  /* 可见落点刻意排成短—长—短—长,不是把 delay 等距递增:
       伺候 564ms → 魔王 844ms  (+280)
       魔王 844ms → 也算 1364ms (+520)
       也算 1364ms → 拯救世界 1604ms (+240)
       拯救世界 1604ms → 吗 2104ms (+500)
     duration 留给落点后的回弹,不会拖慢字真正出现的时刻。 */
  titleTopLead: { delay: 420, duration: 600 },
  titleTopAccent: { delay: 748, duration: 600 },
  titleMiddleBridge: { delay: 1_268, duration: 400 },
  titleBottomLead: { delay: 1_460, duration: 600 },
  titleBottomTail: { delay: 2_024, duration: 500 },
  /* 保留渐变揭开；三颗菱形在字标已清晰可见后介入,无需等遮罩完全收尾。 */
  wordmarkArt: { delay: 2_920, duration: 1_050 },
  wordmarkGemNear: { delay: 3_550, duration: 320 },
  wordmarkGemMiddle: { delay: 3_625, duration: 320 },
  wordmarkGemFar: { delay: 3_700, duration: 320 }
} as const;

export type AbyssaLogoIntroPieceId = keyof typeof ABYSSA_LOGO_INTRO_PIECES;

/** 整段入场的总时长,供调用方安排后续动作(如提示行淡入)。 */
const PART_INTRO_TOTAL_MS = ABYSSA_LOGO_INTRO_SEQUENCE.reduce(
  (longest, step) => Math.max(longest, step.delay + ABYSSA_LOGO_INTRO_DURATION[step.kind]),
  0
);

const PIECE_INTRO_TOTAL_MS = Object.values(ABYSSA_LOGO_INTRO_PIECES).reduce(
  (longest, piece) => Math.max(longest, piece.delay + piece.duration),
  0
);

export const ABYSSA_LOGO_INTRO_TOTAL_MS = Math.max(
  PART_INTRO_TOTAL_MS,
  PIECE_INTRO_TOTAL_MS
);

const STEP_BY_PART = new Map(ABYSSA_LOGO_INTRO_SEQUENCE.map((step) => [step.part, step]));

export function getAbyssaLogoIntroStep(part: AbyssaLogoPartId): AbyssaLogoIntroStep {
  const step = STEP_BY_PART.get(part);
  /* 时序表必须覆盖全部部件。缺一个就会让它永远停在 opacity:0 ——
     宁可回退成「无延迟立即显示」,也不要凭空消失。 */
  return step ?? { part, delay: 0, kind: "ambient" };
}

/** 时序表是否覆盖了所有部件。由测试守,避免新增部件时漏配。 */
export function isAbyssaLogoIntroComplete(): boolean {
  return ABYSSA_LOGO_PARTS.every((part) => STEP_BY_PART.has(part));
}
