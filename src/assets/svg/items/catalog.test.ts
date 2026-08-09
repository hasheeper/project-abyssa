import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import manifest from "./manifest.json";
import selection from "./selection.json";
import { itemIconCatalog, resolveItemIcon } from "./catalog";

describe("curated RPG item icon catalog", () => {
  it("contains exactly 316 unique, attributed and verified entries", () => {
    expect(itemIconCatalog).toHaveLength(316);
    expect(new Set(itemIconCatalog.map((entry) => entry.id)).size).toBe(316);
    expect(new Set(itemIconCatalog.map((entry) => entry.source)).size).toBe(316);
    expect(itemIconCatalog.every((entry) => entry.review === "verified")).toBe(true);
    expect(itemIconCatalog.every((entry) => entry.author && entry.license && entry.sourceUrl && entry.pageUrl)).toBe(true);
    expect(manifest.icons.every((entry) => entry.metadataStatus === "verified")).toBe(true);
    const manifestById = new Map(manifest.icons.map((entry) => [entry.id, entry]));
    expect(itemIconCatalog.every((entry) => manifestById.get(entry.id)?.author === entry.author)).toBe(true);

    const attribution = readFileSync(resolve(process.cwd(), "src/assets/svg/items/ATTRIBUTION.md"), "utf8");
    for (const author of new Set(itemIconCatalog.map((entry) => entry.author))) expect(attribution).toContain(author);
  });

  it("keeps generated SVGs transparent, local and hash-verified", () => {
    expect(manifest.sourceCommit).toBe("82d948812bfe3f269ef8f731dcdb07b08160edc4");
    expect(manifest.icons).toHaveLength(selection.length);
    for (const entry of manifest.icons) {
      const svg = readFileSync(resolve(process.cwd(), `src/assets/svg/items/game-icons/${entry.id}.svg`), "utf8");
      expect(svg).toContain('viewBox="0 0 512 512"');
      expect(svg).not.toMatch(/d="M0 0h512v512H0z"/i);
      expect(svg).not.toMatch(/<(?:script|image|foreignObject|use)\b/i);
      expect(svg).not.toMatch(/\b(?:href|xlink:href)\s*=/i);
      expect(createHash("sha256").update(svg).digest("hex")).toBe(entry.sha256);
    }
  });

  it.each([
    ["强效治疗药水", "health-potion"],
    ["断裂的秘银短剑", "shattered-sword"],
    ["北境鱼罐头", "canned-fish"],
    ["古龙安眠灯", "bed-lamp"],
    ["深渊静心护符", "gem-pendant"],
    ["黑色龙鳞", "fish-scales"],
    ["魔王城特产的石头", "stone-pile"],
    ["完全无法识别的东西", "swap-bag"]
  ])("matches %s to %s", (name, expectedId) => {
    expect(resolveItemIcon(name).entry.id).toBe(expectedId);
  });

  it("lets item state override a normal category match", () => {
    const match = resolveItemIcon("断裂的秘银短剑 武器残骸");
    expect(match.entry.id).toBe("shattered-sword");
    expect(match.matchKind).toBe("state");
    expect(match.detectedStates).toContain("broken");
  });

  it("treats a trailing head noun as more important than a leading modifier", () => {
    const match = resolveItemIcon({ name: "蜂蜜黄油面包", category: "食物 · 小队补给", quality: 1 });
    expect(match.entry.id).toBe("sliced-bread");
    expect(match.matchedKeyword).toBe("面包");
    expect(match.matchedField).toBe("name");
  });

  it("keeps genie lamps separate from bedroom lamps", () => {
    expect(resolveItemIcon({ name: "古龙安眠灯", category: "高阶家具", quality: 5 }).entry.id).toBe("bed-lamp");
    expect(resolveItemIcon({ name: "封印的阿拉丁神灯", category: "珍品", quality: 5 }).entry.id).toBe("magic-lamp");
  });

  it("uses quality only to choose between semantically equivalent icons", () => {
    expect(resolveItemIcon({ name: "普通面包", category: "食物", quality: 1 }).entry.id).toBe("sliced-bread");
    expect(resolveItemIcon({ name: "王室面包", category: "食物", quality: 4 }).entry.id).toBe("bread");
    expect(resolveItemIcon({ name: "普通药水", category: "补给", quality: 1 }).entry.id).toBe("round-potion");
    expect(resolveItemIcon({ name: "高阶药水", category: "补给", quality: 4 }).entry.id).toBe("standing-potion");
  });

  it("selects low and high quality variants within the mushroom family", () => {
    const low = resolveItemIcon({ name: "潮湿的深渊蘑菇", category: "炼金素材 · 菌类", quality: 1 });
    const high = resolveItemIcon({ name: "深渊月辉蘑菇", category: "珍稀炼金素材 · 菌类", quality: 4 });
    const explicit = resolveItemIcon({ name: "普通菌褶蘑菇", category: "食物", quality: 1 });

    expect(low.entry.id).toBe("mushrooms");
    expect(high.entry.id).toBe("mushroom-gills");
    expect(low.entry.variantGroup).toBe("mushroom");
    expect(high.entry.variantGroup).toBe("mushroom");
    expect(explicit.entry.id).toBe("mushroom-gills");
  });

  it.each([
    [{ name: "深渊玄武岩餐具套装", category: "餐具 · 耐蚀", quality: 3 }, "fork-knife-spoon"],
    [{ name: "神秘木雕（有划痕）", category: "摆设 · 古董", quality: 2 }, "totem"],
    [{ name: "防腐蚀抹布", category: "消耗品", quality: 1 }, "rolled-cloth"],
    [{ name: "沾满污泥的古代雕像", category: "战利品", quality: 2 }, "totem"],
    [{ name: "褪色的商队通行证", category: "旧纸品 · 杂货", quality: 1 }, "ticket"],
    [{ name: "深海铁矿石", category: "锻造素材 · 矿石", quality: 2 }, "ore"],
    [{ name: "裂纹星辉戒指", category: "稀有饰品", quality: 4 }, "diamond-ring"],
    [{ name: "空的高阶药剂瓶", category: "补给残材", quality: 1 }, "square-bottle"],
    [{ name: "低语菌核", category: "未知素材 · 蘑菇", quality: 3 }, "mushroom-gills"],
    [{ name: "黄铜提灯", category: "工具", quality: 2 }, "lantern"],
    [{ name: "封印的法术卷轴", category: "补给", quality: 2 }, "tied-scroll"],
    [{ name: "普通法术卷轴", category: "补给", quality: 1 }, "scroll-unfurled"]
  ])("audits known shop-like item $name", (query, expectedId) => {
    expect(resolveItemIcon(query).entry.id).toBe(expectedId);
  });

  it("keeps explicit shape semantics ahead of quality variants", () => {
    expect(resolveItemIcon({ name: "黑金灵缚圆盾", category: "盾牌", quality: 3 }).entry.id).toBe("round-shield");
    expect(resolveItemIcon({ name: "普通长剑", category: "武器", quality: 1 }).entry.id).toBe("broadsword");
    expect(resolveItemIcon({ name: "神话长剑", category: "武器", quality: 5 }).entry.id).toBe("broadsword");
    expect(resolveItemIcon({ name: "神话之剑", category: "武器", quality: 5 }).entry.id).toBe("relic-blade");
  });

  it.each([
    ["剑油", "swap-bag"],
    ["木剑柄", "swap-bag"],
    ["床单", "swap-bag"],
    ["灯油", "swap-bag"],
    ["护牙粉", "swap-bag"],
    ["蛋白粉", "swap-bag"],
    ["弩箭盒", "swap-bag"]
  ])("does not treat an embedded root in %s as the item itself", (name, expectedId) => {
    expect(resolveItemIcon(name).entry.id).toBe(expectedId);
  });

  it("keeps explicit compound nouns and visual roles intact", () => {
    expect(resolveItemIcon({ name: "神话之剑", quality: 5 }).entry.id).toBe("relic-blade");
    expect(resolveItemIcon({ name: "普通之剑", quality: 2 }).entry.id).toBe("broadsword");
    expect(resolveItemIcon("古代剑").entry.id).toBe("ancient-sword");
    expect(resolveItemIcon("精制肩挎包").entry.id).toBe("shoulder-bag");
    expect(resolveItemIcon("深渊玄武岩餐具套装").entry.id).toBe("fork-knife-spoon");
  });

  it("covers the expanded core RPG inventory without modifier capture", () => {
    expect(resolveItemIcon({ name: "普通法杖", quality: 2 }).entry.id).toBe("wizard-staff");
    expect(resolveItemIcon({ name: "王室法杖", quality: 4 }).entry.id).toBe("crescent-staff");
    expect(resolveItemIcon({ name: "学徒魔杖", quality: 2 }).entry.id).toBe("fairy-wand");
    expect(resolveItemIcon({ name: "神话魔杖", quality: 5 }).entry.id).toBe("lunar-wand");
    expect(resolveItemIcon({ name: "普通箭矢", quality: 1 }).entry.id).toBe("bow-arrow");
    expect(resolveItemIcon("破损的猎手箭矢").entry.id).toBe("frayed-arrow");
    expect(resolveItemIcon({ name: "普通药片", quality: 1 }).entry.id).toBe("medicine-pills");
    expect(resolveItemIcon({ name: "高阶药片", quality: 3 }).entry.id).toBe("medicines");
    expect(resolveItemIcon("秘银戒指盒").entry.id).toBe("ring-box");
    expect(resolveItemIcon("断裂的古代石板").entry.id).toBe("broken-tablet");
  });

  it("keeps newly added ingredient modifiers behind the final item noun", () => {
    expect(resolveItemIcon({ name: "蜂蜜黄油面包", quality: 1 }).entry.id).toBe("sliced-bread");
    expect(resolveItemIcon({ name: "草莓恢复药水", quality: 1 }).entry.id).toBe("health-potion");
    expect(resolveItemIcon({ name: "牛奶面包", quality: 1 }).entry.id).toBe("sliced-bread");
  });

  it("keeps UI, skill and building graphics out of the item catalog", () => {
    const ids = new Set(itemIconCatalog.map((entry) => entry.id));
    for (const id of ["crossed-swords", "crossed-axes", "axe-sword", "slashed-shield", "magic-shield", "healing-shield", "round-table", "contract", "wooden-door", "window", "desk", "crystal-shrine"]) {
      expect(ids.has(id)).toBe(false);
    }
  });
});
