import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

/* 版面护栏。读 CSS 源码断言几何关系 —— jsdom 不做布局，
   这些量只能从样式表本身核对。
   注释必须先剥掉：里面写着「12 太挤」「不是全身」这类反例说明，
   不剥会命中自己的说明文字。 */
const CSS = readFileSync(resolve(import.meta.dirname, "./sortie.css"), "utf8");
const RULES = CSS.replace(/\/\*[\s\S]*?\*\//g, "");

function token(name: string): number {
  const match = RULES.match(new RegExp(`--${name}:\\s*([0-9.]+)px`));
  if (!match) throw new Error(`token --${name} not found`);
  return Number(match[1]);
}

/* RpgFrame 的三层嵌套装饰，最内侧是 inset:10 处 2px 宽的四角括号。
   数值取自 components-foundation.css，那里是唯一来源。 */
const FRAME_ORNAMENT_EDGE = 10 + 2;

describe("sortie layout", () => {
  /* 老毛病：只看外框不看装饰层，把 padding 设成 12 → 净间隙 0，
     内容正好压在四角括号上。 */
  it("clears the RpgFrame ornaments instead of butting against them", () => {
    const pad = token("sortie-pad");
    expect(pad).toBeGreaterThan(FRAME_ORNAMENT_EDGE);
    /* 6px 以下肉眼仍然是「贴着」。sm(14) 只剩 2px，不够。 */
    expect(pad - FRAME_ORNAMENT_EDGE).toBeGreaterThanOrEqual(6);
  });

  /* 「padding 是否真的生效」不在这里断言 —— 读源码只能证明规则存在，
     证明不了它赢过 foundation 的 padding:0。那道关在 sortie-cascade.test.ts，
     对构建产物做真正的权重算术。 */

  /* 海报必须切在腰以上。
     素材 704x1472 若 1:1 放进 2:3 的框，会露到 71.7% —— 那是大腿，
     下半张全是腿和裙子（上一版「下面空一大块」的真因）。
     解剖位置由 alpha 通道实测：头 0-13%、肩 22%、胸 35%、腰 52%。 */
  it("crops posters above the waist instead of down to the thighs", () => {
    const width = token("sortie-poster-w");
    const height = token("sortie-poster-h");
    const zoom = Number(RULES.match(/--sortie-poster-zoom:\s*([0-9.]+)/)![1]);

    const renderedHeight = ((width * zoom) * 1472) / 704;
    const revealed = height / renderedHeight;

    /* 露出比例要落在胸线(35%)与腰线(52%)之间。 */
    expect(revealed).toBeGreaterThan(0.35);
    expect(revealed).toBeLessThan(0.52);
  });

  it("keeps the poster frame at poster proportions", () => {
    const ratio = token("sortie-poster-h") / token("sortie-poster-w");
    /* 2:3 电影海报，允许一点浮动。 */
    expect(ratio).toBeGreaterThan(1.4);
    expect(ratio).toBeLessThan(1.6);
  });

  /* 海报排那一行的纵向预算必须严丝合缝：
       padding-top(给上浮) + 海报 + 横向滚动条 = 行高
     三项缺一不可。
       - 漏掉 lift：卡片上浮时顶出容器上沿，被 overflow-y:hidden 切掉
         （「上边框被挡住」）；
       - 漏掉滚动条：九人必定溢出，滚动条常驻并压住卡片底部。
     曾经 128x192 而行高 252，下方白白空掉 60px，也由这条挡住。 */
  it("budgets the poster row down to the pixel", () => {
    const poster = token("sortie-poster-h");
    const row = token("sortie-row-h");
    const lift = token("sortie-poster-lift");
    const scrollbar = token("sortie-scrollbar-h");

    expect(lift + poster + scrollbar).toBe(row);
    /* 留白不能借「给上浮预留」之名重新长回去。 */
    expect(lift).toBeLessThanOrEqual(8);
  });

  /* 上浮的空间必须由容器 padding 让出，不能指望 overflow-y:visible：
     CSS 规定两轴不能一个 visible、一个 auto —— 浏览器会把 y 也算成 auto，
     纵向冒出滚动条。也不能只让海报比行矮：align-items 是 flex-start，
     空隙会全落在下方，上浮照样顶出上沿。 */
  it("reserves the hover lift with padding on the scroller itself", () => {
    const row = RULES.match(/\.abyssa-sortie-roster__row\s*\{([^}]*)\}/)?.[1] ?? "";

    expect(row).toMatch(/padding-top:\s*var\(--sortie-poster-lift\)/);
    expect(row).toMatch(/overflow-y:\s*hidden/);
  });

  /* 名字压在立绘上，必须有暗底衬托，否则遇到浅色立绘就糊成一片。
     用背景渐变而不是 mask —— mask 会连 box-shadow 一起裁掉。 */
  it("darkens the caption area enough to carry text over artwork", () => {
    const height = token("sortie-poster-h");
    const scrimHeight = Number(
      RULES.match(/\.abyssa-sortie-poster__art::after\s*\{[^}]*height:\s*([0-9.]+)px/)![1]
    );
    const nameBottom = Number(
      RULES.match(/\.abyssa-sortie-poster__nm\s*\{[^}]*bottom:\s*([0-9.]+)px/)![1]
    );
    const nameFontSize = Number(
      RULES.match(/\.abyssa-sortie-poster__nm\s*\{[^}]*font-size:\s*([0-9.]+)px/)![1]
    );

    /* 名字整行都要落在压暗区内。 */
    const nameTop = height - nameBottom - nameFontSize * 1.2;
    expect(nameTop).toBeGreaterThanOrEqual(height - scrimHeight);
  });

  it("zooms by width and centres horizontally so faces stay whole", () => {
    /* 九人上半身水平重心实测都在 47.9%-55%，居中裁是安全的；
       object-fit:cover 交给浏览器决定裁哪边，控制不住。
       width 与 transform 由 portraitFraming() 行内注入（逐角色校准）。 */
    const artRule = RULES.match(/\.abyssa-sortie-poster__art img\s*\{([^}]*)\}/)?.[1] ?? "";
    expect(artRule).toContain("height: auto");
    expect(artRule).toMatch(/aspect-ratio:\s*704\s*\/\s*1472/);
    expect(artRule).not.toContain("object-fit");
    /* 悬停放大必须走独立的 scale 属性：transform 里存着逐角色 x 校准，
       覆盖 transform 会把校准冲掉。 */
    expect(artRule).not.toMatch(/transform:\s*translateX/);
  });

  /* 悬停投影不能被自己裁掉。裁图与投影必须分层：
     外层浮动 + 投影（overflow:visible），内层裁图（overflow:hidden）。 */
  it("keeps the hover shadow outside the clipping layer", () => {
    const outer = RULES.match(/\n\.abyssa-sortie-poster\s*\{([^}]*)\}/)?.[1] ?? "";
    const clip = RULES.match(/\n\.abyssa-sortie-poster__clip\s*\{([^}]*)\}/)?.[1] ?? "";

    expect(outer).toMatch(/overflow:\s*visible/);
    /* mask 同样会裁掉 box-shadow，外层不许再挂。 */
    expect(outer).not.toContain("mask-image");
    expect(clip).toMatch(/overflow:\s*hidden/);

    const hover = RULES.match(
      /\.abyssa-sortie-poster:hover:not\(:disabled\) \.abyssa-sortie-poster__clip,[^{]*\{([^}]*)\}/
    )?.[1] ?? "";
    /* 落在内层的外投影：clip 自己不裁 box-shadow 的外扩部分。 */
    expect(hover).toMatch(/box-shadow:[^;]*\n?[^;]*0 12px 26px/);
  });

  /* 「完全没有边框」和「四方粗框」都不对：要一道淡描边 + 内嵌感。 */
  it("gives the poster a faint edge and an inset well", () => {
    const clip = RULES.match(/\n\.abyssa-sortie-poster__clip\s*\{([^}]*)\}/)?.[1] ?? "";

    const border = clip.match(/border:\s*1px solid rgb\([^)]*\/\s*([0-9.]+)%\)/);
    expect(border).not.toBeNull();
    /* 淡：不超过 30%，否则又变回描边卡。 */
    expect(Number(border![1])).toBeLessThanOrEqual(30);
    /* 内嵌：至少一条 inset 阴影。 */
    expect(clip).toMatch(/box-shadow:[\s\S]*?inset/);
  });

  /* 卡面不许用四方描边围一圈 —— 那是表格单元格语汇。 */
  it("does not box the poster in a full border", () => {
    const posterRule = RULES.match(/\n\.abyssa-sortie-poster\s*\{([^}]*)\}/)?.[1] ?? "";
    expect(posterRule).toMatch(/border:\s*0/);
  });

  /* 左侧海报是凹入的选人槽，右侧资料是装订在底板上的铭牌；两者都要有
     角色面板式的材质层次，不能再退回一块纯背景上的无边框平铺。 */
  it("gives the poster well and info plate distinct tactile layers", () => {
    const rowRule = RULES.match(/\.abyssa-sortie-roster__row\s*\{([^}]*)\}/)?.[1] ?? "";
    const panelRule = RULES.match(/\.abyssa-sortie-info-panel\s*\{([^}]*)\}/)?.[1] ?? "";
    const infoRule = RULES.match(/\n\.abyssa-sortie-info\s*\{([^}]*)\}/)?.[1] ?? "";

    expect(rowRule).toMatch(/outline:\s*1px/);
    expect(rowRule).toMatch(/background:/);
    expect(rowRule).toMatch(/box-shadow:[\s\S]*inset/);
    expect(panelRule).toMatch(/border:\s*1px/);
    expect(panelRule).toMatch(/background:/);
    expect(panelRule).toMatch(/box-shadow:[\s\S]*inset/);
    expect(infoRule).toMatch(/border:\s*0/);
    expect(infoRule).toMatch(/background:/);
  });

  /* 抽屉高度必须容得下内容行 + 标签行 + 上下 padding，
     否则内容会被 RpgFrame 的 overflow 切掉。 */
  it("sizes the drawer from its own parts rather than a hand-picked number", () => {
    const drawer = token("sortie-drawer-h");
    const row = token("sortie-row-h");
    const padTop = token("sortie-roster-pad-top");
    const padBottom = token("sortie-roster-pad-bottom");
    const gap = token("sortie-roster-gap");
    const labelRow = token("sortie-roster-label-h");

    expect(drawer).toBe(padTop + labelRow + gap + row + padBottom);
  });

  /* 内容行要放得下六面展开图：十字是 3 行格子 + 2 道 4px 间隙。 */
  /* 六面摊成一排后，约束从「三行会不会太高」变成「六格会不会太宽」。
     两个方向都要管：横向撑破信息栏会溢出，纵向撑破会顶掉下方读数。 */
  it("keeps the face strip inside the info column", () => {
    const cell = token("sortie-cell");
    const gap = 4;

    /* 横向：六格一排要装进右侧铭牌扣除边框与两侧内边距后的净宽。 */
    const stripWidth = cell * 6 + gap * 5;
    /* 右栏边框 2px + info 两侧 padding + 浮雕底板两侧 padding 8px。 */
    const infoInnerWidth = token("sortie-info-w") - token("sortie-info-pad") * 2 - 2 - 16;
    expect(stripWidth).toBeLessThanOrEqual(infoInnerWidth);

    /* 纵向：一排只占一格高，加上标题与读数仍要落在行高内。
       读数区按「能放下三行」取下限，而不是照抄某一版的实得高度
       —— 那是结果不是约束，骰格一变就会误报。
       三行 = 战面 / 花色 / 赌法，赌法是整句可能折两行：
         21(行高) * 4 行 + gap 6*2 + 分隔线 padding 5*2 = 106。 */
    const infoChrome = 4 + 29 + 20 + 106;
    expect(cell + infoChrome).toBeLessThanOrEqual(token("sortie-row-h"));
  });

  /* 骰面必须是一排，不是十字：编队时横向顺次比对，
     折成 4x3 会白占约 120px 纵向空间，把下方读数挤成小字。 */
  it("lays the faces out in a single row", () => {
    expect(RULES).toMatch(
      /\.abyssa-sortie__strip\s*\{[^}]*grid-template-columns:\s*repeat\(6,\s*var\(--sortie-cell\)\)/
    );
    expect(RULES).not.toContain(".abyssa-sortie__cross");
  });

  /* 信息栏加宽是从名单那一栏借的地。借到名单一屏塞不下一整队为止 ——
     四个槽位都看不全的话，编队时得来回滚动才能确认阵容。 */
  it("leaves the roster wide enough to show a full party", () => {
    /* 可用区 1311.67 - 浮层内缩 18*2 - 抽屉 padding。 */
    const drawerInner = 1311.67 - 18 * 2 - token("sortie-roster-pad-x") * 2;
    const rosterWidth = drawerInner - token("sortie-info-w") - token("sortie-roster-pad-x");
    const poster = token("sortie-poster-w");
    const gap = token("sortie-gap");

    /* SORTIE_SLOT_COUNT = 4。 */
    const visible = (rosterWidth + gap) / (poster + gap);
    expect(visible).toBeGreaterThanOrEqual(4);
  });

  /* 骰面让出的纵向空间要真的用在读数上，不能省下来又空着。
     这里是「这套阵容能打成什么样」的答案，之前挤在 10/11px 里读不动。 */
  it("gives the readouts a legible size", () => {
    const title = Number(
      RULES.match(/\.abyssa-sortie-roster__title\s*\{[^}]*font-size:\s*([0-9.]+)px/)![1]
    );
    const summary = Number(
      RULES.match(/\.abyssa-sortie-roster__summary > span\s*\{[^}]*font-size:\s*([0-9.]+)px/)![1]
    );
    const value = Number(
      RULES.match(/\.abyssa-sortie-info__kv dd\s*\{[^}]*font-size:\s*([0-9.]+)px/)![1]
    );
    const label = Number(
      RULES.match(/\.abyssa-sortie-info__kv dt\s*\{[^}]*font-size:\s*([0-9.]+)px/)![1]
    );
    const tally = Number(
      RULES.match(/\.abyssa-sortie__tally-item b\s*\{[^}]*font-size:\s*([0-9.]+)px/)![1]
    );
    const note = Number(
      RULES.match(/\.abyssa-sortie-info__kv dd\.abyssa-sortie-info__note\s*\{[^}]*font-size:\s*([0-9.]+)px/)![1]
    );

    expect(title).toBeGreaterThanOrEqual(15);
    expect(summary).toBeGreaterThanOrEqual(15);
    expect(value).toBeGreaterThanOrEqual(16);
    expect(tally).toBeGreaterThanOrEqual(15);
    expect(label).toBeGreaterThanOrEqual(11);
    expect(note).toBeGreaterThanOrEqual(13);
    /* 标签仍要弱于数值：层级不能因为放大而抹平。 */
    expect(label).toBeLessThan(value);
  });

  /* 队伍舞台现在使用近方形的 Q 版透明图。若沿用纵长海报的 contain，
     角色会缩成槽位底部的一小团；宽帽与翅膀也会被席位窄框硬切掉。 */
  it("bottom-anchors party figures without clipping wide silhouettes", () => {
    const art = RULES.match(
      /\.abyssa-sortie-figure\[data-art="figure"\] \.abyssa-sortie-figure__art\s*\{([^}]*)\}/
    )?.[1] ?? "";
    const image = RULES.match(
      /\.abyssa-sortie-figure\[data-art="figure"\] \.abyssa-sortie-figure__art img\s*\{([^}]*)\}/
    )?.[1] ?? "";

    expect(art).toMatch(/overflow:\s*visible/);
    expect(image).toMatch(/position:\s*absolute/);
    expect(image).toMatch(/bottom:\s*0/);
    expect(image).toMatch(/height:\s*110%/);
    expect(image).toMatch(/translateX\(calc\(-50% \+ var\(--sortie-figure-x, 0%\)\)\)/);
    expect(image).toMatch(/translateY\(calc\(0% - var\(--sortie-figure-y, 0%\)\)\)/);
    expect(image).toMatch(/scale\(var\(--sortie-figure-scale, 1\)\)/);
    expect(image).toMatch(/scaleX\(var\(--sortie-figure-flip-x, 1\)\)/);
    expect(image).toMatch(/transform-origin:\s*bottom center/);
    expect(image).toMatch(/pointer-events:\s*none/);
    expect(image).toMatch(/contrast\(1\.07\)/);
    expect(image.match(/drop-shadow\(/g)).toHaveLength(3);

    /* 地图态不能缩回曾经 138px 的小人；最矮席也要足够读清轮廓。 */
    const mapSlotHeights = [...RULES.matchAll(
      /\.abyssa-sortie-stage\[data-mode="map"\] \.abyssa-sortie-stage__slot:nth-child\(\d\)[^{]*\{[^}]*height:\s*([0-9.]+)px/g
    )].map((match) => Number(match[1]));
    expect(mapSlotHeights).toHaveLength(5);
    expect(Math.min(...mapSlotHeights)).toBeGreaterThanOrEqual(170);

    const mapSlots = RULES.match(
      /\.abyssa-sortie-stage\[data-mode="map"\] \.abyssa-sortie-stage__slots\s*\{([^}]*)\}/
    )?.[1] ?? "";
    expect(mapSlots).toMatch(/pointer-events:\s*none/);
  });

  it("compacts the external lineup while keeping the team editor formation readable", () => {
    const mapStage = RULES.match(
      /\.abyssa-sortie-stage\[data-mode="map"\]\s*\{([^}]*)\}/
    )?.[1] ?? "";
    const mapStageWidth = Number(mapStage.match(/width:\s*([0-9.]+)px/)?.[1]);
    const mapSlots = [...RULES.matchAll(
      /\.abyssa-sortie-stage\[data-mode="map"\] \.abyssa-sortie-stage__slot:nth-child\(\d\)[^{]*\{[^}]*width:\s*([0-9.]+)px;[^}]*height:\s*([0-9.]+)px/g
    )].map((match) => ({ width: Number(match[1]), height: Number(match[2]) }));
    const mapLineup = RULES.match(
      /\.abyssa-sortie-stage\[data-mode="map"\] \.abyssa-sortie-stage__slot\[data-lineup-index\]\s*\{([^}]*)\}/
    )?.[1] ?? "";
    const stowedRules = [...RULES.matchAll(/([^{}]+)\{([^}]*)\}/g)].filter((match) =>
      match[1].includes(".abyssa-sortie-stage__slot[data-leader][data-stowed]")
    );
    const mapStowed = stowedRules.find((match) => match[1].includes('[data-mode="map"]'))?.[2] ?? "";
    const popStowed = stowedRules.find((match) => match[1].includes('[data-mode="pop"]'))?.[2] ?? "";
    const hiddenEmpty = RULES.match(
      /\.abyssa-sortie-stage\[data-mode="map"\] \.abyssa-sortie-stage__slot\[data-empty\],[^{]*\{([^}]*)\}/
    )?.[1] ?? "";

    const teamStage = RULES.match(
      /\.abyssa-sortie-stage\[data-mode="team"\]\s*\{([^}]*)\}/
    )?.[1] ?? "";
    const teamStageWidth = Number(teamStage.match(/width:\s*([0-9.]+)px/)?.[1]);
    const teamStageTop = Number(teamStage.match(/top:\s*([0-9.]+)px/)?.[1]);
    const teamStageHeight = Number(teamStage.match(/height:\s*([0-9.]+)px/)?.[1]);
    const teamSlots = [...RULES.matchAll(
      /\.abyssa-sortie-stage\[data-mode="team"\] \.abyssa-sortie-stage__slot:nth-child\(\d\)[^{]*\{[^}]*left:\s*([0-9.]+)px;[^}]*width:\s*([0-9.]+)px/g
    )].map((match) => ({ left: Number(match[1]), width: Number(match[2]) }));
    const teamFigure = RULES.match(
      /\.abyssa-sortie-stage\[data-mode="team"\]\s+\.abyssa-sortie-figure\[data-art="figure"\]\s+\.abyssa-sortie-figure__art img\s*\{([^}]*)\}/
    )?.[1] ?? "";

    const centers = (slots: Array<{ left: number; width: number }>) =>
      slots.map((slot) => slot.left + slot.width / 2);
    const centerGaps = (slots: Array<{ left: number; width: number }>) =>
      centers(slots).slice(1).map((center, index) => center - centers(slots)[index]);

    /* 地图态只从连续站位算法接收横坐标；空槽不再占队形位置。 */
    expect(mapStageWidth).toBe(600);
    expect(mapSlots).toHaveLength(5);
    expect(mapLineup).toMatch(/left:\s*var\(--sortie-map-left\)/);
    expect(hiddenEmpty).toMatch(/opacity:\s*0/);
    expect(mapStowed).toMatch(/left:\s*-[0-9.]+px/);
    expect(mapStowed).toMatch(/opacity:\s*0\.[0-9]+/);
    expect(mapStage).toMatch(/clip-path:\s*inset\(-[0-9.]+px 0 -[0-9.]+px 0\)/);
    expect(popStowed).toMatch(/visibility:\s*hidden/);
    expect(popStowed).toMatch(/opacity:\s*0/);
    expect(popStowed).toMatch(/animation:\s*none/);
    expect(popStowed).toMatch(/pointer-events:\s*none/);
    expect(popStowed).not.toMatch(/left\s*:/);

    /* 展开编队反而收紧：相邻中心最多 170px，命中盒最多轻叠 5px。 */
    expect(teamStageWidth).toBe(880);
    expect(teamSlots).toHaveLength(5);
    expect(Math.max(...centerGaps(teamSlots))).toBeLessThanOrEqual(170);
    teamSlots.forEach((slot, index) => {
      expect(slot.left + slot.width).toBeLessThanOrEqual(teamStageWidth);
      const next = teamSlots[index + 1];
      if (next) expect(next.left - (slot.left + slot.width)).toBeGreaterThanOrEqual(-5);
    });

    /* 名单抽屉顶边由当前抽屉高度推导，编辑舞台不能压上去。 */
    const drawerTop = 787 - token("sortie-inset") - token("sortie-drawer-h");
    expect(teamStageTop + teamStageHeight).toBeLessThan(drawerTop);

    /* 地图态仍用通用规则的 110%；配队态人物吃满扣除名条后的 art 区。 */
    expect(teamFigure).toMatch(/height:\s*100%/);
  });

  /* 委托不是把地图态的小队原样挪开，更不能再把整组 opacity:0 藏掉。
     五席都要按同一倍率长大，才能读成「已经在目的地前集结」。 */
  it("enlarges every party figure for the quest muster instead of hiding the stage", () => {
    const mapStage = RULES.match(
      /\.abyssa-sortie-stage\[data-mode="map"\]\s*\{([^}]*)\}/
    )?.[1] ?? "";
    const popStage = RULES.match(
      /\.abyssa-sortie-stage\[data-mode="pop"\]\s*\{([^}]*)\}/
    )?.[1] ?? "";
    const slots = (mode: "map" | "pop") => [...RULES.matchAll(
      new RegExp(
        `\\.abyssa-sortie-stage\\[data-mode="${mode}"\\] \\.abyssa-sortie-stage__slot:nth-child\\(\\d\\)[^{]*\\{[^}]*width:\\s*([0-9.]+)px;[^}]*height:\\s*([0-9.]+)px`,
        "g"
      )
    )].map((match) => ({
      width: Number(match[1]),
      height: Number(match[2])
    }));

    expect(popStage).toMatch(/top:\s*var\(--sortie-muster-top\)/);
    expect(popStage).toMatch(/width:\s*var\(--sortie-muster-w\)/);
    expect(popStage).toMatch(/height:\s*var\(--sortie-muster-h\)/);
    expect(token("sortie-muster-w")).toBeGreaterThan(
      Number(mapStage.match(/width:\s*([0-9.]+)px/)?.[1])
    );
    expect(token("sortie-muster-h")).toBeGreaterThan(
      Number(mapStage.match(/height:\s*([0-9.]+)px/)?.[1])
    );

    const mapSlots = slots("map");
    const popSlots = slots("pop");
    expect(mapSlots).toHaveLength(5);
    expect(popSlots).toHaveLength(5);
    popSlots.forEach((slot, index) => {
      expect(slot.width / mapSlots[index]!.width).toBeGreaterThanOrEqual(1.2);
      expect(slot.height / mapSlots[index]!.height).toBeGreaterThanOrEqual(1.2);
    });

    /* 只排除“把整个 pop stage 藏起来”的规则；空席本身可以隐去。 */
    const hiddenPopStages = [...RULES.matchAll(/([^{}]+)\{([^}]*)\}/g)]
      .map(([, selector, body]) => ({ selector: selector.trim(), body }))
      .filter(({ selector, body }) =>
        selector.split(",").some((part) => {
          const normalized = part.trim().replace(/\s+/g, " ");
          const target = normalized.split(" ").at(-1) ?? "";
          return normalized.includes('[data-mode="pop"]') &&
            target.startsWith(".abyssa-sortie-stage") &&
            !target.startsWith(".abyssa-sortie-stage__") &&
            /opacity:\s*0(?:\s*;|\s*$)/.test(body);
        })
      );
    expect(hiddenPopStages).toEqual([]);
  });

  /* 侧板占 [18, 438] 或 [873.67, 1293.67]；集结区必须完整落在反侧，
     不能靠 panel 的 z-index 把重叠人物盖住来假装版面正确。 */
  it("keeps the quest muster opposite either side panel without overlap", () => {
    const viewportWidth = 1311.67;
    const inset = token("sortie-inset");
    const panelWidth = token("sortie-quest-w");
    const musterWidth = token("sortie-muster-w");
    const musterLeft = token("sortie-muster-left-x");
    const musterRight = token("sortie-muster-right-x");
    const panelRightRule = RULES.match(
      /\.abyssa-sortie-quest\[data-side="right"\]\s*\{([^}]*)\}/
    )?.[1] ?? "";
    const panelLeftRule = RULES.match(
      /\.abyssa-sortie-quest\[data-side="left"\]\s*\{([^}]*)\}/
    )?.[1] ?? "";
    const partyByRightPanel = RULES.match(
      /\.abyssa-sortie-stage\[data-mode="pop"\]\[data-quest-side="right"\]\s*\{([^}]*)\}/
    )?.[1] ?? "";
    const partyByLeftPanel = RULES.match(
      /\.abyssa-sortie-stage\[data-mode="pop"\]\[data-quest-side="left"\]\s*\{([^}]*)\}/
    )?.[1] ?? "";

    expect(panelRightRule).toMatch(/right:\s*var\(--sortie-inset\)/);
    expect(panelLeftRule).toMatch(/left:\s*var\(--sortie-inset\)/);
    expect(partyByRightPanel).toMatch(/left:\s*var\(--sortie-muster-left-x\)/);
    expect(partyByLeftPanel).toMatch(/left:\s*var\(--sortie-muster-right-x\)/);

    const leftPanelRightEdge = inset + panelWidth;
    const rightPanelLeftEdge = viewportWidth - inset - panelWidth;
    expect(musterLeft + musterWidth).toBeLessThanOrEqual(rightPanelLeftEdge);
    expect(musterRight).toBeGreaterThanOrEqual(leftPanelRightEdge);
    expect(musterLeft).toBeGreaterThanOrEqual(0);
    expect(musterRight + musterWidth).toBeLessThanOrEqual(viewportWidth);
  });

  /* 转身放在整组 slots 上，人物图内部的逐角色 x/y/scale/flipX 校准保持唯一。
     若 data-quest-side 直接命中 img 再写 transform，会把共享校准整段覆盖。 */
  it("mirrors the slots wrapper without replacing per-character figure transforms", () => {
    const baseSlots = RULES.match(
      /\.abyssa-sortie-stage__slots\s*\{([^}]*)\}/
    )?.[1] ?? "";
    const mirroredSlots = RULES.match(
      /\.abyssa-sortie-stage\[data-mode="pop"\]\[data-quest-side="left"\]\s+\.abyssa-sortie-stage__slots\s*\{([^}]*)\}/
    )?.[1] ?? "";
    const image = RULES.match(
      /\.abyssa-sortie-figure\[data-art="figure"\] \.abyssa-sortie-figure__art img\s*\{([^}]*)\}/
    )?.[1] ?? "";
    const sideRules = [...RULES.matchAll(/([^{}]+)\{([^}]*)\}/g)]
      .map(([, selector, body]) => ({ selector: selector.trim(), body }))
      .filter(({ selector }) => selector.includes("[data-quest-side="));

    expect(baseSlots).toMatch(/transform:\s*scaleX\(1\)/);
    expect(baseSlots).toMatch(/transform-origin:\s*center bottom/);
    expect(mirroredSlots).toMatch(/transform:\s*scaleX\(-1\)/);
    expect(image).toMatch(/translateX\(calc\(-50% \+ var\(--sortie-figure-x, 0%\)\)\)/);
    expect(image).toMatch(/translateY\(calc\(0% - var\(--sortie-figure-y, 0%\)\)\)/);
    expect(image).toMatch(/scale\(var\(--sortie-figure-scale, 1\)\)/);
    expect(image).toMatch(/scaleX\(var\(--sortie-figure-flip-x, 1\)\)/);

    expect(sideRules).not.toHaveLength(0);
    sideRules.forEach(({ selector, body }) => {
      expect(selector).not.toMatch(/\bimg\b/);
      expect(body).not.toMatch(/--sortie-figure-(?:x|y|scale|flip-x)\s*:/);
    });
  });

  /* 长句正文保持阅读字号；奖励与队伍状态属于短标签，可以更轻、更小，
     但仍要靠字号形成明确层级，不能重新堆成一片重字。 */
  it("keeps the quest panel body text readable", () => {
    const size = (selector: string) =>
      Number(
        RULES.match(
          new RegExp(`${selector.replace(/[.*+?^${}()|[\\]\\\\]/g, "\\\\$&")}\\s*\\{[^}]*font-size:\\s*([0-9.]+)px`)
        )![1]
      );

    /* 需要连续阅读的风味和威胁不得小于 14。 */
    expect(size(".abyssa-sortie-quest__flavor")).toBeGreaterThanOrEqual(14);
    expect(size(".abyssa-sortie-quest__threats span")).toBeGreaterThanOrEqual(14);
    /* 短标签可以退后，但不能小到不可读。 */
    expect(size(".abyssa-sortie-quest__yields li > span")).toBeGreaterThanOrEqual(12);
    expect(size(".abyssa-sortie-quest__kv dd")).toBeGreaterThanOrEqual(12);
    expect(size(".abyssa-sortie-quest__block h3")).toBeGreaterThanOrEqual(12);
    expect(size(".abyssa-sortie-quest__kv dt")).toBeGreaterThanOrEqual(11);
    expect(size(".abyssa-sortie-quest__reject")).toBeGreaterThanOrEqual(11);

    /* 标题仍要明显压过正文，层级不能因为放大而抹平。 */
    expect(size(".abyssa-sortie-quest__hd h2")).toBeGreaterThan(
      size(".abyssa-sortie-quest__flavor") + 4
    );
    /* 标签必须弱于它标注的值。 */
    expect(size(".abyssa-sortie-quest__kv dt")).toBeLessThan(size(".abyssa-sortie-quest__kv dd"));
  });

  /* 场景图底部由渐暗自然过渡，不能再叠半透明 border、四边 inset 和
     下沿 inset；三层混色会在裁切口形成明暗不一的“幽灵边”。 */
  it("does not double-draw the quest hero clipping edge", () => {
    const hero = RULES.match(/\.abyssa-sortie-quest__hero\s*\{([^}]*)\}/)?.[1] ?? "";

    expect(hero).toMatch(/border:\s*0/);
    expect(hero).not.toMatch(/border-bottom\s*:/);
    expect(hero).not.toMatch(/inset\s+0\s+0\s+0/);
    expect(hero).not.toMatch(/inset\s+0\s+-/);
  });

  /* 内框只允许落在有明确语义的轻拟物部件上，不能给每一段内容都套框。
     信息铭牌与标题菱形是本轮新增的两个层次，其余白名单沿用原有语义。 */
  it("limits interior frames to purposeful lightweight elements", () => {
    expect(RULES).not.toContain(".abyssa-sortie-stage__bg");
    const allowed = new Set([
      ".abyssa-sortie-quest__go",
      ".abyssa-sortie-figure__art",
      '.abyssa-sortie-figure[data-empty="true"] .abyssa-sortie-figure__art',
      ".abyssa-sortie-poster__void",
      /* 卡面的淡描边：这是「有边框但很淡」，不是四方粗框。
         淡到什么程度由上一条 it 单独把关（≤30% 不透明度）。 */
      ".abyssa-sortie-poster__clip",
      ".abyssa-sortie-poster__clip::after",
      /* 出战名册的槽位：与海报卡同一道淡描边（20% 不透明度）。 */
      ".abyssa-sortie-slot__art",
      /* 轻拟物标题标记与右侧资料铭牌。 */
      ".abyssa-sortie-roster__title::before",
      ".abyssa-sortie-roster.abyssa-frame",
      ".abyssa-sortie-info-panel",
      ".abyssa-sortie-info__dice::after",
      /* 场景图占位符右上角的小太阳，是圆形图案而非分区框。 */
      ".abyssa-sortie-quest__hero-placeholder i::after"
    ]);

    const boxed = [...RULES.matchAll(/([^{}]+)\{([^}]*)\}/g)]
      .map(([, selector, body]) => ({ selector: selector.trim(), body }))
      .filter(({ selector, body }) =>
        selector.startsWith(".abyssa-sortie") && /(?:^|;)\s*border:\s*1px/.test(body)
      )
      .map(({ selector }) => selector);

    expect(boxed.filter((selector) => !allowed.has(selector))).toEqual([]);
  });

  it("uses solid panel surfaces instead of decorative gradients", () => {
    for (const selector of [
      ".abyssa-sortie-roster__lab--list",
      ".abyssa-sortie-info-panel",
      ".abyssa-sortie-roster__lab--info",
      ".abyssa-sortie-roster__row",
      ".abyssa-sortie-info"
    ]) {
      const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const body = RULES.match(new RegExp(`${escaped}\\s*\\{([^}]*)\\}`))?.[1] ?? "";
      expect(body, selector).not.toMatch(/(?:linear|radial|conic|repeating-linear)-gradient\(/);
    }
  });

  /* 画布内禁视口单位：外层已有 scale，vw/vh 会二次缩放。 */
  it("never uses viewport units inside the fixed canvas", () => {
    expect(RULES).not.toMatch(/[0-9.]+v(w|h|min|max)\b/);
  });
});
