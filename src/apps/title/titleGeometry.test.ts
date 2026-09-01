import { describe, expect, it } from "vitest";
import {
  TITLE_BLOCK_H,
  TITLE_BLOCK_PAD,
  TITLE_COMMAND_COLUMN_BOTTOM,
  TITLE_COMMAND_COLUMN_H,
  TITLE_COMMAND_COUNT,
  TITLE_COMMAND_GAP,
  TITLE_EMBLEM_CENTRE_Y,
  TITLE_EMBLEM_H,
  TITLE_CG_H,
  TITLE_CG_SUBJECT_CLEARANCE,
  TITLE_CG_TOP,
  TITLE_CG_W,
  TITLE_EMBLEM_EDGE_X,
  TITLE_FIELD_CENTRE_X,
  TITLE_FIELD_CENTRE_Y,
  TITLE_EMBLEM_W,
  TITLE_FOOTER_H,
  TITLE_RIBBON_H,
  TITLE_STACK_REGION_H
} from "./titleGeometry";

describe("title geometry", () => {
  it("keeps the whole stack inside the 900px canvas", () => {
    // 铁律 1:画布内不缩不改。装不下就是设计错误,不能靠 overflow 兜。
    expect(TITLE_BLOCK_H).toBeLessThanOrEqual(900);
    expect(TITLE_BLOCK_PAD).toBeGreaterThan(0);
  });

  it("derives the emblem height from the tight crop ratio", () => {
    expect(TITLE_EMBLEM_W / TITLE_EMBLEM_H).toBeCloseTo(800 / 656, 5);
  });

  it("derives the command column height from the ribbon aspect ratio", () => {
    // 若 RibbonButton 的 820/68 变了,这里要先失败,而不是让构图悄悄溢出。
    expect(TITLE_RIBBON_H).toBeCloseTo(43.122, 3);
    expect(TITLE_COMMAND_COLUMN_H).toBeCloseTo(
      TITLE_COMMAND_COUNT * TITLE_RIBBON_H + (TITLE_COMMAND_COUNT - 1) * TITLE_COMMAND_GAP,
      5
    );
  });

  it("centres the stack inside the region above the footer", () => {
    expect(TITLE_BLOCK_PAD * 2 + TITLE_BLOCK_H).toBeCloseTo(TITLE_STACK_REGION_H, 5);
  });

  it("keeps the command column clear of the footer band", () => {
    // 这条断言就是为上一版的 bug 立的:提示行曾压在第四个键上,重叠 36.93px。
    expect(TITLE_COMMAND_COLUMN_BOTTOM).toBeLessThan(TITLE_STACK_REGION_H);
    expect(TITLE_STACK_REGION_H - TITLE_COMMAND_COLUMN_BOTTOM).toBeGreaterThan(12);
  });

  it("reserves a footer band that fits both text rows", () => {
    // 提示 15px + 间隔 7 + 版本 12,行高 1.2 → 约 39.4,必须装得下。
    const needed = 15 * 1.2 + 7 + 12 * 1.2;
    expect(TITLE_FOOTER_H).toBeGreaterThan(needed);
  });

  it("centres the background field on the logo stamp", () => {
    // 法阵是 Logo 印章向外延伸的纹样,共同原点必须完全重合。
    expect(TITLE_FIELD_CENTRE_X).toBe(800);
    expect(TITLE_FIELD_CENTRE_Y).toBeCloseTo(TITLE_EMBLEM_CENTRE_Y, 5);
    expect(TITLE_EMBLEM_CENTRE_Y).toBeCloseTo(TITLE_BLOCK_PAD + TITLE_EMBLEM_H / 2, 5);

    // 它不应退回整张画布的中心；那会让法阵在 Logo 下方错开约 188px。
    expect(TITLE_FIELD_CENTRE_Y).toBeLessThan(450);
  });
});

describe("title CG geometry", () => {
  it("derives CG width from the 832x1216 source ratio", () => {
    expect(TITLE_CG_W / TITLE_CG_H).toBeCloseTo(832 / 1216, 5);
  });

  it("keeps the CG subject clear of the emblem", () => {
    // 实测两张 CG 主体都在正中,所以主体中线 = 宽度一半。
    // 余量为负就意味着人物被字标压住 —— 那时必须缩小 CG 或加宽遮罩。
    expect(TITLE_CG_SUBJECT_CLEARANCE).toBeGreaterThan(120);
  });

  it("keeps the CG subject well clear of the emblem", () => {
    // 主体(画面正中)必须离徽记边缘足够远。允许图片矩形本身略微越界 ——
    // 那部分由容器遮罩渐隐掉,主体不受影响。
    expect(TITLE_CG_SUBJECT_CLEARANCE).toBeGreaterThan(200);
  });

  it("leaves margin on every side so no hard edge can touch the canvas rim", () => {
    // 上下留白是「不露馅」的一部分:边贴着画布边缘时,遮罩没有渐隐的余地。
    expect(TITLE_CG_H).toBeLessThan(900);
    expect(TITLE_CG_TOP).toBeGreaterThan(0);
    expect(900 - TITLE_CG_TOP - TITLE_CG_H).toBeGreaterThan(0);
  });

  it("gives the CG a usable presence rather than a thumbnail", () => {
    // 「稍微大一些」:高度至少占画布的 85%,宽度至少占侧边空档的 100%。
    expect(TITLE_CG_H / 900).toBeGreaterThan(0.85);
    expect(TITLE_CG_W).toBeGreaterThanOrEqual(TITLE_EMBLEM_EDGE_X);
  });
});
