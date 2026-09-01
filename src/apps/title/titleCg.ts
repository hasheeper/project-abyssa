import cgB1 from "../../assets/cg/cg-b-1.webp";
import cgB2 from "../../assets/cg/cg-b-2.webp";
import cgB3 from "../../assets/cg/cg-b-3.webp";
import cgB4 from "../../assets/cg/cg-b-4.webp";
import cgB5 from "../../assets/cg/cg-b-5.webp";

/* ============ 标题两侧 CG ============
 *
 * 原图 832×1216(比例 0.6842),统一压成 h=1100 的 WebP:
 * 五张合计约 717KB,远小于直接加载多兆字节 PNG —— 标题是首屏,
 * 不能把源图体积原样带进运行时。
 *
 * ---- 为什么用软遮罩而不是硬裁 ----
 * 五张 CG 的主体都在画面中央附近,
 * 不是我原先假设的「主体在外侧 60%」。所以任何贴着徽记的硬边裁切都会
 * 把人物切成两半。改用向内渐隐的遮罩:主体完整保留,只让最内侧的
 * 背景像素溶解掉。
 *
 * 满幅高 900 时宽 615.8,主体中线落在 x≈308,距徽记左边缘(x=492)还有
 * 184px 余量,所以满幅是安全的 —— 前提是遮罩足够软。
 */

export interface TitleCgFrame {
  src: string;
  /** 无障碍名。CG 是气氛层,不承担信息,所以对 AT 隐藏,这里只作调试用。 */
  label: string;
}

export const TITLE_CG_FRAMES: readonly TitleCgFrame[] = [
  { src: cgB1, label: "cg-b-1" },
  { src: cgB2, label: "cg-b-2" },
  { src: cgB3, label: "cg-b-3" },
  { src: cgB4, label: "cg-b-4" },
  { src: cgB5, label: "cg-b-5" }
] as const;

/**
 * 左右两侧从首轮等待、停留、淡化到取帧步进都不同。只改 dwell 仍会让
 * 首次切换与渐变速度看起来同拍,所以四个维度必须一起错开。
 */
export const TITLE_CG_DWELL_MS = { left: 8_800, right: 11_300 } as const;
export const TITLE_CG_INITIAL_DELAY_MS = { left: 6_200, right: 7_600 } as const;
export const TITLE_CG_FADE_MS = { left: 1_150, right: 1_700 } as const;
export const TITLE_CG_STEP = { left: 1, right: 2 } as const;

/** 右侧起手错开一张,避免两侧长期显示同一张。 */
export const TITLE_CG_RIGHT_OFFSET = 1;
