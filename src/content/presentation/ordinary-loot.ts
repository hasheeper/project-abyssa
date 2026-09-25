import type { ShopLootPresentation } from "./shop-loot";
import type { ItemRarity } from "../../shared/domain/item-rarity";
import gel from "../../assets/icons/4-1-goo-explosion.svg";
import iron from "../../assets/icons/items/metal-plate.svg";
import copper from "../../assets/icons/items/metal-bar.svg";
import cloth from "../../assets/icons/items/rolled-cloth.svg";
import wood from "../../assets/icons/items/wood-beam.svg";
import needle from "../../assets/icons/items/sewing-needle.svg";
import silverware from "../../assets/icons/items/fork-knife-spoon.svg";
import compass from "../../assets/icons/items/compass.svg";
import spring from "../../assets/icons/items/loot/spring.svg";
import clockwork from "../../assets/icons/items/loot/clockwork.svg";
import cog from "../../assets/icons/items/loot/cog.svg";
import clip from "../../assets/icons/items/loot/alligator-clip.svg";
import resonance from "../../assets/icons/items/loot/resonance.svg";
import placeholder from "../../assets/icons/items/locked-chest.svg";

function salvage(name: string, iconUrl: string, description: string, offer: string, rarity: ItemRarity = "bronze"): ShopLootPresentation {
  return {name, unknownName: name, iconUrl, appearance: description, description, category: "salvage", known: true, quantity: 1, rarity,
    discovery: `获得${name}。`, appraisal: [],
    teaser: {text: offer, emotion: "smile"}, offer: {text: offer, emotion: "confident"},
    sold: {text: "点好了，银钱收好。", emotion: "smile"}, kept: {text: "先收着吧，想卖再拿来。", emotion: "smile"}};
}
export const ordinaryLootPresentation: Record<string, ShopLootPresentation> = {
  "loot.salvage.mire-gel": salvage("浊泥凝胶", gel, "浑浊的胶块，夹着细沙。按份回收。", "一份一枚银币，别再往里掺泥哦。"),
  "loot.salvage.scrap-iron": salvage("废铁片", iron, "从损坏兵器上脱落的铁片，边缘已经卷起。", "八十个铜板，按废铁收。"),
  "loot.salvage.copper-parts": salvage("旧铜件", copper, "磨旧的小铜件，表面斑驳，铜料尚可回收。", "一枚银币，再添二十个铜板。"),
  "loot.salvage.old-linen": salvage("旧麻布", cloth, "褪色的粗麻布，裁去破损处还剩些能用的料。", "一枚银币。破口多的那块也算进去了。"),
  "loot.salvage.crossbow-spring": salvage("完整弩簧", spring, "弩机中留下的簧件，弯曲处尚且完整。", "两枚银币加六十个铜板，这枚簧还没断。", "silver"),
  "loot.salvage.blackwood": salvage("黑木残料", wood, "带着旧榫口的黑木料，断面仍然坚实。", "一枚银币，再加八十个铜板。", "bronze"),
  "loot.salvage.silverware": salvage("银餐具残片", silverware, "弯折的餐具残件，能回收的主要是其中银料。", "三枚银币，按银料收，可不是按一套餐具收。"),
  "loot.salvage.sewing-needle": salvage("裁缝铜针", needle, "略有弯曲的旧铜针，针眼尚完整。", "一枚银币加六十个铜板，针尖包好再递呀。"),
  "loot.salvage.clock-parts": salvage("失效钟件", clockwork, "停止运转的旧钟零件，连接处已经磨损。", "三枚银币，再添二十个铜板。", "bronze"),
  "loot.salvage.clock-wheel": salvage("完整钟轮", cog, "齿缘完整的钟轮，擦去积尘仍能看清细密轮齿。", "七枚银币加八十个铜板。完整的轮齿确实值些钱。", "silver"),
  "loot.curio.navigation-compass": {
    unknownName: "盐封的圆盒", name: "旧航海罗盘", iconUrl: compass, unknownIconUrl: placeholder,
    category: "curio", quantity: 1, rarity: "silver",
    appearance: "一只沉甸甸的圆盒，盒沿结着盐，里面有细微的晃动声。",
    description: "旧式航海罗盘。刻盘和指针仍完整，外壳需要清理。",
    discovery: "圆盒被盐封住了，带回去请缇比看看。",
    teaser: {text: "先别摇啦。三枚银币，我替你打开看看。", emotion: "confused"},
    appraisal: [
      {text: "旧航海罗盘。你听见的不是钱，是里面的指针在晃。", emotion: "confident"},
      {text: "刻盘还清楚，壳子洗洗就行。我给十枚银币。", emotion: "smile"},
    ],
    repeatAppraisal: [{text: "又是一只航海罗盘。这只刻盘也完整，还是十枚银币。", emotion: "confident"}],
    offer: {text: "没认过的，只按废料给两个铜板。先看清楚再卖吧。", emotion: "wry"},
    sold: {text: "十枚银币，收好。盒里的盐就留给我慢慢洗吧。", emotion: "smile"},
    kept: {text: "把盒盖扣好，别压弯了指针。", emotion: "smile"},
  },
  "loot.curio.napkin-clip": {
    unknownName: "磨旧的镂花夹片", name: "旧银餐巾夹", iconUrl: clip,
    category: "curio", quantity: 1, rarity: "silver",
    appearance: "两片镂花金属合在一起，中间有一道细缝，花纹已被磨平不少。",
    description: "夹住餐巾的小银夹。夹口有些松，银料和残留花纹仍有回收价值。",
    discovery: "夹片的用途不明，带回去请缇比看看。",
    teaser: {text: "夹子倒是夹子，做什么用的还得细看。三枚银币。", emotion: "confused"},
    appraisal: [
      {text: "银餐巾夹，用来夹餐巾的。用个饭也要弄这么精细。", emotion: "confident"},
      {text: "夹口松了，银料还好。我给八枚银币。", emotion: "wry"},
    ],
    repeatAppraisal: [{text: "又是餐巾夹。夹口还是这么松，八枚银币。", emotion: "smile"}],
    offer: {text: "还没认过，只能先按废料给两个铜板。", emotion: "wry"},
    sold: {text: "八枚银币，拿好。小东西可别漏在柜台上。", emotion: "smile"},
    kept: {text: "收好吧，小心夹在别的东西里找不着。", emotion: "smile"},
  },
  "loot.curio.clock-reed": {
    unknownName: "包蜡的小铜筒", name: "报时钟音簧", iconUrl: resonance,
    category: "curio", quantity: 1, rarity: "silver",
    appearance: "短铜筒外裹着一层旧蜡，端口塞得很紧，内里像藏着薄金属片。",
    description: "旧报时钟的备用音簧，收在防潮铜筒中。簧片没有锈穿。",
    discovery: "铜筒里装着不明零件，带回去请缇比看看。",
    teaser: {text: "蜡裹得挺严实呢。三枚银币，替你拆开认一认。", emotion: "confused"},
    appraisal: [
      {text: "报时钟的音簧。外面这层蜡是防潮的，倒把里面护住了。", emotion: "confident"},
      {text: "簧片没锈穿，比散零件值钱。我给十二枚银币。", emotion: "smile"},
    ],
    repeatAppraisal: [{text: "又一支报时钟音簧，保存得也好。十二枚银币。", emotion: "confident"}],
    offer: {text: "没拆开认过，只能按废料给两个铜板。", emotion: "wry"},
    sold: {text: "十二枚银币，点点看。铜筒也一起留下哦。", emotion: "smile"},
    kept: {text: "装回筒里收好，别把薄片折了。", emotion: "smile"},
  },
};
