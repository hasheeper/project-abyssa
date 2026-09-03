import { existsSync, readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

/* ============ 层叠护栏 ============
 *
 * 这一条是为一个真实事故写的：
 *   padding 写在 `.abyssa-sortie-roster > .abyssa-frame__content`（0-2-0），
 *   被 foundation 的 `.abyssa-frame[data-padding="none"] > ...`（0-3-0）压掉，
 *   界面上内容一直贴着边框，而当时的"护栏"全绿。
 *
 * 两种做不到的验证方式，都试过了：
 *   1. 读源码文本 —— 只能证明「我写了这条规则」，证明不了「它赢了」；
 *   2. jsdom + getComputedStyle —— jsdom **不实现权重比较**，
 *      只按源码顺序取最后一条。实测 `.a[data-p]>.c{padding:0}` 后跟
 *      `.b>.c{padding:20px}`，jsdom 给 20px，浏览器给 0px。
 *
 * 所以只能对构建产物做真正的权重算术：找出所有给
 * `.abyssa-frame__content` 设 padding 的规则，比 (权重, 位置)。 */

const DIST = resolve(import.meta.dirname, "../../../../map-dist/assets");

function bundledCss(): string | null {
  if (!existsSync(DIST)) return null;
  const file = readdirSync(DIST).find((name) => name.endsWith(".css"));
  return file ? readFileSync(resolve(DIST, file), "utf8") : null;
}

const CSS = bundledCss();

/** 只数类 / 属性 / 伪类。这批选择器里没有 id，也没有内联样式。 */
function specificity(selector: string): number {
  const classes = (selector.match(/\.[\w-]+/g) ?? []).length;
  const attributes = (selector.match(/\[[^\]]*\]/g) ?? []).length;
  const pseudoClasses = (selector.match(/:(?!:)[\w-]+/g) ?? []).length;
  return classes + attributes + pseudoClasses;
}

interface PaddingRule {
  selector: string;
  value: string;
  position: number;
  weight: number;
}

/** 找出所有给 .abyssa-frame__content 设 padding 的规则，按胜负排序。 */
function paddingRules(css: string): PaddingRule[] {
  const rules: PaddingRule[] = [];
  const pattern = /([^{}]*\.abyssa-frame__content[^{}]*)\{([^}]*)\}/g;
  for (const match of css.matchAll(pattern)) {
    const declarations = match[2];
    const padding = declarations.match(/(?:^|;)\s*padding:\s*([^;]+)/);
    if (!padding) continue;
    for (const selector of match[1].split(",")) {
      const trimmed = selector.trim();
      if (!trimmed.includes(".abyssa-frame__content")) continue;
      rules.push({
        selector: trimmed,
        value: padding[1].trim(),
        position: match.index ?? 0,
        weight: specificity(trimmed)
      });
    }
  }
  return rules;
}

/** 元素实际带的类名集合；规则里出现的每个类都得在其中，才算命中。 */
function winner(rules: PaddingRule[], classNames: string[]): PaddingRule | undefined {
  const owned = new Set(classNames);
  const applicable = rules.filter((rule) =>
    (rule.selector.match(/\.[\w-]+/g) ?? []).every((token) => owned.has(token.slice(1)))
  );
  return applicable.sort((a, b) =>
    a.weight === b.weight ? a.position - b.position : a.weight - b.weight
  ).at(-1);
}

const describeBundled = CSS ? describe : describe.skip;

describeBundled("sortie frame cascade", () => {
  const rules = paddingRules(CSS ?? "");

  /* 先确认竞争规则确实在产物里 —— 否则下面的比较是在跟空气赛跑。 */
  it("ships the foundation padding reset it has to outrank", () => {
    const reset = rules.find((rule) => /\[data-padding=(?:"none"|none)\]/.test(rule.selector));
    expect(reset).toBeDefined();
    expect(reset!.value).toBe("0");
    expect(reset!.weight).toBe(3);
  });

  it("gives both overlays a padding that outranks that reset", () => {
    for (const name of ["abyssa-sortie-roster", "abyssa-sortie-quest"]) {
      const won = winner(rules, [name, "abyssa-frame", "abyssa-frame__content"]);
      expect(won, name).toBeDefined();
      /* 胜出的必须是我们自己那条，而不是 foundation 的 padding:0。 */
      expect(won!.selector, name).toContain(name);
      expect(won!.value, name).not.toBe("0");
    }
  });

  /* RpgFrame 三层装饰的最内侧：inset:10 处 2px 宽的四角括号 → 12px。
     padding 要压过它，且净间隙 6px 以上才不显得「贴着」。 */
  it("clears the frame ornaments by a visible margin", () => {
    const token = CSS!.match(/--sortie-pad:\s*([0-9.]+)px/);
    expect(token).not.toBeNull();
    const padding = Number(token![1]);
    expect(padding - 12).toBeGreaterThanOrEqual(6);

    expect(
      winner(rules, ["abyssa-sortie-roster", "abyssa-frame", "abyssa-frame__content"])!.value
    ).toBe(
      "var(--sortie-roster-pad-top) var(--sortie-roster-pad-x) var(--sortie-roster-pad-bottom)"
    );
    expect(
      winner(rules, ["abyssa-sortie-quest", "abyssa-frame", "abyssa-frame__content"])!.value
    ).toBe("var(--sortie-pad)");
  });
});
