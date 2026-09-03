import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it } from "vitest";
import { CharacterChroniclePanel } from "./CharacterChroniclePanel";
import {
  chronicleFixture,
  chronicleMinimalFixture,
  chroniclePlaceholderFixture
} from "../../testing/chronicles";

afterEach(cleanup);

const SOURCE = readFileSync(
  resolve(import.meta.dirname, "./CharacterChroniclePanel.tsx"),
  "utf8"
);
const CSS = readFileSync(
  resolve(import.meta.dirname, "../styles/components-character-chronicle.css"),
  "utf8"
);
/* CSS 正文(剥掉注释)。注释里刻意记着「曾是 row-gap:2」这类反例,
   抽数值时不剥就会命中自己的说明文字。 */
const CSS_RULES = CSS.replace(/\/\*[\s\S]*?\*\//g, "");
/* 契约正文(剥掉注释)。文件头刻意列出了「level: number → badge: string」
   这类**反例对照表**，不剥注释会把自己的说明文字当成违规命中。 */
const CONTRACT = readFileSync(
  resolve(import.meta.dirname, "../../domain/characters/chronicle.ts"),
  "utf8"
)
  .replace(/\/\*[\s\S]*?\*\//g, "")
  .replace(/^\s*\/\/.*$/gm, "");

describe("character chronicle panel", () => {
  /* ============ 视觉护栏 ============
     这些条目锁的是外观与结构，机制变了也不会误报。 */

  it("renders no emoji or pictographic characters", () => {
    const pictographic =
      /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{2B00}-\u{2BFF}\u{25A0}-\u{25FF}\u{2190}-\u{21FF}\u{FE0F}]/u;
    // 注释里允许写「不要用 X」这类反例，故先剥注释。
    const strip = (t: string) =>
      t.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

    expect(strip(SOURCE)).not.toMatch(pictographic);
    expect(strip(CSS)).not.toMatch(pictographic);

    const { container } = render(
      <CharacterChroniclePanel chronicle={chronicleFixture} />
    );
    expect(container.textContent ?? "").not.toMatch(pictographic);
  });

  /* 外框必须来自 RpgFrame，不能自己画 border。 */
  it("builds the frame from the shared RpgFrame primitive", () => {
    const { container } = render(
      <CharacterChroniclePanel chronicle={chronicleFixture} />
    );

    const frames = container.querySelectorAll(".abyssa-frame");
    expect(frames).toHaveLength(1);
    expect(
      frames[0]!.querySelectorAll(".abyssa-frame__ornaments i")
    ).toHaveLength(4);
    expect(frames[0]!.querySelector(".abyssa-frame__content")).not.toBeNull();
  });

  /* BUG 回归：height:100% 在 min-height 链上会退化成 auto，把卡片顶开。 */
  it("pins an explicit panel height instead of height:100%", () => {
    const root = CSS.slice(
      CSS.indexOf(".abyssa-chronicle {"),
      CSS.indexOf(".abyssa-chronicle *,")
    );
    expect(root).toMatch(/height:\s*605\.93px/);
    expect(root).not.toMatch(/height:\s*609\.18px/);
    expect(root).not.toMatch(/height:\s*100%/);
    // 兜底裁剪，任何一处算错都不外溢。
    expect(root).toMatch(/overflow:\s*hidden/);
  });

  it("zeroes min-height along the whole scroll chain", () => {
    for (const selector of [
      ".abyssa-chronicle__frame",
      ".abyssa-chronicle__inner",
      ".abyssa-chronicle__scroll"
    ]) {
      const at = CSS.indexOf(`${selector} {`);
      expect(at, `${selector} 规则缺失`).toBeGreaterThan(-1);
      const block = CSS.slice(at, CSS.indexOf("}", at));
      expect(block, `${selector} 少了 min-height:0`).toMatch(/min-height:\s*0/);
    }
  });

  /* 形状决定：竖轴时间线，不是宽行表格。
     账本式的四列宽行随「金币轴」一起废掉了。 */
  it("lays entries on a vertical rail rather than a table", () => {
    const { container } = render(
      <CharacterChroniclePanel chronicle={chronicleFixture} />
    );

    expect(container.querySelector(".abyssa-chronicle__list")?.tagName).toBe("OL");
    expect(container.querySelectorAll(".abyssa-chronicle__entry").length).toBe(4);
    expect(container.querySelectorAll(".abyssa-chronicle__chapter").length).toBe(2);
    // 每个条目都挂一枚节点。
    expect(container.querySelectorAll(".abyssa-chronicle__node").length).toBe(4);

    // 竖轴由整个列表一次画完，章节不会再把它切断。
    const rail = CSS.slice(
      CSS.indexOf(".abyssa-chronicle__list::before {"),
      CSS.indexOf("}", CSS.indexOf(".abyssa-chronicle__list::before {"))
    );
    expect(rail).toMatch(/left:\s*calc\(6px \+ var\(--chr-axis-x\)\)/);
    expect(rail).toMatch(/pointer-events:\s*none/);
    expect(CSS_RULES).not.toContain(".abyssa-chronicle__entry::before");

    // 不是表格版式。
    expect(CSS).not.toMatch(/grid-template-columns:\s*76px/);
    expect(container.querySelector("table")).toBeNull();
  });

  it("filters explicit categories without leaving empty chapter headings", async () => {
    const user = userEvent.setup();
    const { container } = render(
      <CharacterChroniclePanel chronicle={chronicleFixture} />
    );

    const filters = screen.getByRole("group", { name: "记事筛选" });
    expect(filters.querySelectorAll("button")).toHaveLength(4);
    expect(screen.getByRole("button", { name: "全部" })).toHaveAttribute(
      "aria-pressed",
      "true"
    );

    const scroll = container.querySelector<HTMLElement>(
      ".abyssa-chronicle__scroll"
    )!;
    scroll.scrollTop = 80;
    await user.click(screen.getByRole("button", { name: "羁绊" }));

    expect(scroll.scrollTop).toBe(0);
    expect(screen.getByText("里程碑记事")).toBeInTheDocument();
    expect(screen.queryByText("阶段变更")).not.toBeInTheDocument();
    expect(screen.getByText("样例前篇")).toBeInTheDocument();
    expect(screen.queryByText("样例后篇")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "私约" }));
    expect(screen.getByText("阶段变更")).toBeInTheDocument();
    expect(screen.queryByText("里程碑记事")).not.toBeInTheDocument();
    expect(screen.queryByText("样例前篇")).not.toBeInTheDocument();
    expect(screen.getByText("样例后篇")).toBeInTheDocument();
  });

  it("keeps filters as light text controls instead of framed primitives", () => {
    const { container } = render(
      <CharacterChroniclePanel chronicle={chronicleFixture} />
    );

    const filters = container.querySelector(".abyssa-chronicle__filters")!;
    expect(filters.querySelectorAll("button")).toHaveLength(4);
    expect(filters.querySelector("svg")).toBeNull();
    for (const selector of [
      ".abyssa-rpg-tab",
      ".abyssa-notched-pill",
      ".abyssa-status-node",
      ".abyssa-facet-diamond"
    ]) {
      expect(filters.querySelector(selector)).toBeNull();
    }

    const buttonAt = CSS_RULES.indexOf(".abyssa-chronicle__filters button {");
    const buttonRule = CSS_RULES.slice(
      buttonAt,
      CSS_RULES.indexOf("}", buttonAt)
    );
    expect(buttonRule).toMatch(/border:\s*0/);
    expect(buttonRule).toMatch(/background:\s*none/);
  });

  it("resets filtering when the character changes", async () => {
    const user = userEvent.setup();
    const { rerender } = render(
      <CharacterChroniclePanel chronicle={chronicleFixture} />
    );

    await user.click(screen.getByRole("button", { name: "羁绊" }));
    expect(screen.queryByText("一般记事")).not.toBeInTheDocument();

    rerender(
      <CharacterChroniclePanel chronicle={chronicleMinimalFixture} />
    );
    expect(screen.getByText("仅有标题")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "全部" })).toHaveAttribute(
      "aria-pressed",
      "true"
    );
  });

  it("shows a quiet empty state for a category with no entries", async () => {
    const user = userEvent.setup();
    render(<CharacterChroniclePanel chronicle={chronicleMinimalFixture} />);

    await user.click(screen.getByRole("button", { name: "私约" }));
    expect(screen.getByRole("status")).toHaveTextContent("此分类暂无记事");
    expect(screen.queryByText("仅有标题")).not.toBeInTheDocument();
  });

  /* BUG 回归：大标题跑到了右边，以及整体「乱」。
     根因是结构而非数值：戳记曾与标题同处一个 flex 行，
     给它 margin-left:auto 会把标题一起推到右端；即便不推，
     标题起点也随日期长度漂移（「第 3 天」vs「第 12 天」差 8px）。
     现在是两栏 grid —— 戳记住在 meta 栏，内容栏只有一条左边界。 */
  it("lays each entry on a two-column grid with a stable content edge", () => {
    const { container } = render(
      <CharacterChroniclePanel chronicle={chronicleFixture} />
    );

    const entry = container.querySelector(".abyssa-chronicle__entry")!;
    // 戳记在 meta 栏里，**不在**标题行里。
    expect(entry.querySelector(".abyssa-chronicle__meta .abyssa-chronicle__stamp")).not.toBeNull();
    expect(entry.querySelector(".abyssa-chronicle__head .abyssa-chronicle__stamp")).toBeNull();

    // 标题行只有标题 + 徽标。
    const head = [...container.querySelectorAll(".abyssa-chronicle__head")].find(
      (node) => node.querySelector(".abyssa-chronicle__badge")
    )!;
    const order = [...head.children].map((child) =>
      child.tagName === "H4" ? "title" : child.className.split("__")[1]
    );
    expect(order).toEqual(["title", "badge"]);

    // 两栏骨架：meta │ 轴间隙 │ content，条目与章节共用同一栏结构。
    const entryRule = CSS_RULES.slice(
      CSS_RULES.indexOf(".abyssa-chronicle__entry {"),
      CSS_RULES.indexOf("}", CSS_RULES.indexOf(".abyssa-chronicle__entry {"))
    );
    expect(entryRule).toMatch(/grid-template-columns:\s*var\(--chr-meta-w\)/);
    const chapterRule = CSS_RULES.slice(
      CSS_RULES.indexOf(".abyssa-chronicle__chapter {"),
      CSS_RULES.indexOf("}", CSS_RULES.indexOf(".abyssa-chronicle__chapter {"))
    );
    expect(chapterRule).toMatch(/grid-template-columns:\s*var\(--chr-meta-w\)/);

    // 戳记不许再用 auto 边距（那是把标题顶到右边的元凶）。
    const stampRule = CSS_RULES.slice(
      CSS_RULES.search(/(?<!\S)\.abyssa-chronicle__stamp \{/),
      CSS_RULES.indexOf("}", CSS_RULES.search(/(?<!\S)\.abyssa-chronicle__stamp \{/))
    );
    expect(stampRule).not.toMatch(/margin-left:\s*auto/);
    expect(stampRule).toMatch(/text-overflow/);

    // 正文不许再限宽 —— 内容栏本身就是正确的量，限宽会留死白。
    const textRule = CSS_RULES.slice(
      CSS_RULES.indexOf(".abyssa-chronicle__text {"),
      CSS_RULES.indexOf("}", CSS_RULES.indexOf(".abyssa-chronicle__text {"))
    );
    expect(textRule).not.toMatch(/max-width/);
  });

  /* 时间栏保持紧凑；节点放大后，旋转外接框仍不能压住两侧文字。 */
  it("uses a compact gutter with three safely spaced marker sizes", () => {
    const rootRule = CSS_RULES.slice(
      CSS_RULES.indexOf(".abyssa-chronicle {"),
      CSS_RULES.indexOf("}", CSS_RULES.indexOf(".abyssa-chronicle {"))
    );
    const meta = Number(/--chr-meta-w:\s*([\d.]+)px/.exec(rootRule)![1]);
    const railGap = Number(/--chr-rail-gap:\s*([\d.]+)px/.exec(rootRule)![1]);
    const minor = Number(/--chr-node-minor:\s*([\d.]+)px/.exec(rootRule)![1]);
    const standard = Number(/--chr-node-standard:\s*([\d.]+)px/.exec(rootRule)![1]);
    const major = Number(/--chr-node-major:\s*([\d.]+)px/.exec(rootRule)![1]);
    const rotatedMajorWithRing = major * Math.SQRT2 + 4;

    expect(meta + railGap).toBeLessThan(124);
    expect(minor).toBeLessThan(standard);
    expect(standard).toBeLessThan(major);
    expect(standard).toBeGreaterThanOrEqual(20);
    expect(standard).toBeLessThanOrEqual(22);
    expect(major).toBeGreaterThanOrEqual(24);
    expect(major).toBeLessThanOrEqual(26);
    expect(railGap).toBeGreaterThanOrEqual(rotatedMajorWithRing + 14);

    const iconRule = CSS_RULES.slice(
      CSS_RULES.indexOf(".abyssa-chronicle__node i {"),
      CSS_RULES.indexOf("}", CSS_RULES.indexOf(".abyssa-chronicle__node i {"))
    );
    expect(iconRule).toMatch(/width:\s*calc\(var\(--chr-entry-node\) - 5px\)/);
  });

  it("renders alert duration as unframed supporting text", () => {
    const { container } = render(
      <CharacterChroniclePanel chronicle={chronicleFixture} />
    );

    const alertBadge = container.querySelector(
      '.abyssa-chronicle__entry[data-marker="alert"] .abyssa-chronicle__badge'
    );
    expect(alertBadge).toHaveTextContent("休养 3 天");

    const selector =
      '.abyssa-chronicle__entry[data-marker="alert"] .abyssa-chronicle__badge {';
    const at = CSS_RULES.indexOf(selector);
    const rule = CSS_RULES.slice(at, CSS_RULES.indexOf("}", at));
    expect(rule).toMatch(/border:\s*0/);
    expect(rule).toMatch(/background:\s*none/);
  });

  it("keeps chapter waterlines on the continuous rail", () => {
    const chapterRule = CSS_RULES.slice(
      CSS_RULES.indexOf(".abyssa-chronicle__chapter {"),
      CSS_RULES.indexOf("}", CSS_RULES.indexOf(".abyssa-chronicle__chapter {"))
    );
    const chapterTitleRule = CSS_RULES.slice(
      CSS_RULES.indexOf(".abyssa-chronicle__chapter-title {"),
      CSS_RULES.indexOf("}", CSS_RULES.indexOf(".abyssa-chronicle__chapter-title {"))
    );
    const margins = /margin-block:\s*([\d.]+)px\s+([\d.]+)px/.exec(chapterRule)!;

    expect(Number(margins[1])).toBeGreaterThanOrEqual(14);
    expect(Number(margins[2])).toBeGreaterThanOrEqual(10);
    expect(chapterTitleRule).toMatch(/margin-left:\s*-\d/);

    const chapterNodeAt = CSS_RULES.indexOf(".abyssa-chronicle__chapter::before {");
    expect(chapterNodeAt).toBeGreaterThan(-1);
    const chapterNodeRule = CSS_RULES.slice(
      chapterNodeAt,
      CSS_RULES.indexOf("}", chapterNodeAt)
    );
    expect(chapterNodeRule).toMatch(/left:\s*var\(--chr-axis-x\)/);
  });

  /* 节点是纯几何 + mask，不是文字符号。 */
  it("draws markers as geometry instead of glyphs", () => {
    const { container } = render(
      <CharacterChroniclePanel chronicle={chronicleFixture} />
    );

    for (const node of container.querySelectorAll(".abyssa-chronicle__node")) {
      // 节点自身不带文本；内部只允许一个 mask <i>。
      expect(node.textContent).toBe("");
      for (const child of node.children) {
        expect(child.tagName).toBe("I");
      }
    }

    const markers = [...container.querySelectorAll(".abyssa-chronicle__entry")]
      .map((entry) => entry.getAttribute("data-marker"));
    expect(new Set(markers)).toEqual(
      new Set(["node", "milestone", "hollow", "alert"])
    );
  });

  /* BUG 回归：六级文字糊成一片，毫无层次。
     成因是只挪字号：曾把六级排成 0.5–1px 的台阶且字重全 400 ——
     那种台阶在 11–14px 区间肉眼不可分辨。
     层次必须靠字号 + 字重 + 颜色三维叠加，这条把三者都钉住。 */
  it("separates the type scale by weight and not only by size", () => {
    const rule = (selector: string) => {
      const at = CSS_RULES.search(
        new RegExp(`(?<!\\S)${selector.replace(/[.$]/g, "\\$&")} \\{`)
      );
      expect(at, `${selector} 规则缺失`).toBeGreaterThan(-1);
      return CSS_RULES.slice(at, CSS_RULES.indexOf("}", at));
    };
    const num = (block: string, prop: string) => {
      const found = new RegExp(`${prop}:\\s*([\\d.]+)`).exec(block);
      return found ? Number(found[1]) : undefined;
    };

    const title = rule(".abyssa-chronicle__head h4");
    const body = rule(".abyssa-chronicle__text");
    const stamp = rule(".abyssa-chronicle__stamp");

    // 标题必须比正文重 —— 光靠字号不够。
    expect(num(title, "font-weight")).toBeGreaterThanOrEqual(600);
    expect(num(title, "font-size")!).toBeGreaterThan(num(body, "font-size")!);

    // 六级不许全是 400（那正是「挤在一起」的成因）。
    const weights = [
      title,
      body,
      stamp,
      rule(".abyssa-chronicle__badge"),
      rule(".abyssa-chronicle__chapter")
    ].map((block) => num(block, "font-weight") ?? 400);
    expect(new Set(weights).size).toBeGreaterThan(1);

    // 标题独占最亮：正文与戳记都得压暗。
    expect(title).toMatch(/color:\s*var\(--chr-ink\)/);
    expect(body).toMatch(/color-mix/);
    expect(stamp).toMatch(/color-mix/);
  });

  /* 普通日常最紧凑，中量与重量事件逐级增加呼吸；条目内部仍要更紧。 */
  it("spaces entries further apart than lines within an entry", () => {
    const markerRule = (marker: string) => {
      const selector = `.abyssa-chronicle__entry[data-marker="${marker}"] {`;
      const at = CSS_RULES.indexOf(selector);
      expect(at).toBeGreaterThan(-1);
      return CSS_RULES.slice(at, CSS_RULES.indexOf("}", at));
    };
    const pad = (block: string) =>
      Number(/--chr-entry-pad:\s*([\d.]+)px/.exec(block)![1]);
    const minorPad = pad(markerRule("node"));
    const majorPad = pad(markerRule("hollow"));

    const inner = Number(
      /margin:\s*([\d.]+)px 0 0/.exec(
        CSS_RULES.slice(
          CSS_RULES.indexOf(".abyssa-chronicle__text {"),
          CSS_RULES.indexOf("}", CSS_RULES.indexOf(".abyssa-chronicle__text {"))
        )
      )![1]
    );

    expect(minorPad * 2).toBeGreaterThan(inner);
    expect(majorPad).toBeGreaterThan(minorPad);

    // 竖轴由列表一次画完，章节与条目间不再靠负偏移桥接。
    const railRule = CSS_RULES.slice(
      CSS_RULES.indexOf(".abyssa-chronicle__list::before {"),
      CSS_RULES.indexOf("}", CSS_RULES.indexOf(".abyssa-chronicle__list::before {"))
    );
    expect(railRule).toMatch(/top:\s*\d/);
    expect(railRule).toMatch(/bottom:\s*\d/);
    expect(railRule).not.toMatch(/top:\s*-/);
  });

  /* 颜色只走令牌。阵营皮肤(魔王红/干部青/勇者金)靠覆盖令牌切换，
     写死 hex 会让本页换角色时不跟着变。 */
  it("drives colors from theme tokens so the faction skin still applies", () => {
    expect(CSS).toMatch(/--chr-accent:\s*var\(--abyssa-teal/);
    expect(CSS).toMatch(/--chr-alert:\s*var\(--abyssa-danger/);

    /* ============ 允许的裸值,仅此四个 ============
       干部青(182°)与整套中性文字(180° 青灰)色相只差 2.1°,
       靠亮度分不开而亮度已用于分层级。所以:
         中性文字灰度化(3 个)—— 抽掉青灰残留
         青色阵营色提饱和(1 个)—— 拉开彩度
       两者都**不改明度**,故不影响层级。其余颜色一律走令牌。
       白名单写死,多一个都要在这里解释清楚。 */
    const allowed = new Set(["#eeeeee", "#c6c6c6", "#959595", "#80d8db"]);
    const withoutFallbacks = CSS_RULES.replace(/var\([^)]*\)/g, "");
    const bare = [...withoutFallbacks.matchAll(/#[0-9a-fA-F]{3,8}/g)].map(
      (match) => match[0].toLowerCase()
    );
    for (const hex of bare) {
      expect(allowed, `未登记的裸色值 ${hex}`).toContain(hex);
    }

    // 去饱和后的中性色必须是真正的灰(R=G=B),否则等于没改。
    for (const hex of ["#eeeeee", "#c6c6c6", "#959595"]) {
      const [r, g, b] = [1, 3, 5].map((i) => hex.slice(i, i + 2));
      expect(new Set([r, g, b]).size, `${hex} 仍带色偏`).toBe(1);
    }
  });

  /* 青色皮肤下阵营色必须比令牌更饱和 —— 这是「青色最乱」的另一半修法。
     锁住:色相不许漂、明度不许动(动了就会干扰层级)。 */
  it("boosts only the chroma of the cadre accent, never its lightness", () => {
    const at = CSS.indexOf('[data-skin="demon-cadre"] .abyssa-chronicle {');
    expect(at, "干部青覆盖规则缺失").toBeGreaterThan(-1);
    const block = CSS.slice(at, CSS.indexOf("}", at));
    expect(block).toMatch(/--chr-accent-soft:\s*#80d8db/);

    const hsl = (hex: string) => {
      const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
      const max = Math.max(r, g, b);
      const min = Math.min(r, g, b);
      const l = (max + min) / 2;
      const d = max - min;
      const sat = d === 0 ? 0 : d / (1 - Math.abs(2 * l - 1));
      let h = 0;
      if (d !== 0) {
        if (max === r) h = ((g - b) / d) % 6;
        else if (max === g) h = (b - r) / d + 2;
        else h = (r - g) / d + 4;
      }
      return { h: ((h * 60) % 360 + 360) % 360, s: sat, l };
    };

    const token = hsl("#91c8ca");
    const tuned = hsl("#80d8db");

    // 彩度确实提上去了。
    expect(tuned.s).toBeGreaterThan(token.s * 1.3);
    // 明度与色相基本不动 —— 明度一动就会干扰字号/字重建立的层级。
    expect(Math.abs(tuned.l - token.l)).toBeLessThan(0.02);
    expect(Math.abs(tuned.h - token.h)).toBeLessThan(6);
  });

  /* 本页没有 preserve-3d 立体件，不该有 perspective。
     骰装页那条约束不适用，不为对称乱加。 */
  it("adds no perspective scene since there is no 3d part", () => {
    expect(CSS).not.toMatch(/perspective:/);
  });

  /* ============ 反埋雷护栏 ============
     业务未对齐，契约必须保持纯展示。这几条守着别有人把机制焊进来。 */

  /* 只给 id + title 也要能渲染 —— 证明所有插槽都是可选的。 */
  it("renders a bare entry with only id and title", () => {
    const { container } = render(
      <CharacterChroniclePanel chronicle={chronicleMinimalFixture} />
    );

    expect(screen.getByText("仅有标题")).toBeInTheDocument();
    expect(container.querySelector(".abyssa-chronicle__entry")).not.toBeNull();
    // 缺省节点形退回 node。
    expect(
      container.querySelector(".abyssa-chronicle__entry")?.getAttribute("data-marker")
    ).toBe("node");
    expect(container.querySelector(".abyssa-chronicle__badge")).toBeNull();
    expect(container.querySelector(".abyssa-chronicle__stamp")).toBeNull();
  });

  /* badge 原样输出，不解析、不比较。
     "Lv.4" 与 "II" 与 "—" 必须走同一条路径。 */
  it("passes the badge through verbatim without parsing", () => {
    for (const badge of ["Lv.4", "II", "—", "3 天", "∞"]) {
      cleanup();
      render(
        <CharacterChroniclePanel
          chronicle={{
            characterId: "x",
            blocks: [{ kind: "entry", id: "b", title: "标题", badge }]
          }}
        />
      );
      expect(screen.getByText(badge)).toBeInTheDocument();
    }
  });

  /* 脏数据不许崩版面。 */
  it("falls back for unknown marker and tone values", () => {
    const { container } = render(
      <CharacterChroniclePanel
        chronicle={{
          characterId: "x",
          blocks: [
            {
              kind: "entry",
              id: "u",
              title: "未知值",
              // 故意越界：模拟机制变更后内容先行的情况。
              marker: "wormhole" as never,
              tone: "chartreuse" as never,
              categories: ["wormhole" as never]
            }
          ]
        }}
      />
    );

    const entry = container.querySelector(".abyssa-chronicle__entry")!;
    expect(entry.getAttribute("data-marker")).toBe("node");
    expect(entry.getAttribute("data-tone")).toBe("default");
    expect(entry.getAttribute("data-categories")).toBe("daily");
    expect(screen.getByText("未知值")).toBeInTheDocument();
  });

  /* 契约里不许出现带机械含义的数字字段。
     机制未对齐，写进类型就会在变更时全线迁移。 */
  it("keeps the contract free of mechanical business fields", () => {
    // 这些是上一版设计里的雷，不许回来。
    expect(CONTRACT).not.toMatch(/level:\s*number/);
    expect(CONTRACT).not.toMatch(/stage:\s*1\s*\|\s*2\s*\|\s*3/);
    expect(CONTRACT).not.toMatch(/day:\s*number/);
    expect(CONTRACT).not.toMatch(/days:\s*number/);
    // 金币/晶石轴已废，不许作为分类回到契约里。
    expect(CONTRACT).not.toMatch(/"coin"|"crystal"|LedgerAxis/);
    // 戳记与徽标必须是字符串插槽。
    expect(CONTRACT).toMatch(/stamp\?:\s*string/);
    expect(CONTRACT).toMatch(/badge\?:\s*string/);
    // 筛选分类是显式展示元数据，不得从 badge 或标题猜测。
    expect(CONTRACT).toMatch(/categories\?:\s*ChronicleCategory\[\]/);
  });

  /* 面板不得自己推导摘要读数 —— 那是调用方的事。
     筛选器可以认识展示分类，但不能读取档案业务对象或解析等级。 */
  it("takes summary readings as strings instead of deriving them", () => {
    const stripped = SOURCE.replace(/\/\*[\s\S]*?\*\//g, "");
    expect(stripped).not.toMatch(/data\.bond|data\.pact|currentStage|Lv\./);

    render(
      <CharacterChroniclePanel
        chronicle={chronicleFixture}
        summary={[{ label: "羁绊", value: "Lv.9" }]}
      />
    );
    // 原样显示，不校验合理性。
    expect(screen.getByText("Lv.9")).toBeInTheDocument();
  });

  it("counts entries without counting chapter rules", () => {
    render(<CharacterChroniclePanel chronicle={chronicleFixture} />);
    // 夹具是 4 条目 + 2 章节。
    expect(screen.getByText("4")).toBeInTheDocument();
  });

  it("wraps the placeholder in a frame as well", () => {
    const { container } = render(
      <CharacterChroniclePanel chronicle={chroniclePlaceholderFixture} />
    );

    expect(container.querySelector(".abyssa-frame")).not.toBeNull();
    expect(screen.getByText("尚无记事")).toBeInTheDocument();
    expect(screen.getByText("这一页还空着")).toBeInTheDocument();
    expect(container.querySelector(".abyssa-chronicle__entry")).toBeNull();
  });
});
