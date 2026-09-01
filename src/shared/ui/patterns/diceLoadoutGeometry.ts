/* 骰装页**私有**布局几何。
   ------------------------------------------------------------------
   槽位与外框(面板多宽多高、页签吃掉多少、RpgFrame 余隙)已抽到
   characterTabPanelGeometry.ts —— 那些量是所有页签页共用的,
   叫 DICE_ 会让人误以为记事页在复用骰装的私有布局。

   本文件只留真正属于骰装的东西:

     挂坠列 | 命骰十字阵 + 六面合骰预览
            | 检视详情

   六个现有骰面保持原数据与交互，不额外制造参考稿里疑似“当前面预览”的
   第七块骰面。六面采用标准的 1–4–1 骰网排列。 */

import {
  CHARACTER_PANEL_FRAME_CLEARANCE,
  CHARACTER_PANEL_H,
  CHARACTER_PANEL_INNER_H,
  CHARACTER_PANEL_INNER_W,
  CHARACTER_PANEL_TOP_CLEARANCE,
  CHARACTER_PANEL_W,
  CHARACTER_TAB_COUNT,
  CHARACTER_TAB_OVERLAP,
  RPG_FRAME_SM_INSET
} from "./characterTabPanelGeometry";

/* 槽位量沿用共用定义。此处以骰装的旧名再导出,是为了让
   components-dice-loadout.css 的镜像注释与既有测试仍能对照阅读;
   新的页签页请直接从 characterTabPanelGeometry 取。 */
export const DICE_PANEL_W = CHARACTER_PANEL_W;
export const DICE_PANEL_H = CHARACTER_PANEL_H;
export const DICE_TAB_COUNT = CHARACTER_TAB_COUNT;
export const DICE_TAB_OVERLAP = CHARACTER_TAB_OVERLAP;
export const DICE_FRAME_CLEARANCE = CHARACTER_PANEL_FRAME_CLEARANCE;
export const DICE_TOP_CLEARANCE = CHARACTER_PANEL_TOP_CLEARANCE;
export const DICE_INNER_W = CHARACTER_PANEL_INNER_W;
export const DICE_INNER_H = CHARACTER_PANEL_INNER_H;
export const DICE_FRAME_INSET = RPG_FRAME_SM_INSET;

/** 左侧挂坠竖列与右侧内容之间的间距。 */
export const DICE_CHARM_COLUMN_W = 112;
export const DICE_STAGE_GAP = 14;
export const DICE_CONTENT_W =
  DICE_INNER_W - DICE_CHARM_COLUMN_W - DICE_STAGE_GAP;

/** 六面骰网：上方 1 面，中间 4 面，下方 1 面。 */
export const DICE_FACE_CELL = 88;
export const DICE_FACE_GAP = 8;
export const DICE_NET_COLUMNS = 4;
export const DICE_NET_ROWS = 3;
export const DICE_NET_W =
  DICE_FACE_CELL * DICE_NET_COLUMNS + DICE_FACE_GAP * (DICE_NET_COLUMNS - 1);
export const DICE_NET_H =
  DICE_FACE_CELL * DICE_NET_ROWS + DICE_FACE_GAP * (DICE_NET_ROWS - 1);

/** 上方面板右侧的 3D 合骰预览；余宽全部交给左侧展开骰阵。 */
export const DICE_CUBE_PREVIEW_W = 146;
export const DICE_CUBE_PREVIEW_GAP = 12;
export const DICE_CUBE_SIZE = 96;
export const DICE_NET_LANE_W =
  DICE_CONTENT_W - DICE_FRAME_INSET - DICE_CUBE_PREVIEW_W - DICE_CUBE_PREVIEW_GAP;

export const DICE_TITLE_H = 20;
export const DICE_SECTION_GAP = 14;

/** 骰阵区收紧，把高度留给下方详情栏。 */
export const DICE_NET_SECTION_H = 340;
export const DICE_INSPECTOR_H =
  DICE_INNER_H - DICE_NET_SECTION_H - DICE_SECTION_GAP;

export const DICE_NET_PLACEMENTS: readonly {
  face: 1 | 2 | 3 | 4 | 5 | 6;
  row: number;
  column: number;
}[] = [
  { face: 1, row: 1, column: 2 },
  { face: 2, row: 2, column: 1 },
  { face: 3, row: 2, column: 2 },
  { face: 4, row: 2, column: 3 },
  { face: 5, row: 2, column: 4 },
  { face: 6, row: 3, column: 2 }
];
