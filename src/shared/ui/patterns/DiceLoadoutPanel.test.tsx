import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it } from "vitest";
import { DiceLoadoutPanel } from "./DiceLoadoutPanel";
import {
  diceLoadoutFixture,
  diceLoadoutPlaceholderFixture
} from "../../testing/diceLoadouts";

afterEach(cleanup);

const SOURCE = readFileSync(resolve(import.meta.dirname, "./DiceLoadoutPanel.tsx"), "utf8");
const CSS = readFileSync(
  resolve(import.meta.dirname, "../styles/components-dice-loadout.css"),
  "utf8"
);

const authored = () => diceLoadoutFixture;

describe("dice loadout panel", () => {
  /* ============ 质量护栏 ============
     上一版用 emoji 当图标、用裸 border 当外框。两条都不许再回来。 */

  it("renders no emoji or pictographic characters", () => {
    const pictographic =
      /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{2B00}-\u{2BFF}\u{25A0}-\u{25FF}\u{2190}-\u{21FF}\u{FE0F}]/u;
    // 注释里允许写「不要用 X」这类反例,故先剥注释。
    const strip = (t: string) =>
      t.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

    expect(strip(SOURCE)).not.toMatch(pictographic);
    expect(strip(CSS)).not.toMatch(pictographic);

    const { container } = render(<DiceLoadoutPanel loadout={authored()} />);
    expect(container.textContent ?? "").not.toMatch(pictographic);
  });

  /* 两条带的外框必须来自 RpgFrame,不能自己画 border。 */
  it("builds both bands from the shared RpgFrame primitive", () => {
    const { container } = render(<DiceLoadoutPanel loadout={authored()} />);

    // 上带 + 检视栏 = 2 个 RpgFrame,各自带四角与水印。
    const frames = container.querySelectorAll(".abyssa-frame");
    expect(frames).toHaveLength(2);
    for (const frame of frames) {
      expect(frame.querySelectorAll(".abyssa-frame__ornaments i")).toHaveLength(4);
      expect(frame.querySelector(".abyssa-frame__content")).not.toBeNull();
    }
    expect(container.querySelector(".abyssa-dice__net-frame")).not.toBeNull();
    expect(container.querySelector(".abyssa-dice__inspector")).not.toBeNull();
  });

  /* 挂坠格必须复用 ItemSlot(六层堆叠 + 空槽凹孔),不是自己搭的方块。 */
  it("reuses ItemSlot for all three charm sockets", () => {
    const { container } = render(<DiceLoadoutPanel loadout={authored()} />);

    const slots = container.querySelectorAll(".abyssa-item-slot");
    expect(slots).toHaveLength(3);
    // 夹具挂了两件,第三格空 —— 空槽走 ItemSlot 的凹孔层。
    expect(container.querySelectorAll('.abyssa-item-slot[data-empty]')).toHaveLength(1);
    expect(container.querySelector('[data-layer="socket"]')).not.toBeNull();
    // 有图标的格子用 mask 着色,不是 <img>。
    const glyph = container.querySelector<HTMLElement>('[data-layer="glyph"]');
    expect(glyph).not.toBeNull();
    expect(glyph!.style.maskImage || glyph!.style.webkitMaskImage).toMatch(
      /^url\(["']?(?:data:image\/svg\+xml|[^"')]*\.svg)/
    );
  });

  it("builds rarity-colored medallions with circular backs and double plaques", () => {
    const { container } = render(<DiceLoadoutPanel loadout={authored()} />);

    expect(
      [...container.querySelectorAll(".abyssa-dice__charm[data-rarity]")].map(
        (node) => node.getAttribute("data-rarity")
      )
    ).toEqual(["gold", "amethyst"]);
    expect(container.querySelectorAll(".abyssa-dice__charm-medallion")).toHaveLength(3);
    expect(container.querySelectorAll(".abyssa-dice__charm-name-inner")).toHaveLength(3);
    expect(container.querySelectorAll(".abyssa-dice__charm-name-text")).toHaveLength(3);
    expect(container.querySelectorAll(".abyssa-dice__charm-backdrop")).toHaveLength(3);
    expect(CSS).toMatch(/\.abyssa-dice__charm-backdrop[\s\S]*?z-index:\s*0[\s\S]*?border-radius:\s*50%/);
    expect(CSS).toMatch(/--charm-tone:\s*var\(--item-rarity/);
  });

  /* ============ 布局与交互 ============ */

  it("lays the six faces out as a clickable cross net", () => {
    render(<DiceLoadoutPanel loadout={authored()} />);

    const net = screen.getByLabelText("命骰六面");
    expect(net.querySelectorAll(".abyssa-dice__cell")).toHaveLength(6);
    // 夹具两面沉眠。
    expect(net.querySelectorAll('[data-fate="asleep"]')).toHaveLength(2);
    expect(net.querySelectorAll('[data-fate="awake"]')).toHaveLength(4);
  });

  /* 标题保留在骰阵上方，重复的花色/觉醒统计行已经移除。 */
  it("keeps the title above the net without a duplicate summary row", () => {
    const { container } = render(
      <DiceLoadoutPanel loadout={authored()} characterName="夹具" />
    );

    const title = container.querySelector(".abyssa-dice__band-title")!;
    expect(title).not.toBeNull();
    expect(title.textContent).toContain("命骰");
    expect(title.textContent).toContain("夹具");

    expect(container.querySelector(".abyssa-dice__band-info")).toBeNull();

    // 标题在骰阵之前。
    const net = container.querySelector(".abyssa-dice__net")!;
    expect(title.compareDocumentPosition(net) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  /* ============ 两个结构性 bug 的护栏 ============ */

  /* 1) 容器撑开。
     .__details 是 min-height:646(下限),.__tabpanel 是 min-height:0 ——
     两者都没有确定高度,所以 height:100% 会退化成 auto,内容一长就顶开卡片。
     必须写死 px。 */
  it("pins an explicit panel height instead of height:100%", () => {
    const root = CSS.slice(CSS.indexOf(".abyssa-dice {"), CSS.indexOf(".abyssa-dice *,"));
    /* 605.93 = 3 个页签时的槽位高。曾写死 609.18(4 页签的值),
       切到骰装页会把卡片顶开 3.25px。 */
    expect(root).toMatch(/height:\s*605\.93px/);
    expect(root).not.toMatch(/height:\s*609\.18px/);
    expect(root).not.toMatch(/height:\s*100%/);
    // 兜底裁剪,任何一处算错都不外溢。
    expect(root).toMatch(/overflow:\s*hidden/);
  });

  /* 网格与滚动链上每一层都要 min-height:0。 */
  it("zeroes min-height along the whole scroll chain", () => {
    for (const selector of [
      ".abyssa-dice__stage",
      ".abyssa-dice__inspector",
      ".abyssa-dice__plate",
      ".abyssa-dice__plate-scroll"
    ]) {
      const at = CSS.indexOf(`${selector} {`);
      expect(at, `${selector} 规则缺失`).toBeGreaterThan(-1);
      const block = CSS.slice(at, CSS.indexOf("}", at));
      expect(block, `${selector} 少了 min-height:0`).toMatch(/min-height:\s*0/);
    }
  });

  /* 2) 骰面渲染成黑框。
     ExpeditionFlatDieFrame 是 preserve-3d 立体件(木面层 translateZ 负值),
     没有 perspective 场景时木面不透视收缩,以 1.025 倍平铺在外框后 ——
     看上去就是一圈黑边。battle 侧用 perspective:620px。 */
  it("gives each die cell a perspective scene", () => {
    const at = CSS.indexOf(".abyssa-dice__cell {");
    const block = CSS.slice(at, CSS.indexOf("}", at));
    expect(block).toMatch(/perspective:/);
  });

  /* 3) 命骰栏里不许再套一层深色内框。
     骰面自己有象牙外框 + 下沉木面,外面再包一层压深的"石盘",
     看上去就是框里又套一个小黑框。 */
  it("puts no inner tray behind the dice row", () => {
    const netAt = CSS.indexOf(".abyssa-dice__net {");
    const netBlock = CSS.slice(netAt, CSS.indexOf("}", netAt));

    expect(netBlock).not.toMatch(/background:/);
    expect(netBlock).not.toMatch(/border:/);
    expect(netBlock).not.toMatch(/box-shadow:/);
    expect(netBlock).not.toMatch(/padding:/);

    // 背景只允许通过统一的轻度压暗令牌，不能直接退成纯黑坑位。
    expect(CSS).toMatch(/--dice-surface:\s*color-mix/);
    expect(CSS).not.toMatch(/--abyssa-frame-surface:\s*var\(--dice-(pit|void)\)/);
  });

  /* 参考稿的六面骰网：上 1、中 4、下 1。 */
  it("lays the six faces out as a one-four-one net", () => {
    const { container } = render(<DiceLoadoutPanel loadout={authored()} />);

    const columns = container.querySelectorAll(".abyssa-dice__column");
    expect(columns).toHaveLength(6);
    expect([...columns].map((c) => (c as HTMLElement).style.gridColumn)).toEqual(
      ["2", "1", "2", "3", "4", "2"]
    );
    expect([...columns].map((c) => (c as HTMLElement).style.gridRow)).toEqual(
      ["1", "2", "2", "2", "2", "3"]
    );
    expect(container.querySelectorAll(".abyssa-dice__cell")).toHaveLength(6);

    // 挂坠列、骰阵和详情共享同一个页面网格。
    const stage = container.querySelector(".abyssa-dice__stage")!;
    expect(stage.querySelector(".abyssa-dice__charms")).not.toBeNull();
    expect(stage.querySelector(".abyssa-dice__net-frame")).not.toBeNull();
    expect(stage.querySelector(".abyssa-dice__inspector")).not.toBeNull();
  });

  it("shows the assembled die beside the shifted net and supports drag rotation", () => {
    const { container } = render(<DiceLoadoutPanel loadout={authored()} />);

    const body = container.querySelector(".abyssa-dice__net-body")!;
    const net = body.querySelector(".abyssa-dice__net")!;
    const preview = screen.getByLabelText("3D 六面命骰预览");
    expect(body).not.toBeNull();
    expect(preview).not.toBeNull();
    expect(net.compareDocumentPosition(preview) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(preview.querySelectorAll(".expedition-die-cube__face")).toHaveLength(6);

    const scene = screen.getByRole("img", { name: /可拖动或使用方向键旋转/ });
    const cube = preview.querySelector<HTMLElement>(".expedition-die-cube")!;
    const spin = preview.querySelector(".abyssa-dice__cube-spin")!;
    const initialTransform = cube.style.transform;

    fireEvent.pointerDown(scene, { button: 0, clientX: 10, clientY: 10, pointerId: 1 });
    expect(spin).toHaveAttribute("data-paused");
    fireEvent.pointerMove(scene, { clientX: 30, clientY: 2, pointerId: 1 });
    expect(cube.style.transform).not.toBe(initialTransform);
    fireEvent.pointerUp(scene, { pointerId: 1 });
    expect(spin).not.toHaveAttribute("data-paused");

    expect(CSS).toMatch(/@keyframes abyssa-dice-cube-spin/);
    expect(CSS).toMatch(/\.abyssa-dice__cube-scene[\s\S]*?touch-action:\s*none/);
  });

  /* 4) 颜色只用令牌,写死 hex 会让阵营皮肤失效。
     花色四色是语义色(圣辉/尘世/渊影/彼岸),是唯一允许的例外。 */
  it("drives colors from theme tokens so the faction skin still applies", () => {
    const suitBlockStart = CSS.indexOf('.abyssa-dice [data-suit="holy"]');
    const withoutSuits = CSS.slice(0, suitBlockStart) + CSS.slice(CSS.indexOf("/* ===== 下带", suitBlockStart));
    const hexes = withoutSuits.match(/#[0-9a-f]{3,8}/gi) ?? [];
    // 剩下的 hex 只允许出现在 var() 兜底值里。
    for (const hex of hexes) {
      const idx = withoutSuits.indexOf(hex);
      const line = withoutSuits.slice(withoutSuits.lastIndexOf("\n", idx), idx + hex.length);
      expect(line, `${hex} 不是令牌兜底值`).toMatch(/var\(--abyssa-/);
    }
    expect(CSS).toMatch(/--dice-accent:\s*var\(--abyssa-teal/);
  });

  /* 检视栏是 580x233 的宽扁框:必须左铭牌 + 右数据网格,
     不能退回竖排窄行(那会浪费 530px 的宽度)。 */
  it("splits the inspector into an identity plaque and a data grid", () => {
    const { container } = render(<DiceLoadoutPanel loadout={authored()} />);

    expect(container.querySelector(".abyssa-dice__ident")).not.toBeNull();
    expect(container.querySelector(".abyssa-dice__data")).not.toBeNull();

    const scrollAt = CSS.indexOf(".abyssa-dice__plate-scroll {");
    const block = CSS.slice(scrollAt, CSS.indexOf("}", scrollAt));
    expect(block).toMatch(/grid-template-columns:\s*182px/);

    // 数据格两列;长句格跨满整行。
    const dataAt = CSS.indexOf(".abyssa-dice__data {");
    expect(CSS.slice(dataAt, CSS.indexOf("}", dataAt))).toMatch(/repeat\(2,/);
    expect(CSS).toMatch(/\[data-wide\] \{ grid-column: 1 \/ -1; \}/);

    // 已废弃的窄行样式不许残留。
    expect(CSS).not.toContain(".abyssa-dice__row");
    expect(CSS).not.toContain(".abyssa-dice__whisper");
  });

  /* 每格是「标签在上、值在下」,而不是标签+冒号+值的一行。 */
  it("stacks label above value in each data cell", () => {
    const { container } = render(<DiceLoadoutPanel loadout={authored()} />);

    const cells = container.querySelectorAll(".abyssa-dice__cell-data");
    expect(cells.length).toBeGreaterThanOrEqual(4);
    for (const cell of cells) {
      expect(cell.querySelectorAll("b")).toHaveLength(1);
      expect(cell.querySelectorAll("span")).toHaveLength(1);
      // b 在 span 之前。
      expect(
        cell.querySelector("b")!.compareDocumentPosition(cell.querySelector("span")!) &
          Node.DOCUMENT_POSITION_FOLLOWING
      ).toBeTruthy();
    }
  });

  /* 检视栏左侧一枚传统白骰:白底黑点,点位用 radial-gradient 摆,
     不是数字也不是抽象图标。 */
  it("shows a classic white die for the pip in the inspector", async () => {
    const user = userEvent.setup();
    render(<DiceLoadoutPanel loadout={authored()} />);

    // 总览态没有单一点数,画的是六面缩略图而不是大白骰。
    expect(screen.queryByRole("img", { name: /^点数 \d$/ })).toBeNull();
    const strip = screen.getByRole("img", { name: /六面点数/ });
    expect(strip.querySelectorAll(".abyssa-dice__die")).toHaveLength(6);

    await user.click(screen.getByRole("button", { name: /第 6 面/ }));
    expect(screen.getByRole("img", { name: "点数 6" })).toHaveAttribute("data-pip", "6");

    // 六种点位都由 CSS 画出。
    for (const pip of [1, 2, 3, 4, 5, 6]) {
      expect(CSS).toContain(`.abyssa-dice__die[data-pip="${pip}"]::after`);
    }
    const dieAt = CSS.indexOf('.abyssa-dice__die[data-pip="5"]::after');
    expect(CSS.slice(dieAt, dieAt + 420)).toMatch(/radial-gradient/);
  });

  /* 总览态铭牌原本空出 65px 死白(战面态有白骰占位,总览态没有)——
     用六面点数缩略图填上,并标出哪几面沉眠。 */
  it("fills the overview plaque with a six-face pip strip", () => {
    const { container } = render(
      <DiceLoadoutPanel loadout={authored()} characterName="蕾诺尔" />
    );

    const strip = container.querySelector(".abyssa-dice__strip")!;
    expect(strip).not.toBeNull();

    const dice = strip.querySelectorAll(".abyssa-dice__die");
    expect(dice).toHaveLength(6);
    // 按面序 1..6 给出点数。
    expect([...dice].map((d) => d.getAttribute("data-pip"))).toEqual([
      "1", "2", "3", "4", "5", "6"
    ]);
    // 夹具两面沉眠,应被标灰。
    expect(strip.querySelectorAll("[data-asleep]")).toHaveLength(2);

    // 一行六枚,占满铭牌宽。
    const at = CSS.indexOf(".abyssa-dice__strip {");
    expect(CSS.slice(at, CSS.indexOf("}", at))).toMatch(/repeat\(6,\s*24px\)/);
  });

  /* BUG 回归:长角色名把标题挤崩。
     「艾比希斯的命骰」需 184px,铭牌只有 168px。
     h3 是 flex 且带 overflow-wrap:anywhere 时会在**字与字之间**断开,
     再被 align-items:baseline 拉错行 —— 标题直接崩。
     修法:归属前缀拆成独立一行小字,大字只留「命骰」。 */
  it("keeps a long owner name from breaking the title", () => {
    const { container } = render(
      <DiceLoadoutPanel loadout={authored()} characterName="艾比希斯" />
    );

    // 归属独立成行,不再挤进 h3。
    const owner = container.querySelector(".abyssa-dice__owner")!;
    expect(owner).not.toBeNull();
    expect(owner.textContent).toBe("艾比希斯的");
    expect(container.querySelector(".abyssa-dice__ident h3")!.textContent).toBe("命骰");

    // h3 不许再逐字断行;两个子项各自 nowrap。
    const h3At = CSS.indexOf(".abyssa-dice__ident h3 {");
    // 剥注释 —— 注释里写着「曾用 overflow-wrap:anywhere」这句反例说明。
    const h3Block = CSS.slice(h3At, CSS.indexOf("}", h3At)).replace(
      /\/\*[\s\S]*?\*\//g,
      ""
    );
    expect(h3Block).not.toMatch(/overflow-wrap:\s*anywhere/);
    expect(h3Block).toMatch(/flex-wrap:\s*wrap/);
    expect(CSS).toMatch(/h3 > span,\s*\n\.abyssa-dice__ident h3 > em \{\s*white-space: nowrap/);

    // 归属行本身超长时用省略号,不换行。
    const ownerAt = CSS.indexOf(".abyssa-dice__owner {");
    const ownerBlock = CSS.slice(ownerAt, CSS.indexOf("}", ownerAt));
    expect(ownerBlock).toMatch(/white-space:\s*nowrap/);
    expect(ownerBlock).toMatch(/text-overflow:\s*ellipsis/);
  });

  /* BUG 回归:菱形座的内描边(::before, z-index:3)压在 ItemSlot 上方,
     没有 pointer-events:none 时会吞掉整个点击 —— 道具点不动。
     凡是覆盖在按钮之上的纯装饰层都必须关掉命中测试。 */
  it("keeps decorative charm layers from swallowing clicks", () => {
    const overlays = [
      ".abyssa-dice__charm-medallion::before",
      ".abyssa-dice__charm-name::before",
      ".abyssa-dice__charm-name-inner::before"
    ];
    for (const sel of overlays) {
      const at = CSS.indexOf(`${sel} {`);
      expect(at, `${sel} 规则缺失`).toBeGreaterThan(-1);
      const block = CSS.slice(at, CSS.indexOf("}", at));
      expect(block, `${sel} 会吞掉点击`).toMatch(/pointer-events:\s*none/);
    }
  });

  /* 三枚挂坠(含空位)都必须真的能点开检视栏。 */
  it("opens the inspector from every charm socket", async () => {
    const user = userEvent.setup();
    render(<DiceLoadoutPanel loadout={authored()} />);

    await user.click(screen.getByRole("button", { name: /夹具书页/ }));
    expect(screen.getByText("FIXTURE PAGE")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /夹具月环/ }));
    expect(screen.getByText("FIXTURE RING")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "挂坠位 3 空" }));
    expect(screen.getByText("虚位以待")).toBeInTheDocument();
  });

  /* 白骰必须在文字**上方**,不能并排。
     铭牌只有 168px 可用宽,白骰横放挤掉 53px,
     剩 115px 装不下标题与 kicker,必然折行 —— 那就是左半边乱的原因。 */
  it("stacks the white die above the text instead of beside it", () => {
    const headAt = CSS.indexOf(".abyssa-dice__ident-head {");
    const block = CSS.slice(headAt, CSS.indexOf("}", headAt));
    expect(block).toMatch(/display:\s*grid/);
    expect(block).not.toMatch(/display:\s*flex/);
    expect(block).toMatch(/row-gap/);

    // 骰子要够大才看得清点位。
    const dieAt = CSS.indexOf(".abyssa-dice__die {");
    const dieBlock = CSS.slice(dieAt, CSS.indexOf("}", dieAt));
    const size = Number(/width:\s*(\d+)px/.exec(dieBlock)?.[1]);
    expect(size).toBeGreaterThanOrEqual(56);
  });

  /* 数据格的标签是「图标 + 文字」,不是纯文字表格。 */
  it("pairs an icon with the text label in data cells", () => {
    const { container } = render(<DiceLoadoutPanel loadout={authored()} />);

    const labelled = [...container.querySelectorAll(".abyssa-dice__cell-data b")];
    expect(labelled.length).toBeGreaterThanOrEqual(4);
    // 每个标签里都有一枚标记(mask 图标 / 花色底板 / 铭记号)。
    const withGlyph = labelled.filter((b) => b.querySelector("i"));
    expect(withGlyph.length).toBe(labelled.length);

    // 图标不能小到看不见。
    const iconAt = CSS.indexOf(".abyssa-dice__cell-icon {");
    const iconBlock = CSS.slice(iconAt, CSS.indexOf("}", iconAt));
    expect(Number(/width:\s*(\d+)px/.exec(iconBlock)?.[1])).toBeGreaterThanOrEqual(13);

    // 图标走 mask,不是 <img>。
    const icon = container.querySelector<HTMLElement>(".abyssa-dice__cell-icon");
    if (icon) {
      expect(icon.style.maskImage || icon.style.webkitMaskImage).toMatch(
        /^url\(["']?(?:data:image\/svg\+xml|[^"')]*\.svg)/
      );
    }
  });

  /* 背景不许再用方格网 —— 那是 HUD/科幻语汇。 */
  it("uses woven texture rather than a sci-fi grid", () => {
    expect(CSS).not.toMatch(/0 0 \/ 14px 14px/);
    const plateAt = CSS.indexOf(".abyssa-dice__plate {");
    expect(CSS.slice(plateAt, CSS.indexOf("}", plateAt))).toMatch(
      /repeating-linear-gradient/
    );
  });

  /* 信息栏绝不许被内容顶破:正文自己滚动。 */
  it("keeps the inspector body scrollable instead of growing the container", () => {
    const { container } = render(<DiceLoadoutPanel loadout={authored()} />);

    const scroll = container.querySelector(".abyssa-dice__plate-scroll")!;
    expect(scroll).not.toBeNull();
    // 可键盘滚动。
    expect(scroll).toHaveAttribute("tabindex", "0");
    expect(scroll).toHaveAttribute("aria-live", "polite");
  });

  /* 空壁龛必须是镂空虚线,不是渐变色块。 */
  it("renders vacant sockets as dashed cutouts", () => {
    const { container } = render(<DiceLoadoutPanel loadout={authored()} />);

    const empty = container.querySelector(".abyssa-dice__charm[data-empty]")!;
    expect(empty).not.toBeNull();
    // 空槽走 ItemSlot 的凹孔层,而不是自绘方块。
    expect(empty.querySelector('.abyssa-item-slot[data-empty]')).not.toBeNull();
    expect(empty.querySelector('[data-layer="socket"]')).not.toBeNull();
    // 有内容的壁龛不带 data-empty。
    expect(container.querySelectorAll(".abyssa-dice__charm[data-empty]")).toHaveLength(1);
  });

  it("opens on the overview and shows suit split plus the pact", () => {
    const { container } = render(
      <DiceLoadoutPanel loadout={authored()} characterName="夹具" />
    );

    expect(screen.getByText("ARCHIVE · 总览")).toBeInTheDocument();
    expect(screen.getByText(/夹具的/)).toBeInTheDocument();
    // 数据格:标签 + 值分离,不再是一句散文。
    const cells = container.querySelectorAll(".abyssa-dice__cell-data");
    const read = (label: string) =>
      [...cells].find((c) => c.querySelector("b")?.textContent === label)?.querySelector("span")
        ?.textContent ?? "";
    expect(read("已醒")).toContain("4");
    expect(read("沉眠")).toContain("2");
    expect(read("主色")).toContain("彼岸");
    expect(screen.getByText(/测试私约/)).toBeInTheDocument();
  });

  it("inspects an awake face when its cell is clicked", async () => {
    const user = userEvent.setup();
    render(<DiceLoadoutPanel loadout={authored()} />);

    await user.click(screen.getByRole("button", { name: /第 3 面，治疗 2/ }));

    expect(screen.getByText("FACE · 第 3 面")).toBeInTheDocument();
    expect(screen.getByText("SPECIMEN · III")).toBeInTheDocument();
    // 点数由铭牌左侧的传统白骰承载 —— 比数字直观。
    const die = screen.getByRole("img", { name: "点数 3" });
    expect(die).toHaveClass("abyssa-dice__die");
    expect(die).toHaveAttribute("data-pip", "3");

    // 命数格仍给出数值与醒/眠状态。
    const fate = [...document.querySelectorAll(".abyssa-dice__cell-data")].find(
      (c) => c.querySelector("b")?.textContent?.includes("命数")
    )!;
    expect(fate.querySelector("span")?.textContent).toContain("3");
    expect(fate.querySelector("s")?.textContent).toBe("已醒");
  });

  /* 沉眠面点开说明「不进牌型」,并且不显示点数/战面这类数据格。 */
  it("explains a dormant face without showing pip or power cells", async () => {
    const user = userEvent.setup();
    const { container } = render(<DiceLoadoutPanel loadout={authored()} />);

    await user.click(screen.getByRole("button", { name: /第 1 面，沉眠/ }));

    expect(screen.getByText("FACE · 沉眠")).toBeInTheDocument();
    expect(screen.getByText("STILL ASLEEP")).toBeInTheDocument();

    const labels = [...container.querySelectorAll(".abyssa-dice__cell-data b")].map(
      (b) => b.textContent
    );
    expect(labels).toEqual(["状态"]);
    expect(container.textContent).toContain("不参与任何牌型");
  });

  /* 被挂坠改写的面要挂一枚坠,并在检视栏说明来源与原值。 */
  it("marks a rewritten face and attributes it to the charm", async () => {
    const user = userEvent.setup();
    const { container } = render(<DiceLoadoutPanel loadout={authored()} />);

    expect(container.querySelectorAll(".abyssa-dice__pin")).toHaveLength(1);

    await user.click(screen.getByRole("button", { name: /第 5 面/ }));

    // 战面格显示新值 + 原值,并被标成 accent。
    const power = [...container.querySelectorAll(".abyssa-dice__cell-data")].find(
      (c) => c.querySelector("b")?.textContent === "战面"
    )!;
    expect(power).toHaveAttribute("data-tone", "accent");
    expect(power.querySelector("span")?.textContent).toContain("3");
    expect(power.querySelector("s")?.textContent).toContain("2");
    expect(screen.getByText(/由【夹具书页】供给/)).toBeInTheDocument();
  });

  it("inspects a charm and then the vacant socket", async () => {
    const user = userEvent.setup();
    render(<DiceLoadoutPanel loadout={authored()} />);

    await user.click(screen.getByRole("button", { name: /夹具书页/ }));
    expect(screen.getByText("FIXTURE PAGE")).toBeInTheDocument();
    expect(screen.getByText("战面改写")).toBeInTheDocument();
    expect(screen.getByText("夹具轶闻。")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "挂坠位 3 空" }));
    expect(screen.getByText("虚位以待")).toBeInTheDocument();
    expect(screen.getByText("VACANT")).toBeInTheDocument();
  });

  it("keeps selection state on the clicked column only", async () => {
    const user = userEvent.setup();
    const { container } = render(<DiceLoadoutPanel loadout={authored()} />);

    await user.click(screen.getByRole("button", { name: /第 6 面/ }));
    expect(container.querySelectorAll(".abyssa-dice__column[data-selected]")).toHaveLength(1);

    await user.click(screen.getByRole("button", { name: /第 2 面/ }));
    expect(container.querySelectorAll(".abyssa-dice__column[data-selected]")).toHaveLength(1);
    expect(screen.getByRole("button", { name: /第 2 面/ })).toHaveAttribute("aria-pressed", "true");
  });

  /* 占位态也要穿 RpgFrame,不能是裸 div。 */
  it("wraps the placeholder in a frame as well", () => {
    const { container } = render(<DiceLoadoutPanel loadout={diceLoadoutPlaceholderFixture} />);

    expect(container.querySelector('[data-placeholder="true"]')).not.toBeNull();
    expect(container.querySelector(".abyssa-frame")).not.toBeNull();
    expect(screen.getByText("未编入远征")).toBeInTheDocument();
    expect(screen.queryByLabelText("命骰六面")).not.toBeInTheDocument();
  });

});
