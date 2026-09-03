/* 角色档案「页签面板」层的几何。
   ------------------------------------------------------------------
   为什么单独成文件:
     这些量描述的是**任何**一个页签页所处的槽位 —— 槽位多宽多高、
     页签行吃掉多少、RpgFrame 外环留多少余隙。它们与「骰装」毫无关系,
     只是骰装恰好是第一个用到它们的页。

     原先它们叫 DICE_PANEL_W / DICE_TOP_CLEARANCE 之类,住在
     diceLoadoutGeometry.ts 里。第二个页签页(记事)要用同一批数字时,
     DICE_ 前缀就成了误导:读者会以为记事页在复用骰装的私有布局,
     而实际上两者只是住在同一个槽位里。

   分界线:
     本文件 = 槽位与外框(页签页共用)
     diceLoadoutGeometry.ts = 骰网、挂坠列、合骰预览(骰装私有)

   固定画布内禁用 vw/vh 与媒体查询重排,所以这些量必须是确定的 px。 */

/** 详情列宽。由角色档案的两列版面反推:
    screen 宽 = 646 * 5/3 + 74,减 shell 内衬与左栏 340 + gap 18。 */
export const CHARACTER_PANEL_W = 718.67;

/* 页签行高度随**页签数量**变化,不是常量。
   .__tabs 宽 min(100%, 422)、gap 12、单个 flex:1 0 90 且 max-width:104,
   svg viewBox 180x78 ⇒ 高 = 宽 * 78/180,margin-bottom:-5 后计入流内。

     4 个页签:每个 96.50 → 行高 41.82 → 流内 36.82 → 面板 609.18
     3 个页签:每个 104.00 → 行高 45.07 → 流内 40.07 → 面板 605.93

   曾把 609.18(4 页签的值)写死成常量,改成 3 个页签后
   面板比槽位高 3.25px,切到骰装页时把整张卡片顶开 3.25px。
   概要页用 height:100% 跟着槽位走,所以只有写死高度的页会涨。 */
const CHARACTER_TABS_W = 422;
const CHARACTER_TAB_GAP = 12;
const CHARACTER_TAB_MAX_W = 104;
const CHARACTER_TAB_RATIO = 78 / 180;
/** 页签靠负 margin 压回的量。 */
const CHARACTER_TAB_PULL = 5;
/** 详情列的最小高度,也是页签 + 面板的总高。 */
const CHARACTER_DETAILS_H = 646;

export function characterTabRowHeight(tabCount: number): number {
  const available = CHARACTER_TABS_W - CHARACTER_TAB_GAP * (tabCount - 1);
  const each = Math.min(CHARACTER_TAB_MAX_W, available / tabCount);
  return each * CHARACTER_TAB_RATIO;
}

export function characterTabPanelHeight(tabCount: number): number {
  return (
    CHARACTER_DETAILS_H - (characterTabRowHeight(tabCount) - CHARACTER_TAB_PULL)
  );
}

/** 本应用的页签数(概要 / 骰装 / 记事)。
    写死高度的页必须用这个数推导,不能抄别的页签数下的值。 */
export const CHARACTER_TAB_COUNT = 3;

/** 页签页的槽位高。 */
export const CHARACTER_PANEL_H = characterTabPanelHeight(CHARACTER_TAB_COUNT);

/** 页签向面板内侵入的量(translateY(6) 后压进 11px)。 */
export const CHARACTER_TAB_OVERLAP = 11;

/** RpgFrame 外环的安全余隙。 */
export const CHARACTER_PANEL_FRAME_CLEARANCE = 6;
/** 顶部余隙:让出被页签压住的那一段,再加 RpgFrame 外环。 */
export const CHARACTER_PANEL_TOP_CLEARANCE = CHARACTER_TAB_OVERLAP + 5;

export const CHARACTER_PANEL_INNER_W =
  CHARACTER_PANEL_W - CHARACTER_PANEL_FRAME_CLEARANCE * 2;
export const CHARACTER_PANEL_INNER_H =
  CHARACTER_PANEL_H -
  CHARACTER_PANEL_TOP_CLEARANCE -
  CHARACTER_PANEL_FRAME_CLEARANCE;

/** RpgFrame padding="sm" 是 14px,加 1px 边框,双边共 30px。
    这是那个 primitive 的属性,与具体页无关。 */
export const RPG_FRAME_SM_INSET = (14 + 1) * 2;
