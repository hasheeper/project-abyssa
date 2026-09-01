import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  ABYSSA_LOGO_INTRO_DURATION,
  ABYSSA_LOGO_INTRO_PIECES,
  ABYSSA_LOGO_INTRO_SEQUENCE,
  ABYSSA_LOGO_INTRO_TOTAL_MS,
  getAbyssaLogoIntroStep,
  isAbyssaLogoIntroComplete
} from "./abyssaLogoIntro";
import { ABYSSA_LOGO_PARTS } from "./abyssaLogoLayout";

describe("logo intro sequence", () => {
  it("covers every part so none can be stranded at opacity 0", () => {
    // fill-mode: both + 漏配 = 该部件永远不出现。这条断言就是为它立的。
    expect(isAbyssaLogoIntroComplete()).toBe(true);
    expect(ABYSSA_LOGO_INTRO_SEQUENCE).toHaveLength(ABYSSA_LOGO_PARTS.length);
  });

  it("follows reading order: three title rows, then the question mark", () => {
    const order = ABYSSA_LOGO_INTRO_SEQUENCE.map((step) => step.part);
    const at = (part: string) => order.indexOf(part as never);

    expect(at("titleTop")).toBeLessThan(at("titleMiddle"));
    expect(at("titleMiddle")).toBeLessThan(at("titleBottom"));
    expect(at("titleBottom")).toBeLessThan(at("questionMark"));
    // 落款压轴。
    expect(at("wordmark")).toBe(order.length - 1);
  });

  it("lets the ambient layers open the stage before any title text", () => {
    const order = ABYSSA_LOGO_INTRO_SEQUENCE.map((step) => step.part);
    expect(order.indexOf("stamp")).toBeLessThan(order.indexOf("titleTop"));
    expect(order.indexOf("sideOrnaments")).toBeLessThan(order.indexOf("titleTop"));

    for (const part of ["stamp", "sideOrnaments"] as const) {
      expect(getAbyssaLogoIntroStep(part).kind).toBe("ambient");
    }
  });

  it("increases delay monotonically so parts never arrive out of order", () => {
    const delays = ABYSSA_LOGO_INTRO_SEQUENCE.map((step) => step.delay);
    for (let i = 1; i < delays.length; i += 1) {
      expect(delays[i]).toBeGreaterThan(delays[i - 1]);
    }
    expect(delays[0]).toBe(0);
  });

  it("keeps the complete intro within a readable title-screen beat", () => {
    expect(ABYSSA_LOGO_INTRO_TOTAL_MS).toBeGreaterThan(3_400);
    expect(ABYSSA_LOGO_INTRO_TOTAL_MS).toBeLessThan(4_600);
  });

  it("uses short-long-short-long visible beats for the Chinese title", () => {
    // “出现”看 opacity 到 1 的关键帧,而不是只看 animation-delay。
    const arrivals = [
      ABYSSA_LOGO_INTRO_PIECES.titleTopLead.delay
        + ABYSSA_LOGO_INTRO_PIECES.titleTopLead.duration * 0.24,
      ABYSSA_LOGO_INTRO_PIECES.titleTopAccent.delay
        + ABYSSA_LOGO_INTRO_PIECES.titleTopAccent.duration * 0.16,
      ABYSSA_LOGO_INTRO_PIECES.titleMiddleBridge.delay
        + ABYSSA_LOGO_INTRO_PIECES.titleMiddleBridge.duration * 0.24,
      ABYSSA_LOGO_INTRO_PIECES.titleBottomLead.delay
        + ABYSSA_LOGO_INTRO_PIECES.titleBottomLead.duration * 0.24,
      ABYSSA_LOGO_INTRO_PIECES.titleBottomTail.delay
        + ABYSSA_LOGO_INTRO_PIECES.titleBottomTail.duration * 0.16
    ];
    const gaps = arrivals.slice(1).map((arrival, index) => arrival - arrivals[index]);

    expect(gaps).toEqual([280, 520, 240, 500]);
    expect(gaps[0]).toBeLessThan(gaps[1]);
    expect(gaps[2]).toBeLessThan(gaps[3]);
  });

  it("holds the wordmark until the divider gems have settled", () => {
    // 菱形在 2020ms 起、620ms 结束 => 2640ms。字标必须在那之后。
    const wordmark = getAbyssaLogoIntroStep("wordmark");
    expect(wordmark.delay).toBeGreaterThanOrEqual(2_640);
  });

  it("gives the closing question mark its own slower beat", () => {
    // 问号是整句话的语气,不该和标题同速。
    const question = getAbyssaLogoIntroStep("questionMark");
    const titleBottom = getAbyssaLogoIntroStep("titleBottom");

    expect(question.kind).toBe("accent");
    expect(ABYSSA_LOGO_INTRO_DURATION.accent).toBeGreaterThan(
      ABYSSA_LOGO_INTRO_DURATION[titleBottom.kind]
    );
  });

  it("expands the divider from the centre instead of fading it", () => {
    // 线的语汇是「拉开」,不是「弹出」也不是淡入。
    expect(getAbyssaLogoIntroStep("divider").kind).toBe("sweep");
  });

  it("reveals the wordmark art before its three gems", () => {
    const wordmark = getAbyssaLogoIntroStep("wordmark");
    expect(wordmark.kind).toBe("composite");

    const { wordmarkArt, wordmarkGemNear, wordmarkGemMiddle, wordmarkGemFar } =
      ABYSSA_LOGO_INTRO_PIECES;
    expect(wordmarkArt.delay).toBe(wordmark.delay);
    expect(wordmarkGemNear.delay).toBeGreaterThan(wordmarkArt.delay);
    expect(wordmarkGemNear.delay).toBeLessThan(wordmarkArt.delay + wordmarkArt.duration);
    expect(wordmarkGemNear.delay).toBeLessThan(wordmarkGemMiddle.delay);
    expect(wordmarkGemMiddle.delay).toBeLessThan(wordmarkGemFar.delay);
  });

  it("falls back to an immediate reveal for an unmapped part", () => {
    const step = getAbyssaLogoIntroStep("nope" as never);
    expect(step.delay).toBe(0);
    expect(ABYSSA_LOGO_INTRO_DURATION[step.kind]).toBeGreaterThan(0);
  });
});

