/**
 * 逐角色立绘校准表。
 *
 * 每个角色在 PSD 画布里的实际身高/站位略有差异(头发、特效、体型不同),
 * 这里提供**逐角色**的微调参数,按真实观感校准,而不是按画布尺寸一刀切。
 *
 * - scale : 缩放倍率(1 = 原始)。身高偏矮的角色调大,偏高的调小。
 * - x     : 水平偏移,相对立绘宽度的比例(正 = 右移,负 = 左移)。
 * - y     : 垂直偏移,相对立绘高度的比例(正 = 下移)。
 *
 * 初值按各角色实测内容范围估出,供你在「对照平铺」Story 里边看边调。
 */

export interface SpriteCalibration {
  scale?: number;
  x?: number;
  y?: number;
}

export const CHARACTER_CALIBRATION: Record<string, SpriteCalibration> = {
  abyssa:   { scale: 0.875, x: 0.008,  y: -0.044 },   // 艾比希斯·贝尔泽兰
  alvitr:   { scale: 0.945, x: -0.002, y: -0.073 },   // 阿尔薇特·塞维琳
  elora:    { scale: 0.905, x: -0.034, y: -0.044 },   // 艾洛拉·亚金特
  eustice:  { scale: 0.925, x: 0.009,  y: -0.037 },   // 尤斯缇丝·格里芬
  kororo:   { scale: 0.9,   x: -0.019, y: -0.076 },   // 柯萝萝·拉普拉斯
  lenore:   { scale: 0.885, x: 0.011,  y: -0.042 },   // 蕾诺尔·伏尼契
  marietta: { scale: 0.955, x: 0.005,  y: -0.032 },   // 玛丽埃塔·克雷格
  norma:    { scale: 0.86,  x: -0.03,  y: -0.064 },   // 诺玛·洛克
  tibby:    { scale: 0.88,  x: -0.023, y: -0.071 },   // 缇比·奥雷利亚
  vivienne: { scale: 0.95,  x: 0.009,  y: -0.045 }    // 薇薇安·桑格温
};

export function getCalibration(characterId: string): Required<SpriteCalibration> {
  const c = CHARACTER_CALIBRATION[characterId];
  return { scale: c?.scale ?? 1, x: c?.x ?? 0, y: c?.y ?? 0 };
}
