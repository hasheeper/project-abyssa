import type { CharacterChronicle } from "../domain/characters/chronicle";

/* shared 侧组件测试的夹具。
   shared 不许 import content（scripts/check-module-boundaries.mjs:72），
   所以 DiceLoadoutPanel 那边也是这么做的（shared/testing/diceLoadouts.ts）。

   夹具刻意覆盖全部视觉形态：章节分隔、四种节点、三档色调、
   四种筛选分类、徽标、兼容态旧值、引语。 */

export const chronicleFixture: CharacterChronicle = {
  characterId: "fixture",
  blocks: [
    { kind: "chapter", id: "c1", title: "样例前篇", stamp: "卷一" },
    {
      kind: "entry",
      id: "e1",
      stamp: "DAY 01",
      title: "一般记事",
      body: "普通条目，用小实心圆。",
      categories: ["daily"],
      marker: "node"
    },
    {
      kind: "entry",
      id: "e2",
      stamp: "DAY 02",
      title: "里程碑记事",
      badge: "羁绊 Lv.2",
      body: "实心菱形 + 阵营色。",
      voice: "「一句引语。」",
      categories: ["bond"],
      marker: "milestone",
      tone: "accent"
    },
    { kind: "chapter", id: "c2", title: "样例后篇", stamp: "卷二" },
    {
      kind: "entry",
      id: "e3",
      stamp: "DAY 03",
      title: "阶段变更",
      badge: "私约 II",
      struck: "旧：被取代的条款",
      body: "新：空心菱形。",
      categories: ["pact"],
      marker: "hollow",
      tone: "accent"
    },
    {
      kind: "entry",
      id: "e4",
      stamp: "DAY 04",
      title: "警示记事",
      badge: "休养 3 天",
      body: "虚线圆 + danger 令牌。",
      categories: ["battle"],
      marker: "alert",
      tone: "alert"
    }
  ]
};

export const chroniclePlaceholderFixture: CharacterChronicle = {
  characterId: "fixture-empty",
  blocks: [],
  placeholderNote: "这一页还空着"
};

/** 最小条目：只有 id + title。用来证明所有插槽都是可选的。 */
export const chronicleMinimalFixture: CharacterChronicle = {
  characterId: "fixture-minimal",
  blocks: [{ kind: "entry", id: "only", title: "仅有标题" }]
};
