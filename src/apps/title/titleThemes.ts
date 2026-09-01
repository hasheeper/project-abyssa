/* ============ 标题画面主题 ============
 *
 * 三套皮肤:黑金 / 猩红 / 青幽。切换只改 CSS 变量,不改任何几何 ——
 * 构图由 titleGeometry.ts 单独负责,主题不许碰尺寸。
 *
 * 结构照 apps/battle/battleUiSkins.ts 的既有先例(id + label + secondaryLabel),
 * 但没有下沉共享:那边描述出击编队的指挥体系,这边只是标题的视觉皮肤,
 * 两者的字段会各自长歪。模块边界也禁止 app 互相 import。
 *
 * ---- 猩红为什么是默认 ----
 * 取值不是凭感觉挑的,是从 cg-b-1 / cg-b-2 的像素里量出来的:
 *   两张 CG 的饱和像素有 22.3% / 24.7% 落在 345°..360° 红色区间,
 *   青蓝区间合计不到 0.2%;最高饱和色 #e31620 / #d51112;
 *   最亮处 #fbf0ed / #faeae5(近白偏暖);暗部 #010102(近纯黑)。
 * 所以 CG 在场时,猩红是唯一不会和画面打架的主题。
 */

export type TitleThemeId = "black-gold" | "crimson" | "verdigris";

export interface TitleThemeDefinition {
  id: TitleThemeId;
  label: string;
  /** 很短的拉丁副名,与 battle 皮肤的 secondaryLabel 同一用法。 */
  secondaryLabel: string;
  /** 画布底色。CG 在其上叠加,所以必须比 CG 暗部更深。 */
  canvas: string;
}

export const TITLE_THEMES: readonly TitleThemeDefinition[] = [
  {
    // CG 实测的主色区间,默认。
    id: "crimson",
    label: "猩红",
    secondaryLabel: "CRIMSON",
    canvas: "#070304"
  },
  {
    // 原始基线:logo 自身的金/象牙渐变。
    id: "black-gold",
    label: "黑金",
    secondaryLabel: "BLACK GOLD",
    canvas: "#050707"
  },
  {
    // 全局 tokens.css 的青灰血统,压暗加深后的版本。
    id: "verdigris",
    label: "青幽",
    secondaryLabel: "VERDIGRIS",
    canvas: "#04080a"
  }
] as const;

export const DEFAULT_TITLE_THEME: TitleThemeId = "crimson";

export function resolveTitleTheme(id: TitleThemeId): TitleThemeDefinition {
  return TITLE_THEMES.find((theme) => theme.id === id) ?? TITLE_THEMES[0];
}

export function getNextTitleTheme(id: TitleThemeId): TitleThemeId {
  const index = TITLE_THEMES.findIndex((theme) => theme.id === id);
  return TITLE_THEMES[(index + 1) % TITLE_THEMES.length].id;
}
