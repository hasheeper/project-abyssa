import oreIcon from "../../../assets/icons/items/ore.svg";
import herbsIcon from "../../../assets/icons/items/herbs-bundle.svg";
import pearlIcon from "../../../assets/icons/items/oyster-pearl.svg";
import clothIcon from "../../../assets/icons/items/rolled-cloth.svg";
import chaliceIcon from "../../../assets/icons/items/jeweled-chalice.svg";
import medalIcon from "../../../assets/icons/items/medal.svg";
import featherIcon from "../../../assets/icons/items/feather.svg";
import mirrorIcon from "../../../assets/icons/items/mirror-mirror.svg";
import waxIcon from "../../../assets/icons/items/wax-tablet.svg";
import bookIcon from "../../../assets/icons/items/black-book.svg";
import fangIcon from "../../../assets/icons/items/pretty-fangs.svg";
import dustIcon from "../../../assets/icons/items/pollen-dust.svg";
import scroll2Icon from "../../../assets/icons/items/tied-scroll.svg";
import keyIcon from "../../../assets/icons/items/skeleton-key.svg";
import boxIcon from "../../../assets/icons/items/locked-box.svg";
import runeIcon from "../../../assets/icons/items/rune-stone.svg";
import scrollIcon from "../../../assets/icons/items/scroll-unfurled.svg";
import ringIcon from "../../../assets/icons/items/crystal-earrings.svg";
import { supplyArt } from "../../../content/presentation/supply-icons";
import { bankLayer, collectDrop, createLootRun, enterNextLayer, type LootRun } from "./loot-model";
import type { LootItemView } from "../loot/loot-item";

/** Authored samples, not production drop tables or tutorial rewards. */
export const LOOT_ITEMS: Record<string, LootItemView> = {
  key: { id: "key", name: "锈蚀的银钥匙", kind: "common", rarity: "bronze", description: "齿口已经磨平，柄上还留着庄园的纹章。", icon: keyIcon },
  box: { id: "box", name: "封蜡小匣", kind: "appraisal", rarity: "unknown", description: "封口完好。轻轻晃动时，里面传来细碎的碰撞声。", icon: boxIcon },
  rune: { id: "rune", name: "刻纹石片", kind: "common", rarity: "silver", description: "从旧结界上剥落的石片，纹路中仍有微光。", icon: runeIcon },
  scroll: { id: "scroll", name: "褪色的宴会名册", kind: "common", rarity: "bronze", description: "墨迹模糊，几个人名被反复划掉。", icon: scrollIcon },
  ring: { id: "ring", name: "失去光泽的耳坠", kind: "appraisal", rarity: "unknown", description: "银托里嵌着一小块认不出成色的石头。", icon: ringIcon },
  ward: { id: "ward", name: "护符", kind: "preparation", rarity: "bronze", ...supplyArt.ward! },
  water: { id: "water", name: "圣水", kind: "preparation", rarity: "bronze", ...supplyArt["holy-water"]! },
  tools: { id: "tools", name: "保养工具", kind: "preparation", rarity: "bronze", ...supplyArt["maintenance-kit"]! },
  ore: { id: "ore", name: "灰纹矿石", kind: "common", rarity: "silver", description: "断面里夹着细细的暗色纹路。", icon: oreIcon },
  herbs: { id: "herbs", name: "干枯香草", kind: "common", rarity: "bronze", description: "用细绳扎着，仍留有苦涩的气味。", icon: herbsIcon },
  pearl: { id: "pearl", name: "浑浊珍珠", kind: "common", rarity: "silver", description: "表面的光泽已经黯淡。", icon: pearlIcon },
  cloth: { id: "cloth", name: "旧绒布", kind: "common", rarity: "bronze", description: "从覆桌布上裁下的一段。", icon: clothIcon },
  chalice: { id: "chalice", name: "缺口银杯", kind: "appraisal", rarity: "unknown", description: "杯沿缺了一角，底部刻着难辨的字。", icon: chaliceIcon },
  medal: { id: "medal", name: "家徽铜章", kind: "common", rarity: "silver", description: "纹章上残留着褪色的红漆。", icon: medalIcon },
  feather: { id: "feather", name: "黑羽", kind: "common", rarity: "bronze", description: "羽轴中夹着一根细红线。", icon: featherIcon },
  mirror: { id: "mirror", name: "斑驳手镜", kind: "appraisal", rarity: "unknown", description: "镜面映不清轮廓，银柄仍然冰凉。", icon: mirrorIcon },
  wax: { id: "wax", name: "封蜡残片", kind: "common", rarity: "bronze", description: "压印的纹样像是一朵闭合的花。", icon: waxIcon },
  book: { id: "book", name: "无名账册", kind: "common", rarity: "bronze", description: "账页被撕走大半，只剩几笔墨迹。", icon: bookIcon },
  fang: { id: "fang", name: "异兽獠牙", kind: "common", rarity: "gold", description: "根部有陈旧的束缚痕迹。", icon: fangIcon },
  dust: { id: "dust", name: "微光粉末", kind: "common", rarity: "amethyst", description: "封在纸包里，偶尔闪过细小的亮点。", icon: dustIcon },
  scroll2: { id: "scroll2", name: "密封信卷", kind: "appraisal", rarity: "unknown", description: "封签还在，纸张却已经发脆。", icon: scroll2Icon },
  contract: { id: "contract", name: "远古契约残页", kind: "common", rarity: "mythic", description: "撕裂的纸页上，契文仍在缓慢显现。", icon: scrollIcon },
};
export const LOOT_PREVIEW_ITEM_COUNT = Object.keys(LOOT_ITEMS).length;

export function sampleRun(scenario: "fresh" | "mixed" | "overflow" = "mixed"): LootRun {
  let run = createLootRun();
  if (scenario === "fresh") return run;
  run = collectDrop(run, { id: "sample:1", source: "首层搜获 · 2,600 G · 6 件道具", rewards: { copper: 2600, items: [{ itemId: "key", quantity: 2 }, { itemId: "rune", quantity: 3 }, { itemId: "ward", quantity: 1 }] } });
  run = enterNextLayer(bankLayer(run));
  run = collectDrop(run, { id: "sample:2", source: "回廊搜获 · 1,800 G · 4 件道具", rewards: { copper: 1800, items: [{ itemId: "box", quantity: 1 }, { itemId: "water", quantity: 1 }, { itemId: "rune", quantity: 2 }] } });
  if (scenario === "overflow") {
    const items = Object.keys(LOOT_ITEMS).map((itemId, index) => ({ itemId, quantity: 1 + index % 7 }));
    run = collectDrop(run, { id: "sample:overflow", source: "沿途搜获 · 86,400 G · 一批道具", rewards: { copper: 86400, items } });
    run = enterNextLayer(bankLayer(run));
    run = collectDrop(run, { id: "sample:overflow:2", source: "暗柜搜获 · 13,800 G · 一批道具", rewards: { copper: 13800, items } });
  }
  return run;
}
