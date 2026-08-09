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
  // 实测:内容几乎撑满全画布(含头发/特效),视觉身高差异主要靠 scale 微调
  abyssa:   { scale: 1.0,  x: 0,     y: 0 },
  alvitr:   { scale: 1.0,  x: 0,     y: 0 },
  elora:    { scale: 0.96, x: 0.005, y: 0 },   // top=41 略矮
  eustice:  { scale: 0.97, x: 0,     y: 0 },
  kororo:   { scale: 1.0,  x: 0,     y: 0 },
  lenore:   { scale: 0.97, x: 0.004, y: 0 },
  marietta: { scale: 0.96, x: 0,     y: 0 },   // 内容略窄
  norma:    { scale: 0.99, x: 0,     y: 0 },
  tibby:    { scale: 0.98, x: 0,     y: 0 },
  vivienne: { scale: 0.98, x: 0,     y: 0 }
};

export function getCalibration(characterId: string): Required<SpriteCalibration> {
  const c = CHARACTER_CALIBRATION[characterId];
  return { scale: c?.scale ?? 1, x: c?.x ?? 0, y: c?.y ?? 0 };
}
