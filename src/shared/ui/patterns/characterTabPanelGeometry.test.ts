import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  CHARACTER_PANEL_FRAME_CLEARANCE,
  CHARACTER_PANEL_H,
  CHARACTER_PANEL_INNER_H,
  CHARACTER_PANEL_INNER_W,
  CHARACTER_PANEL_TOP_CLEARANCE,
  CHARACTER_PANEL_W,
  CHARACTER_TAB_COUNT,
  CHARACTER_TAB_OVERLAP,
  RPG_FRAME_SM_INSET,
  characterTabPanelHeight,
  characterTabRowHeight
} from "./characterTabPanelGeometry";

describe("character tab panel geometry", () => {
  /* BUG 回归:切到骰装页时卡片被顶开 3.25px。
     页签行高随**数量**变 —— 单个页签受 max-width:104 限制,
     数量少了反而更宽、行更高、面板更矮:
       4 个 → 每个 96.50 → 面板 609.18
       3 个 → 每个 104.00 → 面板 605.93
     面板高度曾写死 609.18(4 页签的值),于是外溢 3.25px。
     概要页用 height:100% 跟着槽位走,所以只有写死高度的页会涨。 */
  it("derives the panel height from the actual tab count", () => {
    expect(characterTabRowHeight(4)).toBeCloseTo(41.82, 2);
    expect(characterTabRowHeight(3)).toBeCloseTo(45.07, 2);
    // 页签少反而更高 —— 这是 max-width 造成的反直觉之处。
    expect(characterTabRowHeight(3)).toBeGreaterThan(characterTabRowHeight(4));

    expect(characterTabPanelHeight(4)).toBeCloseTo(609.18, 2);
    expect(characterTabPanelHeight(3)).toBeCloseTo(605.93, 2);

    // 本应用是 3 个页签(概要/骰装/记事),必须用 3 的那个值。
    expect(CHARACTER_TAB_COUNT).toBe(3);
    expect(CHARACTER_PANEL_H).toBeCloseTo(
      characterTabPanelHeight(CHARACTER_TAB_COUNT),
      2
    );
    expect(CHARACTER_PANEL_H).not.toBeCloseTo(characterTabPanelHeight(4), 2);
  });

  it("derives the panel box from the character screen layout", () => {
    const screenWidth = 646 * (5 / 3) + 74;
    const shellInner = screenWidth - (36 * 2 + 1 * 2);
    const detailsWidth = shellInner - 340 - 18;

    expect(CHARACTER_PANEL_W).toBeCloseTo(detailsWidth, 1);
    expect(CHARACTER_PANEL_H).toBeCloseTo(
      646 - (characterTabRowHeight(CHARACTER_TAB_COUNT) - 5),
      1
    );
  });

  it("clears the frame ring and overlapping tab strip", () => {
    expect(CHARACTER_PANEL_FRAME_CLEARANCE).toBeGreaterThanOrEqual(5);
    expect(CHARACTER_PANEL_TOP_CLEARANCE).toBe(CHARACTER_TAB_OVERLAP + 5);
    expect(CHARACTER_PANEL_INNER_W).toBeCloseTo(
      CHARACTER_PANEL_W - CHARACTER_PANEL_FRAME_CLEARANCE * 2,
      2
    );
    expect(CHARACTER_PANEL_INNER_H).toBeCloseTo(
      CHARACTER_PANEL_H -
        CHARACTER_PANEL_TOP_CLEARANCE -
        CHARACTER_PANEL_FRAME_CLEARANCE,
      2
    );
  });

  /* RpgFrame padding="sm" 的内衬是那个 primitive 的属性,与具体页无关。
     两个页签页都要减掉它,所以放在共用层。 */
  it("exposes the shared RpgFrame sm inset", () => {
    expect(RPG_FRAME_SM_INSET).toBe((14 + 1) * 2);
  });

  /* 命名护栏:槽位量不许再挂 DICE_ 前缀。
     它们描述的是任何页签页所处的槽位,骰装只是第一个用到的页。
     直接读源码,而不是比对手写的字符串常量 —— 后者自证不了任何事。 */
  it("names slot metrics neutrally rather than after the dice page", () => {
    const source = readFileSync(
      resolve(import.meta.dirname, "./characterTabPanelGeometry.ts"),
      "utf8"
    );
    const exported = [...source.matchAll(/export (?:const|function) (\w+)/g)].map(
      (match) => match[1]!
    );

    expect(exported.length).toBeGreaterThan(10);
    expect(exported.filter((name) => name.startsWith("DICE_"))).toEqual([]);
    expect(exported).toContain("CHARACTER_PANEL_H");
    /* 共用层不许反向依赖骰装页。只查 import 语句 ——
       注释里提到那个文件名是正常的(要解释分界线在哪)。 */
    const imports = [...source.matchAll(/from "([^"]+)"/g)].map((m) => m[1]!);
    expect(imports).toEqual([]);
  });
});
