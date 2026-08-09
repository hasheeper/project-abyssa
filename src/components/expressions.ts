/**
 * 纸娃娃表达式映射表。
 *
 * 每个角色由 `base.png`(立绘底图)+ `eyes_N.png` + `mouth_N.png` +(可选)`face_N.png`
 * 叠加而成,所有组件都是同尺寸全画布、坐标已对齐。
 *
 * 下表把「表情代号」翻译为组件序号:
 *   - eyes  : 眼睛组件序号
 *   - mouth : 嘴巴组件序号
 *   - face  : 腮红/特效组件序号(可选)
 *
 * 表情代号:
 *   a neutral  b smile  c joy  d sad  e angry  f surprised  g serious
 *   h closed   i wry    j flustered  k displeased  l confident  m confused  n panicked
 *   另含各角色专属特殊表情(星星眼 / wink / >_< 等)。
 */

export interface ExpressionParts {
  eyes: number;
  mouth: number;
  face?: number;
}

export type ExpressionId =
  | "a" | "b" | "c" | "d" | "e" | "f" | "g"
  | "h" | "i" | "j" | "k" | "l" | "m" | "n"
  | (string & {});

/** 表情代号 → 语义名(供 UI 标注 / 调试)。 */
export const EXPRESSION_LABELS: Record<string, string> = {
  a: "neutral",
  b: "smile",
  c: "joy",
  d: "sad",
  e: "angry",
  f: "surprised",
  g: "serious",
  h: "closed",
  i: "wry",
  j: "flustered",
  k: "displeased",
  l: "confident",
  m: "confused",
  n: "panicked"
};

const p = (eyes: number, mouth: number, face?: number): ExpressionParts =>
  face === undefined ? { eyes, mouth } : { eyes, mouth, face };

export const CHARACTER_EXPRESSIONS: Record<string, Record<string, ExpressionParts>> = {
  abyssa: {
    a: p(1, 5), b: p(1, 8), c: p(4, 8), d: p(5, 2), e: p(4, 3), f: p(5, 1), g: p(4, 2),
    h: p(3, 5), i: p(2, 8), j: p(1, 9, 1), k: p(2, 2), l: p(4, 4), m: p(5, 1), n: p(5, 9, 1),
    "star-eyes": p(6, 1), "cat-mouth": p(3, 7)
  },
  alvitr: {
    a: p(2, 2), b: p(2, 1), c: p(1, 1), d: p(3, 3), e: p(3, 3), f: p(2, 2), g: p(2, 3),
    h: p(1, 4), i: p(3, 1), j: p(3, 2), k: p(3, 3), l: p(3, 1), m: p(3, 2), n: p(1, 3, 1)
  },
  elora: {
    a: p(1, 5), b: p(1, 2), c: p(3, 2), d: p(2, 1), e: p(2, 6), f: p(1, 4), g: p(1, 2),
    h: p(3, 5), i: p(2, 2), j: p(5, 3), k: p(4, 6), l: p(1, 2), m: p(1, 4), n: p(3, 3),
    ">_<": p(4, 3)
  },
  eustice: {
    a: p(5, 5), b: p(5, 3), c: p(1, 3), d: p(3, 2), e: p(5, 4), f: p(4, 5), g: p(5, 1),
    h: p(1, 5), i: p(3, 3), j: p(5, 1, 1), k: p(3, 4), l: p(2, 3), m: p(4, 1), n: p(4, 2, 1)
  },
  kororo: {
    a: p(1, 6), b: p(1, 1), c: p(2, 3), d: p(3, 6), e: p(3, 5), f: p(6, 4), g: p(3, 2),
    h: p(5, 6), i: p(3, 1), j: p(6, 7), k: p(2, 4), l: p(2, 1), m: p(3, 4), n: p(7, 7),
    wink: p(3, 7)
  },
  lenore: {
    a: p(1, 1), b: p(1, 2), c: p(3, 2), d: p(3, 2), e: p(1, 5), f: p(1, 3), g: p(1, 1),
    h: p(3, 1), i: p(2, 2), j: p(1, 4), k: p(1, 3), l: p(1, 2), m: p(3, 3), n: p(2, 4, 1)
  },
  marietta: {
    a: p(1, 4), b: p(1, 3), c: p(3, 3), d: p(2, 1), e: p(1, 1), f: p(1, 2), g: p(1, 4),
    h: p(3, 4), i: p(2, 3), j: p(4, 4), k: p(4, 2), l: p(1, 3), m: p(4, 2), n: p(3, 1, 1)
  },
  norma: {
    a: p(1, 4), b: p(1, 2), c: p(3, 2), d: p(2, 3), e: p(4, 3), f: p(4, 1), g: p(2, 5),
    h: p(3, 4), i: p(5, 2), j: p(4, 2), k: p(5, 1), l: p(5, 2), m: p(1, 1), n: p(4, 4)
  },
  tibby: {
    a: p(1, 6), b: p(1, 1), c: p(4, 3), d: p(1, 2), e: p(5, 6), f: p(5, 4), g: p(1, 6),
    h: p(2, 6), i: p(2, 3), j: p(4, 5), k: p(4, 2), l: p(4, 1), m: p(4, 4), n: p(5, 5),
    "smiling-eyes": p(3, 3)
  },
  vivienne: {
    a: p(1, 5), b: p(1, 6), c: p(2, 2), d: p(2, 4), e: p(6, 7), f: p(1, 4), g: p(6, 5),
    h: p(3, 5), i: p(5, 6), j: p(2, 3), k: p(2, 1), l: p(3, 2), m: p(1, 4), n: p(3, 7, 1)
  }
};

/**
 * face 层是「脸红」而非特效的角色。
 * 脸红属于皮肤妆容,必须压在眼睛之下,否则会盖住睫毛与眼白;
 * 其余角色的 face 是泪痕/汗滴一类特效,仍叠在最上。
 */
export const FACE_UNDER_EYES: ReadonlySet<string> = new Set(["eustice", "alvitr"]);

export function getExpressionParts(characterId: string, expression: ExpressionId): ExpressionParts | undefined {
  return CHARACTER_EXPRESSIONS[characterId]?.[expression];
}

export function hasCharacter(characterId: string): boolean {
  return characterId in CHARACTER_EXPRESSIONS;
}
