import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

/* 版面护栏。读 CSS 源码断言几何关系 —— jsdom 不做布局，
   这些量只能从样式表本身核对。
   注释必须先剥掉：里面写着「12 太挤」「不是全身」这类反例说明，
   不剥会命中自己的说明文字。 */
const stripComments = (css: string) => css.replace(/\/\*[\s\S]*?\*\//g, "");
const CSS = readFileSync(resolve(import.meta.dirname, "./sortie.css"), "utf8");
const RULES = stripComments(CSS);
/* 委托书与出战名单各自一张样式表；两者共用的文书（框、纸、木台、名牌、朱字小标）
   在 map-document.css；字阶令牌在地图材料表里。 */
const DOSSIER = stripComments(readFileSync(resolve(import.meta.dirname, "./sortie-dossier.css"), "utf8"));
const ROSTER = stripComments(readFileSync(resolve(import.meta.dirname, "./sortie-roster.css"), "utf8"));
const DOCUMENT = stripComments(readFileSync(resolve(import.meta.dirname, "../map-document.css"), "utf8"));
const MATERIALS = stripComments(readFileSync(resolve(import.meta.dirname, "../map-materials.css"), "utf8"));
const VIEWPORT = { width: 1311.67, height: 787 };

function token(name: string, rules = RULES): number {
  const match = rules.match(new RegExp(`--${name}:\\s*([0-9.]+)px`));
  if (!match) throw new Error(`token --${name} not found`);
  return Number(match[1]);
}

const escapeSelector = (selector: string) => selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** 规则体：选择器必须独占一条规则的开头，不会误中复合选择器的尾巴。 */
function ruleBody(rules: string, selector: string): string {
  return rules.match(new RegExp(`(?:^|[\\n}])\\s*${escapeSelector(selector)}\\s*\\{([^}]*)\\}`))?.[1] ?? "";
}

describe("sortie layout", () => {
  it("keeps the team backdrop translucent without changing its modal behavior", () => {
    const backdrop = ruleBody(RULES, '.abyssa-map-viewport[data-mode="team"] .abyssa-map-dim');
    const opacityStops = [...backdrop.matchAll(/rgb\([^/]+\/\s*(\d+)%\)/g)].map(match => Number(match[1]));
    expect(opacityStops).toEqual([36, 58, 62]);
    expect(RULES).toMatch(/\.abyssa-map-viewport\[data-mode="team"\] \.abyssa-map-dim,[\s\S]*?opacity:\s*1;\s*pointer-events:\s*auto;/);
  });

  /* ---------- 出战名单：人物牌 ---------- */

  /* 立绘按牌宽放大后锚在牌顶上方：头与帽越出牌顶，下沿在名字区上方化进纸里。
     露出的那一截要落在腰（52%）与大腿（65%）之间 —— 再短是证件照，再长腿就占了半张牌。
     解剖位置由 alpha 通道实测：头 0-13%、肩 22%、胸 35%、腰 52%。 */
  it("crops the card art between waist and thigh with the head breaking out of the top", () => {
    const width = token("roster-card-w", ROSTER);
    const zoom = Number(ROSTER.match(/--roster-zoom:\s*([0-9.]+)/)![1]);
    const breakout = token("roster-breakout", ROSTER);
    const visible = token("roster-card-h", ROSTER) + breakout - token("roster-label-h", ROSTER);
    const revealed = visible / ((width * zoom * 1472) / 704);

    expect(revealed).toBeGreaterThan(0.45);
    expect(revealed).toBeLessThan(0.65);
    expect(breakout).toBeGreaterThanOrEqual(20);
    expect(breakout).toBeLessThanOrEqual(48);
    expect(ruleBody(ROSTER, ".abyssa-sortie-poster__art")).toMatch(/top:\s*calc\(-1 \* var\(--roster-breakout\)\)/);
  });

  it("keeps the card at tarot proportions", () => {
    const ratio = token("roster-card-h", ROSTER) / token("roster-card-w", ROSTER);
    expect(ratio).toBeGreaterThan(1.6);
    expect(ratio).toBeLessThan(1.8);
  });

  /* 出框的头、入队抬起与悬停上浮都要落在牌架自己的上沿留白里：
     牌架是横向滚动容器，CSS 规定两轴不能一个 visible、一个 auto，
     超出上沿的部分只会被切掉，不能指望 overflow-y:visible。 */
  it("reserves room on the rail for the breakout, the chosen lift and the hover", () => {
    const rail = ruleBody(ROSTER, ".abyssa-sortie-roster__rail");
    const scrolling = ruleBody(ROSTER, ".abyssa-sortie-roster__shelf[data-scroll] .abyssa-sortie-roster__rail");
    expect(rail).toMatch(/padding:\s*var\(--roster-rail-top\)/);
    expect(rail).not.toMatch(/overflow-y:\s*hidden/);
    expect(scrolling).toMatch(/overflow-y:\s*hidden/);
    expect(ROSTER).toMatch(/--roster-rail-top:\s*calc\(var\(--roster-standee-h\)[^;]*var\(--roster-hover-lift\)/);
  });

  /* 立绘在名字区上沿化进纸里，名字整组落在纸上，不压在画面上。 */
  it("lets the art fade out before the name so the label sits on bare paper", () => {
    const art = ruleBody(ROSTER, ".abyssa-sortie-poster__art");
    expect(art).toMatch(/bottom:\s*var\(--roster-label-h\)/);
    expect(art).toMatch(/(?:^|[;\s])mask:\s*linear-gradient\([^;]*transparent\)/);

    const label = ruleBody(ROSTER, ".abyssa-sortie-poster__label");
    const bottom = Number(label.match(/bottom:\s*([0-9.]+)px/)![1]);
    const name = Number(ruleBody(ROSTER, ".abyssa-sortie-poster__nm").match(/font:\s*700\s+([0-9.]+)px/)![1]);
    const latin = Number(ruleBody(ROSTER, ".abyssa-sortie-poster__label small").match(/font:\s*600\s+([0-9.]+)px/)![1]);
    const epithet = token("map-type-min", MATERIALS);
    /* 称号 1.2 行高 + 名字 1.1 行高 + 英文名 + 两道 2px 间距与 1px 上距。 */
    expect(bottom + epithet * 1.2 + name * 1.1 + latin + 5).toBeLessThanOrEqual(token("roster-label-h", ROSTER));
  });

  it("zooms by width and centres horizontally so faces stay whole", () => {
    /* width 与 transform 由 cardFraming() 行内注入（逐角色校准）；
       高度随素材自身比例，写死 704:1472 会把 768:1376 的剪影横向压扁。 */
    const image = ruleBody(ROSTER, ".abyssa-sortie-poster__art img");
    expect(image).toContain("height: auto");
    expect(image).not.toContain("aspect-ratio");
    expect(image).not.toContain("object-fit");
    expect(image).not.toMatch(/transform:\s*translateX/);
  });

  /* 投影与描边挂在牌底上；裁图只发生在立绘那一层。
     合成一层的话，overflow / mask 会把自己的 box-shadow 一并切掉。 */
  it("keeps the card's edge and shadow outside every clipping layer", () => {
    const card = ruleBody(ROSTER, ".abyssa-sortie-poster");
    const sheet = ruleBody(ROSTER, ".abyssa-sortie-poster__sheet");
    const art = ruleBody(ROSTER, ".abyssa-sortie-poster__art");

    expect(card).toMatch(/border:\s*0/);
    expect(card).not.toMatch(/overflow\s*:|mask\s*:/);
    expect(sheet).toMatch(/box-shadow:[\s\S]*0 12px 22px/);
    expect(sheet).not.toMatch(/overflow\s*:|mask\s*:/);
    expect(art).toMatch(/overflow:\s*hidden/);
    expect(art).not.toContain("box-shadow");
  });

  /* 牌底与色场是离线印好的图：同一张纸按阵营染色。页面上不拿滤镜现调纸色，
     也不贴徽章、序号或角标 —— 阵营只靠纸、拱龛与字色区分。 */
  it("prints each faction's card on its own baked sheet without badges", () => {
    for (const faction of ["hero-party", "demon-cadre", "demon-lord"]) {
      expect(ruleBody(ROSTER, `.abyssa-sortie-poster[data-faction="${faction}"] .abyssa-sortie-poster__sheet`))
        .toMatch(new RegExp(`url\\("[^"]*roster/paper-${faction}\\.webp"\\)`));
      expect(ruleBody(ROSTER, `.abyssa-sortie-poster[data-faction="${faction}"]`)).toMatch(/--poster-ink:/);
    }
    expect(ruleBody(ROSTER, ".abyssa-sortie-poster__sheet")).not.toMatch(/filter\s*:/);
    expect(ROSTER).not.toMatch(/mix-blend-mode/);
    expect(ROSTER).not.toMatch(/\.abyssa-sortie-poster__(?:num|seal|badge|crest|rib|tag)\b/);
  });

  /* 一排要放得下当前的五人，资料页并排而不压牌；九人时才翻页。 */
  it("fits five cards beside the sheet", () => {
    const cards = 5 * token("roster-card-w", ROSTER) + 4 * token("roster-card-gap", ROSTER);
    const columnGap = Number(ruleBody(ROSTER, ".abyssa-sortie-roster").match(/column-gap:\s*([0-9.]+)px/)![1]);
    const shelf = VIEWPORT.width - 2 * token("sortie-inset") - token("roster-sheet-w", ROSTER) - columnGap;
    expect(cards).toBeLessThanOrEqual(shelf);
  });

  /* ---------- 出战名单：资料页 ---------- */

  /* 六面一排要装进资料页纸面的净宽：文书两侧木轨 10 + 外框 2、纸边 1、版心两侧内距。 */
  it("keeps the face strip inside the sheet's paper", () => {
    const strip = token("sortie-cell", ROSTER) * 6 + 4 * 5;
    const rail = token("abyssa-map-frame-rail", DOCUMENT);
    const padX = Number(ruleBody(ROSTER, ".abyssa-sortie-roster__page").match(/padding:\s*[0-9.]+px\s+([0-9.]+)px/)![1]);
    const paper = token("roster-sheet-w", ROSTER) - 2 * (rail + 2) - 2 - 2 * padX;
    expect(strip).toBeLessThanOrEqual(paper);
  });

  /* 骰面必须是一排，不是十字：编队时横向顺次比对，
     折成 4x3 会白占约 120px 纵向空间，把下方读数挤成小字。 */
  it("lays the faces out in a single row", () => {
    expect(RULES).toMatch(
      /\.abyssa-sortie__strip\s*\{[^}]*grid-template-columns:\s*repeat\(6,\s*var\(--sortie-cell\)\)/
    );
    expect(RULES).not.toContain(".abyssa-sortie__cross");
  });

  /* 资料页是「这套阵容能打成什么样」的答案，字不能退回 10/11px；
     朱字小标仍要弱于它标注的读数。 */
  it("gives the readouts and the card names a legible size", () => {
    const rubric = Number(ruleBody(DOCUMENT, ".abyssa-map-rubric").match(/font-size:\s*([0-9.]+)px/)![1]);
    const value = Number(ruleBody(ROSTER, ".abyssa-sortie-roster__facts dd").match(/font-size:\s*([0-9.]+)px/)![1]);
    const tally = Number(ruleBody(ROSTER, ".abyssa-sortie-roster .abyssa-sortie__tally-item b").match(/font-size:\s*([0-9.]+)px/)![1]);
    const name = Number(ruleBody(ROSTER, ".abyssa-sortie-poster__nm").match(/font:\s*700\s+([0-9.]+)px/)![1]);

    expect(value).toBeGreaterThanOrEqual(16);
    expect(tally).toBeGreaterThanOrEqual(15);
    expect(name).toBeGreaterThanOrEqual(20);
    expect(ruleBody(ROSTER, ".abyssa-sortie-poster__label em")).toMatch(/font-size:\s*var\(--map-type-min\)/);
    expect(rubric).toBeLessThan(value);
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

  it("moves the external lineup offstage while the card standees take over", () => {
    const offstage = ruleBody(RULES, ".abyssa-sortie-stage[data-offstage]");
    expect(offstage).toMatch(/visibility:\s*hidden/);
    expect(offstage).toMatch(/transition:\s*visibility/);
    expect(RULES).toMatch(/\.abyssa-sortie-stage\[data-mode="map"\]\s*\{/);
    expect(ROSTER).toMatch(/\.abyssa-sortie-poster__standee\s*\{/);
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

  /* 委托书占 [28, 468] 或 [843.67, 1283.67]；集结区必须完整落在反侧，
     不能靠委托书的 z-index 把重叠人物盖住来假装版面正确。
     委托书的内缩写在它自己的样式表里，比其他浮层的 18 多让出 10。 */
  it("keeps the muster opposite either side of the dossier without overlap", () => {
    const viewportWidth = 1311.67;
    const inset = token("sortie-inset");
    const panelWidth = token("sortie-quest-w");
    const musterWidth = token("sortie-muster-w");
    const musterLeft = token("sortie-muster-left-x");
    const musterRight = token("sortie-muster-right-x");
    const partyByRightPanel = RULES.match(
      /\.abyssa-sortie-stage\[data-mode="pop"\]\[data-quest-side="right"\]\s*\{([^}]*)\}/
    )?.[1] ?? "";
    const partyByLeftPanel = RULES.match(
      /\.abyssa-sortie-stage\[data-mode="pop"\]\[data-quest-side="left"\]\s*\{([^}]*)\}/
    )?.[1] ?? "";

    expect(ruleBody(DOSSIER, ".abyssa-sortie-dossier")).toMatch(/width:\s*var\(--sortie-quest-w\)/);
    expect(ruleBody(DOSSIER, '.abyssa-sortie-dossier[data-side="right"]')).toMatch(/right:\s*var\(--sortie-inset\)/);
    expect(ruleBody(DOSSIER, '.abyssa-sortie-dossier[data-side="left"]')).toMatch(/left:\s*var\(--sortie-inset\)/);
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

  /* 长句正文保持阅读字号；收获、行囊标签与提示属于短标签，可以更轻、更小，
     但仍要靠字号形成明确层级，不能重新堆成一片重字。 */
  it("keeps the dossier body text readable", () => {
    /* px 直接读；var(--map-type-*) 回到地图材料表的字阶。 */
    const size = (selector: string, sheet = DOSSIER) => {
      const value = ruleBody(sheet, selector).match(/font-size:\s*([^;]+)/)?.[1].trim();
      if (!value) throw new Error(`font-size for ${selector} not found`);
      const step = value.match(/^var\(--(map-type-[\w-]+)\)$/);
      return step ? token(step[1], MATERIALS) : Number(value.match(/^([0-9.]+)px$/)![1]);
    };

    /* 需要连续阅读的风味、敌情与未开放说明不得小于 14。 */
    expect(size(".abyssa-sortie-dossier__flavor")).toBeGreaterThanOrEqual(14);
    expect(size(".abyssa-sortie-dossier__facts dd")).toBeGreaterThanOrEqual(14);
    expect(size(".abyssa-sortie-dossier__condition")).toBeGreaterThanOrEqual(14);
    /* 短标签可以退后，但不能小到不可读。 */
    expect(size(".abyssa-sortie-dossier__yields li > span:not([class])")).toBeGreaterThanOrEqual(12);
    expect(size(".abyssa-map-rubric", DOCUMENT)).toBeGreaterThanOrEqual(12);
    expect(size(".abyssa-sortie-dossier__row-label")).toBeGreaterThanOrEqual(11);
    expect(size(".abyssa-map-document__notice", DOCUMENT)).toBeGreaterThanOrEqual(11);

    /* 标题由顶轨上的单行名牌承担（深底铭牌 + 字距），不再靠大一号压住正文；
       但不得小于正文。 */
    expect(size(".abyssa-map-document__plate .abyssa-nameplate__content strong", DOCUMENT)).toBeGreaterThanOrEqual(
      size(".abyssa-sortie-dossier__flavor")
    );
    /* 小标必须弱于它标注的正文。 */
    expect(size(".abyssa-map-rubric", DOCUMENT)).toBeLessThan(size(".abyssa-sortie-dossier__facts dd"));
  });

  it("scrolls the dossier paper without compressing its illustration or body", () => {
    const scroll = ruleBody(DOSSIER, ".abyssa-sortie-dossier__scroll");
    const print = ruleBody(DOSSIER, ".abyssa-sortie-dossier__print");

    for (const selector of [".abyssa-map-document__brass", ".abyssa-map-document__paper"]) {
      expect(ruleBody(DOCUMENT, selector), selector).toMatch(/min-height:\s*0/);
    }
    expect(scroll).toMatch(/min-height:\s*0/);
    expect(scroll).toMatch(/overflow-x:\s*hidden/);
    expect(scroll).toMatch(/overflow-y:\s*auto/);
    expect(scroll).toMatch(/overscroll-behavior:\s*contain/);
    expect(ruleBody(DOSSIER, ".abyssa-sortie-dossier__scroll > *")).toMatch(/flex-shrink:\s*0/);
    expect(print).toMatch(/flex:\s*none/);
    expect(print).toMatch(/aspect-ratio:\s*960\s*\/\s*400/);
    expect(DOSSIER).not.toMatch(/flex-shrink:\s*1/);
    expect(ruleBody(DOCUMENT, ".abyssa-map-document__ledge")).toMatch(/flex:\s*none/);
  });

  /* 版画由蒙版化进纸里，不能再给它或图片叠 border、outline、box-shadow；
     那会在裁切口画出一圈「幽灵边」，退回贴在纸上的相片。
     蒙版必须随框拉伸（100% 100%）。 */
  it("dissolves the dossier print into the paper instead of drawing a crop edge", () => {
    const print = ruleBody(DOSSIER, ".abyssa-sortie-dossier__print");
    const image = ruleBody(DOSSIER, ".abyssa-sortie-dossier__print img");

    expect(image).toMatch(/(?:^|[;\s])mask:\s*url\([^)]*print-mask-v1\.webp[^)]*\)[^;]*\/\s*100% 100%/);
    expect(image).toMatch(/mix-blend-mode:\s*multiply/);
    for (const [name, body] of [["print", print], ["image", image]]) {
      expect(body, name).not.toBe("");
      expect(body, name).not.toMatch(/(?:^|[;\s])(?:border|outline|box-shadow)(?:-[a-z]+)*\s*:/);
    }
  });

  /* 内框只允许落在有明确语义的轻拟物部件上，不能给每一段内容都套框。
     人物牌的裁口与纸边是 box-shadow 画的线，不在这里。 */
  it("limits interior frames to purposeful lightweight elements", () => {
    expect(RULES).not.toContain(".abyssa-sortie-stage__bg");
    const allowed = new Set([
      ".abyssa-sortie-figure__art",
      '.abyssa-sortie-figure[data-empty="true"] .abyssa-sortie-figure__art',
      /* 出战名册的槽位：共享头像框。 */
      ".abyssa-sortie-slot__art"
    ]);

    const boxed = [...`${RULES}\n${ROSTER}`.matchAll(/([^{}]+)\{([^}]*)\}/g)]
      .map(([, selector, body]) => ({ selector: selector.trim(), body }))
      .filter(({ selector, body }) =>
        selector.startsWith(".abyssa-sortie") && /(?:^|;)\s*border:\s*1px/.test(body)
      )
      .map(({ selector }) => selector);

    expect(boxed.filter((selector) => !allowed.has(selector))).toEqual([]);
  });

  /* 名单的面是印好的纸与离线色场，不是 CSS 渐变刷出来的板子。 */
  it("uses printed surfaces instead of decorative gradients", () => {
    for (const selector of [
      ".abyssa-sortie-poster__sheet",
      ".abyssa-sortie-poster__field",
      ".abyssa-sortie-roster__rail",
      ".abyssa-sortie-roster__page"
    ]) {
      const body = ruleBody(ROSTER, selector);
      expect(body, selector).not.toBe("");
      expect(body, selector).not.toMatch(/(?:linear|radial|conic|repeating-linear)-gradient\(/);
    }
  });

  /* 画布内禁视口单位：外层已有 scale，vw/vh 会二次缩放。 */
  it("never uses viewport units inside the fixed canvas", () => {
    for (const sheet of [RULES, DOSSIER, ROSTER, DOCUMENT]) {
      expect(sheet).not.toMatch(/[0-9.]+v(w|h|min|max)\b/);
    }
  });
});
