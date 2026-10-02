import type { CodexEntry } from "./CodexPanel";
import catalog from "../../assets/codex/observations/catalog.json";
import { codexArt } from "../../content/presentation/codex-art";
import { shopLootPresentation } from "../../content/presentation/shop-loot";

/** Art-review catalogue. These entries never write discovery/save state.
 * Identities: reef/old-manor presentation registries.
 * Loot sources: explicit named tables in demo-v21, excluding room-only curios. */
export const codexSamples: readonly CodexEntry[] = catalog.map((item, index) => {
  const isSlime = item.id === "enemy.slime.mire";
  const art = codexArt.get(item.id)!;
  return {
    id: item.id, number: String(index + 1).padStart(3, "0"),
    name: item.name, englishName: item.englishName, family: item.family,
    ...art,
    tags: [item.family, item.region],
    description: item.description,
    facts: [
      { label: "形态与特征", value: item.traits },
      { label: "出没区域", value: item.region },
      { label: "行动方式", value: item.behavior },
      { label: "图鉴分类", value: item.family },
    ],
    note: isSlime ? {
      text: "一团半透明的东西从石缝间挤出来，紧接着是第二团。软泥覆过拖痕，堵在了进洞的路上。",
      source: "洞口记录",
    } : {
      text: item.name + "的遭遇记录位于" + item.region + "。已记录的行动方式：" + item.behavior + "。",
      source: item.archived ? "旧版记录" : "遭遇记录",
    },
    drops: item.loot.map(key => {
      const id = "loot.salvage." + key, loot = shopLootPresentation[id];
      return { id, name: loot.name, icon: loot.iconUrl, description: loot.appearance };
    }),
  };
});