function toBlockOf(frame: string): string {
  // to { … } 可能是单行也可能多行,所以按大括号配对取,不靠缩进。
  const start = frame.search(/\bto\s*\{/);
  if (start < 0) return "";
  const open = frame.indexOf("{", start);
  let depth = 0;
  for (let i = open; i < frame.length; i += 1) {
    if (frame[i] === "{") depth += 1;
    if (frame[i] === "}") {
      depth -= 1;
      if (depth === 0) return frame.slice(open + 1, i);
    }
  }
  return "";
}

describe("logo intro stylesheet contract", () => {
  const css = readFileSync("src/shared/ui/styles/logo.css", "utf8");
  const introBlock = css.slice(css.indexOf("/* ============ 入场动画"));

  it("never animates transform, which carries the part layout", () => {
    // AbyssaLogo 用 transform **属性**承载 partTransform。
    // keyframes 里出现 transform 就会把布局整个替换掉,部件飞出画面。
    const keyframes = introBlock.match(/@keyframes[\s\S]*?\n\}/g) ?? [];
    expect(keyframes.length).toBeGreaterThanOrEqual(3);

    for (const frame of keyframes) {
      expect(frame, `keyframes must not set transform:\n${frame}`).not.toMatch(
        /[^-]transform\s*:/
      );
    }
  });

  it("uses translate and scale together, never scale alone", () => {
    expect(introBlock).toMatch(/translate:/);
    expect(introBlock).toMatch(/scale:/);
  });

  it("pins transform-origin to 0 0", () => {
    // partTransform 假定 origin 为 (0,0)。默认值 50% 50% 与 `center` 在
    // transform-box: view-box 下都解析成 (512,492),会把布局矩阵再共轭一次,
    // divider 因此位移 (128,123) —— 这正是曾经的布局崩塌。
    const base = introBlock.match(
      /\.abyssa-logo\[data-intro\]\s+\[data-logo-part\]\s*\{([^}]*)\}/
    );
    expect(base).toBeTruthy();
    // 必须落在 SVG 用户坐标原点。viewBox 的 min-y 不参与这里的坐标换算。
    expect(base![1]).toMatch(/transform-origin:\s*0 0/);
    expect(base![1]).not.toMatch(/transform-origin:\s*center/);
  });

  it("compensates part-level scale with a pivot translate", () => {
    // 部件级动画的 origin 在用户坐标原点(约束【1】),所以缩放必须自带
    // translate(p·(1-k)) 补偿,否则部件绕原点缩放、沿对角线飞出。
    //
    // divider 的**内部零件**不在此列:它们用百分比 origin(自身中心),
    // 缩放本就绕自己,补偿反而是错的。
    const keyframes = introBlock.match(/@keyframes[\s\S]*?\n\}/g) ?? [];
    const partLevel = keyframes.filter((frame) =>
      frame.includes("--abyssa-logo-pivot-")
    );
    expect(partLevel.length).toBeGreaterThanOrEqual(1);

    for (const frame of partLevel) {
      if (!/[^-]scale\s*:/.test(frame)) continue;
      expect(frame, `scale without compensating translate:\n${frame}`).toMatch(
        /translate:/
      );
    }
  });

  it("returns every animated property to its resting value", () => {
    // 收尾必须回到 scale 1 / translate 0,否则动画结束后布局是歪的。
    const keyframes = introBlock.match(/@keyframes[\s\S]*?\n\}/g) ?? [];
    expect(keyframes.length).toBeGreaterThanOrEqual(4);
    for (const frame of keyframes) {
      const to = toBlockOf(frame);
      expect(to, `no to-block in:\n${frame}`).not.toBe("");
      if (/[^-]scale\s*:/.test(frame)) {
        expect(to, `scale not reset:\n${frame}`).toMatch(/scale:\s*1(\s+1)?\s*;/);
      }
      if (/translate\s*:/.test(frame)) {
        expect(to, `translate not reset:\n${frame}`).toMatch(/translate:\s*0 0\s*;/);
      }
    }
  });

  it("returns opacity to the part's own design value for part-level keyframes", () => {
    // stamp 的设计 opacity 是 0.37。部件级动画收在 1 会让它永久变亮。
    // divider 内部零件(横线/菱形)是子元素,其 opacity 与部件值相乘,
    // 因此它们收在 1 是正确的 —— 只检查引用了该变量的那些。
    const keyframes = introBlock.match(/@keyframes[\s\S]*?\n\}/g) ?? [];
    const partLevel = keyframes.filter((frame) =>
      frame.includes("--abyssa-logo-part-opacity")
    );
    expect(partLevel.length).toBeGreaterThanOrEqual(3);

    for (const frame of partLevel) {
      const to = toBlockOf(frame);
      expect(to, `final opacity must use the part value:\n${frame}`).toMatch(
        /opacity:\s*var\(--abyssa-logo-part-opacity/
      );
    }
  });

  it("kills the animation outright under reduced motion", () => {
    // tokens.css 只压 duration,不清 delay —— 光靠那条规则,
    // 部件会停在 opacity:0 等满 960ms,视觉上就是「字标不见了」。
    const reduced = introBlock.slice(introBlock.indexOf("prefers-reduced-motion"));
    expect(reduced).toMatch(/animation:\s*none\s*!important/);
    expect(reduced).toMatch(/opacity:\s*var\(--abyssa-logo-part-opacity/);
  });


  it("never sets transform-box on the divider's inner pieces", () => {
    // 内部零件在 <g transform="translate(123 466.5)"> 之内,坐标是局部的。
    // 设成 view-box 会把 origin 挪到外层用户空间,而 keyframe 里的数值仍是
    // 局部值 —— 局部数被当作用户空间偏移,构图立刻崩。默认 fill-box 才对。
    const pieceRules = introBlock.match(
      /\.abyssa-logo\[data-intro\][^{]*\[data-divider-piece[^{]*\{[^}]*\}/g
    ) ?? [];
    expect(pieceRules.length).toBeGreaterThanOrEqual(2);
    for (const rule of pieceRules) {
      expect(rule, `inner piece must not set transform-box:\n${rule}`).not.toMatch(
        /transform-box/
      );
    }
  });

  it("keeps inner-piece origins percentage-based, free of coordinate numbers", () => {
    // 百分比 origin 不需要知道任何坐标,因此换布局也不会失效。
    const pieceRules = introBlock.match(
      /\.abyssa-logo\[data-intro\][^{]*\[data-divider-piece[^{]*\{[^}]*\}/g
    ) ?? [];
    for (const rule of pieceRules) {
      const origin = rule.match(/transform-origin:\s*([^;]+);/);
      if (!origin) continue;
      expect(origin[1], `origin must be percentage-based:\n${rule}`).toMatch(/%/);
      expect(origin[1]).not.toMatch(/-?\d+px/);
    }
  });

  it("ends the wordmark wipe fully opaque instead of masked away", () => {
    // 上一版把 mask-position 从 50% 推到 -100%,终态遮罩整块移出元素,
    // alpha 归零 —— 英文最后彻底看不见。终态必须是「遮罩覆盖全元素」。
    const wipe = introBlock.match(/@keyframes abyssa-logo-wordmark-wipe[\s\S]*?\n\}/);
    expect(wipe).toBeTruthy();

    const to = toBlockOf(wipe![0]);
    // 只允许靠放大 mask-size 收尾,不允许用 mask-position 把遮罩推走。
    expect(to).toMatch(/mask-size:/);
    expect(to).not.toMatch(/mask-position:/);

    const finalSize = Number(to.match(/mask-size:\s*(\d+)px/)![1]);
    // 元素宽约 746 用户单位,软边 60px,>=900 才能完全覆盖。
    expect(finalSize).toBeGreaterThanOrEqual(900);
  });

  it("uses fixed-width soft edges so the reveal can ever finish", () => {
    // 软边若用百分比,不透明核心会永远按比例缩在中央,两端永不可见。
    const revealRule = introBlock.match(
      /\[data-wordmark-piece="art"\]\s*\{[\s\S]*?\n\}/
    );
    expect(revealRule).toBeTruthy();
    expect(revealRule![0]).toMatch(/#000 \d+px/);
  });

  it("makes each wordmark gem visible on its first rendered frame", () => {
    const pop = introBlock.match(
      /@keyframes abyssa-logo-wordmark-gem-pop[\s\S]*?\n\}/
    );
    expect(pop).toBeTruthy();
    expect(pop![0]).toMatch(/4%\s*\{\s*opacity:\s*0\.78/);
    expect(pop![0]).toMatch(/15%\s*\{\s*opacity:\s*1/);
  });

  it("scopes every intro rule behind [data-intro]", () => {
    // 静态字标(logo-studio / 组件目录)绝不能被动画影响。
    const selectors = introBlock.match(/^\.abyssa-logo[^{]*\{/gm) ?? [];
    expect(selectors.length).toBeGreaterThan(0);
    for (const selector of selectors) {
      expect(selector).toContain("[data-intro]");
    }
  });
});
