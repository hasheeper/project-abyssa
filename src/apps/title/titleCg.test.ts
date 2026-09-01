import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { TITLE_CG_DWELL_MS, TITLE_CG_FRAMES, TITLE_CG_RIGHT_OFFSET } from "./titleCg";

/* 「不许露馅」是硬约束,所以直接读源码断言,而不是靠肉眼复查。
   jsdom 不做布局也不解析遮罩,这些性质只能在样式表文本层面守。 */
const css = readFileSync("src/apps/title/title.css", "utf8");

function ruleOf(selector: string) {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = css.match(new RegExp(`${escaped}\\s*\\{([^}]*)\\}`));
  expect(match, `missing rule: ${selector}`).toBeTruthy();
  return match![1];
}

describe("title CG carousel", () => {
  it("ships all five CG frames as WebP, not the multi-megabyte PNGs", () => {
    expect(TITLE_CG_FRAMES).toHaveLength(5);
    for (const frame of TITLE_CG_FRAMES) {
      expect(frame.src).toMatch(/\.webp($|\?)/);
    }
  });

  it("desyncs the two sides so they never flip together", () => {
    expect(TITLE_CG_DWELL_MS.left).not.toBe(TITLE_CG_DWELL_MS.right);
    expect(TITLE_CG_RIGHT_OFFSET % TITLE_CG_FRAMES.length).not.toBe(0);
  });
});

describe("CG edge containment", () => {
  it("masks the container, not just the image", () => {
    // 露馅过一次:遮罩只加在 <img> 上,而主题染色层是 .title-cg::after ——
    // 它没被裁,于是在金/青主题下露出整块矩形边界。遮罩必须在容器上。
    const container = ruleOf(".title-cg");
    expect(container).toMatch(/mask-image:/);
    expect(container).toMatch(/mask-composite:\s*intersect/);
  });

  it("does not re-mask the frame, which would escape the container mask", () => {
    const frame = ruleOf(".title-cg__frame");
    expect(frame).not.toMatch(/mask-image:/);
  });

  it("never lets the tint carry its own mask or become a bare rectangle", () => {
    const tint = ruleOf(".title-cg::after");
    // 染色层必须是 .title-cg 的伪元素(从而继承容器遮罩),且不自带遮罩。
    expect(tint).not.toMatch(/mask/);
    expect(tint).toMatch(/mix-blend-mode:\s*color/);
  });

  it("fades every edge of the container mask to fully transparent", () => {
    const container = ruleOf(".title-cg");
    const mask = container.match(/mask-image:\s*([\s\S]*?);/)![1];

    // 按括号深度切分。正则做不到:`to right, #000` 的逗号会劈开一层,
    // 而 `rgb(0 0 0 / 58%)` 的嵌套括号又会让贪婪匹配提前收尾。
    const layers: string[] = [];
    let depth = 0;
    let current = "";
    for (const char of mask) {
      if (char === "(") depth += 1;
      if (char === ")") depth -= 1;
      if (char === "," && depth === 0) {
        layers.push(current.trim());
        current = "";
        continue;
      }
      current += char;
    }
    if (current.trim()) layers.push(current.trim());
    expect(layers.length).toBeGreaterThanOrEqual(3);

    // 每一层都必须含一个完全透明的端点,否则那条边就是硬边。
    for (const layer of layers) {
      expect(layer, `layer without a transparent stop: ${layer}`).toMatch(/transparent/);
    }
  });

  it("keeps the tint weak enough that a seam would not read as a block", () => {
    // 染色越重,任何遮罩缝隙越明显。金/青一度是 0.42,正是露馅那次的值。
    const tint = ruleOf(".title-cg::after");
    const opacity = Number(tint.match(/opacity:\s*([\d.]+)/)![1]);
    expect(opacity).toBeLessThanOrEqual(0.32);
  });
});

describe("shade layer", () => {
  it("leaves the centre completely clear so the pattern reads", () => {
    // 黑幕的作用是压暗四周**衬托**中央图案,不是把中央一起糊掉。
    const shade = ruleOf(".title-shade");
    // 渐变位置含 var(...) 的内层右括号,不能用“遇到首个 ), 就结束”的正则
    // 截取 radial-gradient；直接守住它的透明首停点更可靠。
    expect(shade).toMatch(/radial-gradient\([\s\S]*?rgb\(0 0 0 \/ 0%\)\s*0%/);
  });

  it("guards all four canvas edges", () => {
    // 第二道保险:即使图片遮罩留了残余 alpha,画布边缘的黑也会吃掉它。
    const shade = ruleOf(".title-shade");
    for (const direction of ["to bottom", "to top", "to right", "to left"]) {
      expect(shade, `missing edge guard: ${direction}`).toContain(direction);
    }
  });
});
