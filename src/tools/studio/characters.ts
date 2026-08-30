import { CHARACTER_EXPRESSIONS, EXPRESSION_LABELS } from "../../shared/ui/patterns/expressions";

/**
 * 十人名册 —— 立绘素材目录(src/assets/png/<id>/)与角色名的对应表。
 *
 * 顺序与 spriteCalibration.ts / rp.css 那两张表**保持一致**(字母序)。
 * 这一点是刻意的:导出的表体要能与源文件逐行对照,顺序一变就得肉眼比对,
 * 那正是这个工具想消除的工作。
 *
 * 中文名取自 src/content/characters/profiles.ts 与 st/setting/char/ 的设定档,
 * 两处一致的就用,只在设定档里出现的(tibby)从那里取。
 */
export interface RosterEntry {
  id: string;
  name: string;
}

export const ROSTER: RosterEntry[] = [
  { id: "abyssa", name: "艾比希斯·贝尔泽兰" },
  { id: "alvitr", name: "阿尔薇特·塞维琳" },
  { id: "elora", name: "艾洛拉·亚金特" },
  { id: "eustice", name: "尤斯缇丝·格里芬" },
  { id: "kororo", name: "柯萝萝·拉普拉斯" },
  { id: "lenore", name: "蕾诺尔·伏尼契" },
  { id: "marietta", name: "玛丽埃塔·克雷格" },
  { id: "norma", name: "诺玛·洛克" },
  { id: "tibby", name: "缇比·奥雷利亚" },
  { id: "vivienne", name: "薇薇安·桑格温" }
];

export const NAME_BY_ID: Record<string, string> = Object.fromEntries(
  ROSTER.map(({ id, name }) => [id, name])
);

/** 标准表情代号,a–n 十四个。 */
export const BASE_EXPRESSIONS = Object.keys(EXPRESSION_LABELS);

/**
 * 某角色的全部表情代号,标准的在前、专属的在后。
 *
 * 专属表情(star-eyes / >_< / wink / cat-mouth / smiling-eyes)只有部分角色有,
 * 所以必须逐角色算,不能用一张固定列表 —— 那样切到没有专属表情的角色时
 * 会渲染出一堆点了没反应的按钮。
 */
export function expressionsOf(id: string): string[] {
  const table = CHARACTER_EXPRESSIONS[id];
  if (!table) return [];
  const all = Object.keys(table);
  const base = all.filter((k) => k in EXPRESSION_LABELS);
  const special = all.filter((k) => !(k in EXPRESSION_LABELS));
  return [...base, ...special];
}

/** 表情标签。专属表情没有语义名,直接显示原 key(它本身就有表意)。 */
export function labelOf(expression: string): string {
  return EXPRESSION_LABELS[expression] ?? expression;
}
