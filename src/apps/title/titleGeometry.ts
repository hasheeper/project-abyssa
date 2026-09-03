/* ============ 标题画面几何 ============
 *
 * 全部从 1600×900 共享画布推导。这里导出常量而不是把数写进 CSS,是因为
 * 竖向是一条**连锁的**加法链:改字标宽度会推动命令列的位置和上下留白。
 * 手抄一遍必然对不上 —— 见下面的 `TITLE_BLOCK_H` 断言。
 *
 * 竖向:
 *   上留白 44.08 | 徽记 531.36 | 间隔 48 | 命令列 232.49 | 下留白 44.08 = 900
 *
 * 横向全部居中。tight 裁切固定为 x=112..912,其中心正好落在 Logo
 * 的 authored x=512 中轴,所以直接 `margin-inline: auto` 即可。
 */

/** `AbyssaLogo crop="tight"` 的 viewBox 尺寸,比例 800/656 ≈ 1.2195。 */
const EMBLEM_VIEW_W = 800;
const EMBLEM_VIEW_H = 656;

/** `RibbonButton` 的固有比例(components-controls.css: aspect-ratio 820/68)。 */
const RIBBON_VIEW_W = 820;
const RIBBON_VIEW_H = 68;

/**
 * 底部信息带。提示行与版本行**不参与**中轴居中,而是独占画布底部这条带子。
 *
 * 曾经错过一次:提示行用 `bottom: 62px` 绝对定位,而命令列底边在 y=855.93,
 * 提示行占 y=819..838 —— 直接压在第四个键上,重叠 36.93px。
 * 「贴底边」和「垂直居中」是两套定位,混用必然算不准。
 */
export const TITLE_FOOTER_H = 68;

/** 中轴可用的竖向区域 = 画布高 - 底部信息带。 */
export const TITLE_STACK_REGION_H = 900 - TITLE_FOOTER_H;

export const TITLE_EMBLEM_W = 560;
export const TITLE_EMBLEM_H = (TITLE_EMBLEM_W * EMBLEM_VIEW_H) / EMBLEM_VIEW_W;

const TITLE_COMMAND_W = 520;
export const TITLE_COMMAND_GAP = 20;
export const TITLE_COMMAND_COUNT = 4;

/** 单个缎带键的实际高度。命令列高度必须由它推导,不能写死。 */
export const TITLE_RIBBON_H = (TITLE_COMMAND_W * RIBBON_VIEW_H) / RIBBON_VIEW_W;

export const TITLE_COMMAND_COLUMN_H =
  TITLE_COMMAND_COUNT * TITLE_RIBBON_H + (TITLE_COMMAND_COUNT - 1) * TITLE_COMMAND_GAP;

/** 徽记与命令列之间的呼吸。 */
const TITLE_STACK_GAP = 76;

export const TITLE_BLOCK_H = TITLE_EMBLEM_H + TITLE_STACK_GAP + TITLE_COMMAND_COLUMN_H;

/** 上下留白相等 —— 交给 flex 居中,这个值只用于验证与背景场定位。 */
export const TITLE_BLOCK_PAD = (TITLE_STACK_REGION_H - TITLE_BLOCK_H) / 2;

/** 命令列底边。必须小于 TITLE_STACK_REGION_H,否则会压到底部信息带。 */
export const TITLE_COMMAND_COLUMN_BOTTOM =
  TITLE_BLOCK_PAD + TITLE_EMBLEM_H + TITLE_STACK_GAP + TITLE_COMMAND_COLUMN_H;

/**
 * 徽记墨迹的垂直中心(画布坐标系)。Logo 自带印章的中心正好位于 tight
 * 裁切的几何中心,所以外部法阵也必须共用这个点。
 */
export const TITLE_EMBLEM_CENTRE_Y = TITLE_BLOCK_PAD + TITLE_EMBLEM_H / 2;
const TITLE_EMBLEM_CENTRE_X = 800;

/* ---- 背景场原点 ----
 *
 * 法阵是 Logo 背后的扩展纹样,不是整张画布的独立圆心。若写成画布中心
 * y=450,它会比 Logo 印章中心低约 188px,视觉上就像两套图案散开了。
 * 直接复用徽记中心,避免布局尺寸变化后再次漂移。
 */
export const TITLE_FIELD_CENTRE_X = TITLE_EMBLEM_CENTRE_X;
export const TITLE_FIELD_CENTRE_Y = TITLE_EMBLEM_CENTRE_Y;

/* ---- 两侧 CG ----
 * 原图 832×1216。满幅铺满画布高度,宽度由比例推导。
 *
 * 实测两张 CG 的主体都在**画面正中**(饱和像素 mean x 落在中线),
 * 所以内侧只能软遮罩渐隐,不能硬裁。这里导出主体中线与徽记边缘的余量,
 * 由测试守住 —— 余量一旦为负,人物就会被字标压住。
 */
const CG_VIEW_W = 832;
const CG_VIEW_H = 1216;

export const TITLE_CG_H = 800;
export const TITLE_CG_W = (TITLE_CG_H * CG_VIEW_W) / CG_VIEW_H;

/** CG 顶部留白。不再满幅铺满 —— 靠边、缩小,给中央空场让位。 */
export const TITLE_CG_TOP = 60;

/** CG 主体中线(距画布外缘)。主体居中,所以就是 CG 宽度的一半。 */
const TITLE_CG_SUBJECT_X = TITLE_CG_W / 2;

/** 徽记外缘距画布外缘。CG 主体必须落在它之内才不会被压。 */
export const TITLE_EMBLEM_EDGE_X = TITLE_EMBLEM_CENTRE_X - TITLE_EMBLEM_W / 2;

/** 主体中线到徽记边缘的余量。 */
export const TITLE_CG_SUBJECT_CLEARANCE = TITLE_EMBLEM_EDGE_X - TITLE_CG_SUBJECT_X;
