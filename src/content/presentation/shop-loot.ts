import ring from "../../assets/icons/loot/ship-lamp-ring.svg";
import coins from "../../assets/icons/items/two-coins.svg";
import nail from "../../assets/icons/items/hammer-nails.svg";
import token from "../../assets/icons/items/wooden-sign.svg";
import bread from "../../assets/icons/items/bread.svg";
import type { ShopDialogueLine } from "./shop-dialogue";
import type { ItemRarity } from "../../shared/domain/item-rarity";
import shell from "../../assets/icons/items/nautilus-shell.svg";
import crabShell from "../../assets/icons/items/turtle-shell.svg";
import { ordinaryLootPresentation } from "./ordinary-loot";

export type ShopLootPresentation = {
  unknownName: string; name: string; iconUrl: string; appearance: string; description: string;
  discovery: string; teaser: ShopDialogueLine; appraisal: ShopDialogueLine[]; sold: ShopDialogueLine; kept: ShopDialogueLine;
  unknownIconUrl?: string; repeatAppraisal?: ShopDialogueLine[]; artStatus?: "placeholder";
  category?: "currency" | "curio" | "salvage"; quantity?: number; known?: boolean;
  rarity?: ItemRarity;
  offer?: ShopDialogueLine; refusal?: ShopDialogueLine;
};
export const shopLootPresentation: Record<string, ShopLootPresentation> = {
  ...ordinaryLootPresentation,
  "loot.salvage.shell": {
    unknownName: "螺壳", name: "螺壳", iconUrl: shell, category: "salvage", quantity: 1, known: true, rarity: "bronze",
    appearance: "从泥沙中拣出的空螺壳，壳口有些磨损。", description: "洗净后可作小饰件的螺壳，按件回收。",
    discovery: "泥沙间露出一只空螺壳。", appraisal: [],
    teaser: {text: "空壳子，洗干净倒还能用呢。", emotion: "smile"},
    offer: {text: "一只八十个铜板，泥沙可不算份量哦。", emotion: "wry"},
    sold: {text: "收下啦。壳子归我，银钱收好。", emotion: "joy"},
    kept: {text: "想留着就收好，别和午饭装一袋呢。", emotion: "smile"},
  },
  "loot.salvage.crab-shell": {
    unknownName: "礁蟹硬壳", name: "礁蟹硬壳", iconUrl: crabShell, category: "salvage", quantity: 1, known: true, rarity: "bronze",
    appearance: "厚实的蟹壳，壳缝沾着盐霜和滩泥。", description: "尚能加工的硬壳材料，按件回收。",
    discovery: "拣起一块尚且完整的硬壳。", appraisal: [],
    teaser: {text: "这壳够厚，料还不错。", emotion: "confident"},
    offer: {text: "两枚银币，再添六十个铜板。别把藤壶也算成一件哦。", emotion: "wry"},
    sold: {text: "钱在这儿。壳我收下，泥可得慢慢洗呢。", emotion: "smile"},
    kept: {text: "收着吧，壳边硌手，包好一点。", emotion: "smile"},
  },
  "loot.salvage.ship-lamp-ring": {
    unknownName: "结着盐壳的铜环", name: "旧船灯的平衡环", iconUrl: ring, category: "curio", quantity: 1, rarity: "bronze",
    appearance: "几只铜环套在一起，接缝结着厚厚的盐壳，底下只剩半截支架。",
    description: "旧式船灯的活动环架。灯盏已经遗失，铜环尚可拆用，也能当旧铜回收。",
    discovery: "看不出原本装着什么，带回去请缇比看看。",
    teaser: {text: "盐把接缝糊住了呢。三枚银币，替你认一认？", emotion: "confused"},
    appraisal: [
      {text: "旧船灯的平衡环。外圈跟着船晃，里头的灯盏还能端平呢～", emotion: "confident"},
      {text: "你拿回来的只有架子。灯盏没了，倒不用担心洒油啦。", emotion: "wry"},
      {text: "铜还不错，我给六枚银币。盐壳可不算重量哦～", emotion: "smile"},
    ],
    repeatAppraisal: [{text: "又是船灯的平衡环。这副也只有架子，还是六枚银币。", emotion: "confident"}],
    offer: {text: "还没认过的，只按废料给两个铜板。要不要先看看？", emotion: "wry"},
    sold: {text: "收好啦～洗掉盐，再挂个灯盏，就是另一笔价钱了呢。", emotion: "joy"},
    kept: {text: "收着吧。下回捡到灯盏，可别再花钱鉴定一次呢。", emotion: "wry"},
  },
  "loot.tutorial.cross-coins": {
    unknownName: "旧十字币", name: "旧十字币", iconUrl: coins, category: "currency", quantity: 12, known: true,
    appearance: "十二枚旧教廷十字币，边缘磨损，十字纹仍清楚。",
    description: "十二枚一批回收。随附的烛火钱木牌另按废料计入；已单独卖掉木牌则不重复计价。",
    discovery: "钱袋里有十二枚旧币。回馆后可以找缇比回收。",
    teaser: {text: "旧十字币啊，纹路还挺清楚呢。", emotion: "smile"}, appraisal: [],
    offer: {text: "十二枚，我给十八枚银币。木牌也带来了？那再添两个铜板，算废料哦～", emotion: "confident"},
    sold: {text: "十八枚银币，收好。旧币上的十字嘛……熔完就看不见啦。", emotion: "joy"},
    kept: {text: "整袋留着也行。不过拿去集市买面包，人家可未必肯收呢。", emotion: "wry"},
  },
  "loot.tutorial.barrier-nail": {
    unknownName: "发黑的金属钉", name: "黯秘银结界钉", iconUrl: nail, category: "curio",
    appearance: "一根沉甸甸的短钉，表面发黑，钉身刻着几道细纹。擦去泥沙也不见金属光泽。",
    description: "用于固定结界的黯秘银钉。旧纹路已磨损，银料仍可回收，估价五枚银币。",
    discovery: "钱袋底下还压着一根奇怪的短钉。带回去，请缇比认认。",
    teaser: {text: "别急着当废铁卖呀。钉子不稀奇，做钉子的料可不一定呢～", emotion: "confused"},
    appraisal: [
      {text: "黯秘银结界钉。看这几道纹，是用来把结界钉稳的，可不是钉门板哦。", emotion: "confident"},
      {text: "纹路磨得差不多了，重做结界不划算。银料还好，熔一熔能用。", emotion: "confused"},
      {text: "这根我给五枚银币。要卖就放下，要留就收好，别拿它去修马车啦～", emotion: "wry"},
    ],
    offer: {text: "还没认过的，我只能按废料给两个铜板。先鉴定一下，说不定值钱呢？", emotion: "wry"},
    sold: {text: "收到啦。钉子归我，银钱归你，谁也不吃亏呢～", emotion: "joy"},
    kept: {text: "收好吧。这回认过了，下次再拿来，我可不会装不认识呢。", emotion: "smile"},
  },
  "loot.tutorial.candle-token": {
    unknownName: "烛火钱木牌", name: "烛火钱木牌", iconUrl: token, category: "salvage", known: true,
    appearance: "一块旧木牌，烙着烛火图案，挂绳已经断了。",
    description: "磨损的旧木牌。可单独按废料回收，也会随同一袋旧十字币一并成交。",
    discovery: "旧币之间夹着一块烛火纹木牌。",
    teaser: {text: "木头呢～", emotion: "wry"}, appraisal: [],
    offer: {text: "这个算废料，两个铜板。别看我，看它，它真的是木头呢。", emotion: "wry"},
    sold: {text: "两个铜板，拿好。木牌我就收下啦～", emotion: "smile"},
    kept: {text: "留着也行，当个书签还挺合适呢。", emotion: "smile"},
  },
  "loot.tutorial.black-bread": {
    unknownName: "干黑面包", name: "干黑面包", iconUrl: bread, category: "salvage", known: true,
    appearance: "干得发硬的黑面包，隔着布袋都能摸到坚硬的棱角。",
    description: "一块已经干硬的黑面包。缇比拒收，不能作为出征食物使用。",
    discovery: "袋角还有一块干硬的黑面包。",
    teaser: {text: "这个就不用往柜台上放啦。", emotion: "confused"}, appraisal: [],
    refusal: {text: "不收。领主大人，我开的是杂货铺，不是替你清饭盒的地方呢～", emotion: "wry"},
    sold: {text: "这个不收哦。", emotion: "confused"},
    kept: {text: "收好吧，可别拿来冒充我的货呀。", emotion: "wry"},
  },
  "loot.tutorial.curio": {
    unknownName: "结着盐壳的铜环", name: "旧船灯的平衡环", iconUrl: ring,
    appearance: "几只大小不一的铜环套在一起，接缝结着厚厚的盐壳。底下残留半截支架，看不出原本装着什么。",
    description: "旧式船灯的活动环架，让灯盏在船身摇晃时保持平稳。灯盏已经遗失，铜环尚可拆用，也能当旧铜回收。",
    discovery: "看不出原本装着什么。带回去，请缇比鉴定。",
    teaser: {text: "呼唔……盐把接缝糊住了呢。先替你看看？", emotion: "confused"},
    appraisal: [
      {text: "旧船灯的平衡环。外圈跟着船晃，里头的灯盏还能端平呢～", emotion: "confident"},
      {text: "你拿回来的只有架子。灯盏没了，倒不用担心洒油啦。", emotion: "wry"},
      {text: "铜还不错。我按旧铜收，盐壳不算重量哦～", emotion: "smile"},
    ],
    sold: {text: "收好啦～等我把盐洗掉，再挂个灯盏……那就是另一笔价钱了呢。", emotion: "joy"},
    kept: {text: "收着吧～下回捡到灯盏，可别再花钱鉴定一次呢。", emotion: "wry"},
  },
};
