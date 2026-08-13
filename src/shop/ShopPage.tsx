import { useMemo, useState } from "react";
import {
  AbyssaProvider,
  CurrencyAmount,
  IconButton,
  Nameplate,
  RpgDialogue,
  RpgFrame,
  RpgHeader,
  RpgNotchedPillButton,
  RpgTab,
  VerticalIndicator
} from "../index";
import { resolveItemIcon as resolveCatalogItemIcon } from "../assets/svg/items/catalog";
import { ShopMetalCorner } from "./ShopMetalCorner";
import { Stage } from "../stage";

type Mode = "buy" | "sell" | "appraise";
type Currency = "lira" | "crystal";
type ItemRarity = "bronze" | "silver" | "gold" | "amethyst" | "mythic";
type ShopCategory = "all" | "equipment" | "supplies" | "materials" | "general" | "rarities";

type Item = {
  id: string;
  glyph: string;
  name: string;
  category: string;
  description: string;
  line: string;
  price?: number;
  currency?: Currency;
  stock?: number;
  unavailable?: boolean;
  verdict?: string;
  teaser?: string;
  bought?: string;
  sold?: string;
  recommend?: boolean;
};

const products: Record<Mode, Item[]> = {
  buy: [
    { id: "basalt", glyph: "餐", name: "深渊玄武岩餐具套装", category: "餐具 · 耐蚀", price: 2998, stock: 1, recommend: true, description: "采自海崖深处的玄武岩，经龙焰淬炼。无论多浓的混沌腐蚀都能从容承接，是魔王城餐桌的唯一指定供应品。", line: "不怕混沌腐蚀哦~ 看在勇者大人的份上，已经抹掉零头了呢~", bought: "餐具就要这个呢~ 魔王城的单子用的也是它哦~" },
    { id: "potion", glyph: "药", name: "陈旧的治疗药水", category: "消耗品", price: 250, stock: 12, description: "瓶底沉着可疑的细沙。效力尚存，味道微妙。标签上的生产日期已经被磨掉了。", line: "上个月……还是上上个月进的货呢~ 反正还能喝~", bought: "记得摇匀再喝哦~" },
    { id: "carving", glyph: "雕", name: "神秘木雕（有划痕）", category: "摆设 · 古董", price: 999, stock: 1, description: "造型介于龙与章鱼之间的木雕，侧面有一道醒目的划痕。缇比坚称那是「岁月的签名」。", line: "是划痕呢~ 但这是第一纪元的风格哦，大概~", bought: "眼光不错呢~ 大概真的是古董哦~" },
    { id: "rag", glyph: "布", name: "防腐蚀抹布", category: "消耗品", price: 80, stock: 30, description: "织入了辟邪银线的抹布，擦拭原生质污渍也不会溶化。家务魔法的好搭档。", line: "擦什么都行哦~ 擦龙角会生气的，不推荐~", bought: "家务加油呢~" },
    { id: "tail", glyph: "尾", name: "龙尾保养套装", category: "护理 · 龙族专供", price: 1200, stock: 3, description: "鳞面抛光油、角根滋养膏与黄金脉络提亮粉的豪华组合。人类使用没有任何效果。", line: "……这个不卖给你用。只是挂着好看呢~", bought: "诶~~ 买这个做什么？……多谢惠顾~" },
    { id: "key", glyph: "钥", name: "金库大钥匙（复制品）", category: "镇店之宝", price: 10000, stock: 1, description: "与缇比腰间那把一模一样的复制品，沉甸甸的黄铜质感。打不开任何门，但能打开话匣子。", line: "镇店之宝哦~ 买了也开不了任何门，但是很重，很值~", bought: "真的买了？！……啊，多谢惠顾~" },
    { id: "elixir", glyph: "秘", name: "无标签高阶灵药", category: "非卖品", unavailable: true, description: "没有标签的水晶瓶，里面盛着流转微光的药液。被她随手摆在货架最高处，像是不经意，又像是刻意。", line: "这个是定金呢~ 大客户活着比较重要~" },
    { id: "abyss-charm", glyph: "护", name: "深渊静心护符", category: "特制饰品 · 晶石兑换", price: 3, currency: "crystal", stock: 1, description: "以远古晶石稳定过的护符，能隔绝部分深渊低语，显著减缓高危异象造成的精神侵蚀。", line: "只有远古晶石能换哦~ 人类金库里可找不到这种东西。", bought: "收好呢~ 深海里听见谁叫你的名字，也不要回头哦。" },
    { id: "dragon-lamp", glyph: "灯", name: "古龙安眠灯", category: "高阶家具 · 晶石兑换", price: 5, currency: "crystal", stock: 1, description: "远古黄金龙工艺的静谧灯具，能稳定卧室中的魔力潮汐，大幅提高魔王的安睡阈值。", line: "为了让那位大人睡个好觉，五枚晶石很便宜吧~", bought: "世界今晚大概会安静一点呢~" },
    { id: "silver-stiletto", glyph: "刃", name: "镀银驱魔匕首", category: "武器 · 魔族特攻", price: 860, stock: 4, recommend: true, description: "薄刃覆有月银镀层，对低阶魔族与附身灵体格外有效。镀层会随战斗磨损，需要定期保养。", line: "不是神器，但遇见怕银的东西时，比神器省钱多了呢~", bought: "刃口别沾海水哦~ 镀层修起来很贵的。" },
    { id: "blackgold-shield", glyph: "盾", name: "黑金灵缚圆盾", category: "盾牌 · 灵族特攻", price: 1480, stock: 2, description: "黑金夹层中刻有束灵回路，能削弱灵体冲击，却会让持盾者的手臂微微发麻。", line: "专门挡灵族的呢~ 用来拍人也很结实。", bought: "要是开始听见盾牌说话，记得拿回来检查哦~" },
    { id: "tide-rune", glyph: "符", name: "潮汐屏障符文", category: "战斗符文 · 消耗品", price: 320, stock: 8, description: "撕开后生成一次短暂的潮汐护壁，可抵挡飞行物与少量深渊侵蚀。受潮后效力减半。", line: "一次性的哦~ 活下来就不算浪费。", bought: "别一次全撕了，上次有人这么做把自己弹进海里了呢~" },
    { id: "dawn-herbs", glyph: "叶", name: "晨露草药束", category: "炼金素材 · 草药", price: 95, stock: 16, description: "黎明前采集并用亚麻绳扎好的基础药草，可用于恢复药剂、解毒汤和味道古怪的沙拉。", line: "今天刚到的，很新鲜~ 至少绳子是新的。", bought: "阴凉处晾着，别让魔王当香草吃掉哦~" },
    { id: "deep-iron", glyph: "矿", name: "深海铁矿石", category: "锻造素材 · 矿石", price: 440, stock: 6, description: "从潮线以下的矿脉敲下，含有细微的深蓝结晶。适合修补抗腐蚀武器与护甲。", line: "很沉，所以运费也算在里面了呢~", bought: "打出来的装备会有一点海腥味，不影响强度哦~" },
    { id: "honey-bread", glyph: "食", name: "蜂蜜黄油面包", category: "食物 · 小队补给", price: 45, stock: 20, description: "表皮烤得酥脆，夹着蜂蜜与咸黄油。既能恢复体力，也适合拿去安抚情绪不佳的同伴。", line: "刚烤好的哦~ 这次真的不是库存品。", bought: "趁热吃呢~ 放久了就能当钝器了。" }
  ],
  sell: [
    { id: "statue", glyph: "像", name: "沾满污泥的古代雕像", category: "战利品", price: 20, stock: 1, description: "从海崖深处挖出的黑曜石雕像，蕾诺尔也看不出年份。缇比一眼就看穿了，但报价没变。", line: "第一纪元的黑曜石引流杯哦~ 没人用呀~", sold: "二十里拉，成交~ 泥巴我慢慢洗~" },
    { id: "sword", glyph: "剑", name: "断裂的秘银短剑", category: "武器残骸", price: 35, stock: 1, description: "断成两截的秘银剑，修复无望。剑柄上的宝石倒是完好。", line: "修不好的呢~ 熔掉也只值这点~" },
    { id: "scroll", glyph: "卷", name: "受潮的魔法卷轴", category: "杂物", price: 12, stock: 2, description: "被海水泡过的卷轴，字迹晕成了一片抽象画。", line: "字都花了呢~" },
    { id: "stone", glyph: "石", name: "魔王城特产的石头", category: "纪念品", price: 1, stock: 5, description: "在魔王城门口捡的黑色石头。除了黑，一无是处。", line: "……这个路边就有哦~" },
    { id: "food", glyph: "粮", name: "勇者的随身干粮", category: "口粮", unavailable: true, description: "艾洛拉烤的应急面包，硬得可以当武器。缇比闻了一下就推了回来。", line: "诶~~ 不要呢。" },
    { id: "cracked-ring", glyph: "戒", name: "裂纹星辉戒指", category: "稀有饰品 · 战利品", price: 260, stock: 1, description: "戒面宝石已经开裂，却仍会在星光下浮现细小的银色轨迹。修复价值可能高于回收价。", line: "裂得很有艺术感呢~ 我按碎宝石的价收。", sold: "成交~ 修好以后卖多少就不告诉你了哦。" },
    { id: "empty-vial", glyph: "瓶", name: "空的高阶药剂瓶", category: "补给残材 · 药剂", price: 18, stock: 3, description: "药液已经用尽，瓶壁仍残留少量魔力。洗净后可重复灌装普通药水。", line: "瓶子是真的水晶，药味就不值钱了呢~" },
    { id: "abyss-mushroom", glyph: "菌", name: "潮湿的深渊蘑菇", category: "炼金素材 · 菌类", price: 46, stock: 5, description: "菌盖在阴影中泛着紫光。可制作夜视药剂，也可能让整锅汤开始唱歌。", line: "完整的菌褶很值钱哦~ 这几朵只压扁了一点。" },
    { id: "faded-permit", glyph: "证", name: "褪色的商队通行证", category: "旧纸品 · 杂货", price: 9, stock: 1, description: "早已失效的边境商队通行证，上面盖着三个不存在国家的印章。", line: "不能通关，但可以垫摇晃的桌脚呢~" }
  ],
  appraise: [
    { id: "crystal", glyph: "晶", name: "发光的海底结晶", category: "未知矿石", price: 100, description: "在潮洞里捡到的蓝色结晶，入夜后会发出呼吸般的微光。", teaser: "呼唔……发光的呢。鉴定费一百里拉~", verdict: "鉴定结果：深海共鸣石。纯度上等，市价约八百里拉。", line: "深海的共鸣石哦~ 值八百里拉呢~ 现在卖给我也可以，反正你会回来的~" },
    { id: "watch", glyph: "表", name: "生锈的怀表", category: "旧物", price: 50, description: "外壳锈蚀的铜怀表，指针停在某一天的黄昏。", teaser: "旧怀表呢~ 五十里拉就帮你看~", verdict: "鉴定结果：上个纪元量产的普通怀表。情怀价五银币。", line: "普通怀表呢~ 上次纪元产的~" },
    { id: "scale", glyph: "鳞", name: "黑色龙鳞", category: "龙素材", price: 200, description: "巴掌大的黑色龙鳞，边缘透着暗金色的脉络。入手温热。", teaser: "……哦？这个嘛，两百里拉。先说好，不退哦~", verdict: "鉴定结果：黄金古龙的蜕鳞。……来源不予置评。", line: "……这个从哪里拿到的？不卖哦。我是说，本店不收呢~" },
    { id: "tablet", glyph: "拓", name: "无字的石碑拓片", category: "拓片", price: 80, description: "从古碑上拓下的纸片，对着光看只有模糊的凹痕。", teaser: "拓得真难看呢~ 八十里拉~", verdict: "鉴定结果：上面写的是『本店概不赊账』。……骗你的，是风化了的菜谱。", line: "写着『本店概不赊账』哦~ 骗你的~" },
    { id: "salt-stiletto", glyph: "匕", name: "盐封银匕首", category: "未知武器 · 匕首", price: 120, description: "被结晶海盐包裹的短匕首，刃身看不出锈蚀程度，护手处隐约有教团徽记。", teaser: "要把盐壳敲开才能看呢~ 一百二十里拉。", verdict: "鉴定结果：旧教团制式驱魔匕首。银刃完整，但祝福已经失效。", line: "还能用哦~ 重新祝福一下，价格能翻三倍呢。" },
    { id: "sealed-tonic", glyph: "剂", name: "蜡封战地药剂", category: "未知补给 · 药剂", price: 90, description: "厚蜡封住瓶口，瓶内液体呈暗红色。标签只剩下一个模糊的盾形标志。", teaser: "不打开也能看，不过闻不到味道要加钱……开玩笑的，九十。", verdict: "鉴定结果：北境军团强效止血剂。药效尚存，副作用是两小时内尝不出甜味。", line: "能救命呢~ 对爱吃甜食的人也算一种诅咒。" },
    { id: "chaos-spore", glyph: "核", name: "低语菌核", category: "未知素材 · 蘑菇", price: 140, description: "拳头大小的干燥菌核，靠近耳边时会发出类似潮声的细响。", teaser: "会说话的蘑菇不一定值钱哦~ 一百四十里拉先听听看。", verdict: "鉴定结果：混沌蕈母的休眠菌核。炼金价值很高，切开前最好先堵住耳朵。", line: "它说你应该卖给我呢~ 真是诚实的好蘑菇。" },
    { id: "prismatic-tear", glyph: "泪", name: "虹彩龙泪宝石", category: "未知珍宝 · 宝石", price: 300, description: "泪滴形宝石会随观察角度变换颜色，内部仿佛封存着一线移动的晨光。", teaser: "这个可不能随便下结论呢~ 三百里拉，很公道吧？", verdict: "鉴定结果：虹彩龙泪的人工仿制品。工艺近乎失传，本身仍是价值极高的古代珠宝。", line: "假的龙泪，真的古董~ 世界就是这么有趣呢。" }
  ]
};

const itemRarities: Record<string, ItemRarity> = {
  basalt: "gold",
  potion: "bronze",
  carving: "silver",
  rag: "bronze",
  tail: "gold",
  key: "mythic",
  elixir: "amethyst",
  "abyss-charm": "amethyst",
  "dragon-lamp": "mythic",
  "silver-stiletto": "silver",
  "blackgold-shield": "gold",
  "tide-rune": "silver",
  "dawn-herbs": "bronze",
  "deep-iron": "silver",
  "honey-bread": "bronze",
  statue: "silver",
  sword: "gold",
  scroll: "bronze",
  stone: "bronze",
  food: "bronze",
  "cracked-ring": "amethyst",
  "empty-vial": "bronze",
  "abyss-mushroom": "silver",
  "faded-permit": "bronze",
  crystal: "gold",
  watch: "bronze",
  scale: "mythic",
  tablet: "silver",
  "salt-stiletto": "silver",
  "sealed-tonic": "gold",
  "chaos-spore": "gold",
  "prismatic-tear": "mythic"
};

const shopCategories: Array<{ id: ShopCategory; label: string }> = [
  { id: "all", label: "全部" },
  { id: "equipment", label: "装备" },
  { id: "supplies", label: "补给" },
  { id: "materials", label: "素材" },
  { id: "general", label: "杂货" },
  { id: "rarities", label: "珍品" }
];

function resolveShopCategory(item: Item): Exclude<ShopCategory, "all"> {
  const searchable = `${item.name} ${item.category}`;
  const rarity = itemRarities[item.id] ?? "bronze";
  if (item.currency === "crystal" || item.unavailable || rarity === "amethyst" || rarity === "mythic") return "rarities";
  if (/武器|剑|匕首|刀|铠甲|盔甲|护甲|防具|盾|戒指|指环|项链|护符|饰品/.test(searchable)) return "equipment";
  if (/药水|药剂|绷带|食物|食品|干粮|口粮|面包|餐点|料理|符文|符石|卷轴/.test(searchable)) return "supplies";
  if (/素材|矿石|矿物|结晶|晶体|水晶|石头|鳞片|龙鳞|木材|木料|原木|草药|药草/.test(searchable)) return "materials";
  return "general";
}

function resolveItemIcon(item: Item) {
  const rarity = itemRarities[item.id] ?? "bronze";
  return resolveCatalogItemIcon({ name: item.name, category: item.category, quality: rarityRanks[rarity] }).assetUrl;
}

const rarityRanks: Record<ItemRarity, number> = { bronze: 1, silver: 2, gold: 3, amethyst: 4, mythic: 5 };

function ShopItemPreview({ item }: { item: Item }) {
  const rarity = itemRarities[item.id] ?? "bronze";
  const icon = resolveItemIcon(item);
  const iconMask = { WebkitMaskImage: `url("${icon}")`, maskImage: `url("${icon}")` };

  return <div className="abyssa-shop-detail__preview" data-rarity={rarity} role="img" aria-label={`${item.name}图标`}>
    <span data-layer="surface" />
    <span data-layer="halo-a" />
    <span data-layer="halo-b" />
    <i data-layer="glyph-depth" style={iconMask} />
    <i data-layer="glyph" style={iconMask} />
    <i data-layer="glyph-highlight" style={iconMask} />
    <span data-layer="rarity" aria-hidden="true">{Array.from({ length: rarityRanks[rarity] }, (_, index) => <i key={index} />)}</span>
  </div>;
}

const modeLabels: Record<Mode, string> = { buy: "购买", sell: "出售", appraise: "鉴定" };
const actionLabels: Record<Mode, string> = { buy: "购 买", sell: "出 售", appraise: "鉴 定" };
const greetings: Record<Mode, string> = { buy: "欢迎光临~ 守望者杂货铺，想要什么都可以问哦~", sell: "呼唔……有什么要出手的吗~ 价格好商量，大概~", appraise: "拿来看看吧~ 看不准也不退钱哦~" };
const defaults: Record<Mode, string> = { buy: "basalt", sell: "statue", appraise: "crystal" };
const stockDefaults = Object.fromEntries(Object.values(products).flat().map((item) => [item.id, item.stock ?? 1]));
const ITEMS_PER_PAGE = 8;

export function ShopPage() {
  const [mode, setMode] = useState<Mode>("buy");
  const [selected, setSelected] = useState(defaults);
  const [stock, setStock] = useState(stockDefaults);
  const [lira, setLira] = useState(1247);
  const [crystals, setCrystals] = useState(8);
  const [quantity, setQuantity] = useState(1);
  const [haggled, setHaggled] = useState<Set<string>>(() => new Set());
  const [appraised, setAppraised] = useState<Set<string>>(() => new Set());
  const [line, setLine] = useState(greetings.buy);
  const [pages, setPages] = useState<Record<Mode, number>>({ buy: 0, sell: 0, appraise: 0 });
  const [category, setCategory] = useState<ShopCategory>("all");

  const item = useMemo(() => products[mode].find((entry) => entry.id === selected[mode]) ?? products[mode][0], [mode, selected]);
  const key = `${mode}:${item.id}`;
  const currency = item.currency ?? "lira";
  const remaining = stock[item.id] ?? item.stock ?? 1;
  const reduced = currency === "lira" && haggled.has(key);
  const unit = Math.max(0, (item.price ?? 0) - (reduced && mode === "buy" ? 2 : 0));
  const unavailable = item.unavailable || remaining <= 0 || (mode === "appraise" && appraised.has(item.id));
  const description = mode === "appraise" && appraised.has(item.id) ? item.verdict ?? item.description : item.description;
  const filteredProducts = category === "all" ? products[mode] : products[mode].filter((entry) => resolveShopCategory(entry) === category);
  const pageCount = Math.max(1, Math.ceil(filteredProducts.length / ITEMS_PER_PAGE));
  const page = Math.min(pages[mode], pageCount - 1);
  const visibleProducts = filteredProducts.slice(page * ITEMS_PER_PAGE, (page + 1) * ITEMS_PER_PAGE);
  const categoryCounts = Object.fromEntries(shopCategories.map(({ id }) => [id, id === "all" ? products[mode].length : products[mode].filter((entry) => resolveShopCategory(entry) === id).length])) as Record<ShopCategory, number>;

  const selectMode = (next: Mode) => { setMode(next); setCategory("all"); setPages((current) => ({ ...current, [next]: 0 })); setQuantity(1); setLine(greetings[next]); };
  const selectItem = (id: string) => { const next = products[mode].find((entry) => entry.id === id); if (!next) return; setSelected((current) => ({ ...current, [mode]: id })); setQuantity(1); setLine(next.teaser ?? next.line); };
  const selectCategory = (next: ShopCategory) => {
    if (next === category || categoryCounts[next] === 0) return;
    const firstItem = next === "all" ? products[mode][0] : products[mode].find((entry) => resolveShopCategory(entry) === next);
    setCategory(next);
    setPages((current) => ({ ...current, [mode]: 0 }));
    if (firstItem) selectItem(firstItem.id);
  };
  const selectPage = (nextPage: number) => {
    const next = Math.max(0, Math.min(pageCount - 1, nextPage));
    if (next === page) return;
    setPages((current) => ({ ...current, [mode]: next }));
    const firstItem = filteredProducts[next * ITEMS_PER_PAGE];
    if (firstItem) selectItem(firstItem.id);
  };
  const haggle = () => { if (mode !== "buy" || currency !== "lira" || unavailable || reduced) return; setHaggled((current) => new Set(current).add(key)); setLine("呼唔……那便宜你两里拉吧~ 你赚大了呢~"); };

  function transact() {
    if (unavailable) { setLine(item.unavailable ? "诶~~ 这个不卖呢。再看看别的吧~" : "已经没有库存了哦~"); return; }
    const total = mode === "appraise" ? unit : unit * quantity;
    const balance = currency === "crystal" ? crystals : lira;
    if ((mode === "buy" || mode === "appraise") && balance < total) { setLine(currency === "crystal" ? "远古晶石不够呢~ 这种东西可不能拿里拉凑数哦。" : "小队资金不够呢~ 公款可不能拿来逛黑店哦。" ); return; }
    if (mode === "buy") { if (currency === "crystal") setCrystals((current) => current - total); else setLira((current) => current - total); setStock((current) => ({ ...current, [item.id]: remaining - quantity })); setLine(item.bought ?? "多谢惠顾~ 下次也要带够里拉来哦，勇者大人~"); }
    else if (mode === "sell") { setLira((current) => current + total); setStock((current) => ({ ...current, [item.id]: remaining - quantity })); setLine(item.sold ?? "成交~ 下次有什么好东西，也要先拿来给缇比看哦~"); }
    else { setLira((current) => current - total); setAppraised((current) => new Set(current).add(item.id)); setLine(item.line); }
    setQuantity(1);
  }

  const action = unavailable ? appraised.has(item.id) ? "已鉴定" : item.unavailable ? "非卖品" : "售罄" : actionLabels[mode];

  return <Stage background="var(--abyssa-shop-backdrop)">
    <AbyssaProvider className="abyssa-shop-screen" data-skin="black-gold">
    <header className="abyssa-shop-screen__header"><RpgHeader label="WARDEN SHOP" /></header>
    <div className="abyssa-shop-screen__shell">
      <span className="abyssa-shop-screen__shell-rails" aria-hidden="true">
        <i data-edge="top" />
        <i data-edge="right" />
        <i data-edge="bottom" />
        <i data-edge="left" />
      </span>
      <div className="abyssa-shop-screen__shell-brass">
        <div className="abyssa-shop-screen__shell-board">
          <span className="abyssa-shop-screen__shell-corners" aria-hidden="true">
            {(["tl", "tr", "br", "bl"] as const).map((corner) => <ShopMetalCorner key={corner} corner={corner} />)}
          </span>
          <div className="abyssa-shop-screen__layout">
      <section className="abyssa-shop-screen__main" aria-label="交易区">
        <nav className="abyssa-shop-categories" aria-label="商品分类">
          {shopCategories.map(({ id, label }) => <button type="button" className="abyssa-shop-categories__item" key={id} aria-label={`${label} ${categoryCounts[id]}`} aria-pressed={category === id} disabled={categoryCounts[id] === 0} onClick={() => selectCategory(id)}>
            <VerticalIndicator variant={category === id ? "teal" : "dark"} label={`${label}分类`} compact />
            <span className="abyssa-shop-categories__label" aria-hidden="true">
              {Array.from(label).map((character, index) => <i key={`${character}-${index}`}>{character}</i>)}
            </span>
            <small className="abyssa-shop-categories__count" aria-hidden="true">{categoryCounts[id]}</small>
          </button>)}
        </nav>
        <div className="abyssa-shop-screen__main-content">
        <div className="abyssa-shop-screen__tabs" role="tablist" aria-label="商店模式">
          {(Object.keys(modeLabels) as Mode[]).map((entry) => <RpgTab key={entry} label={modeLabels[entry]} role="tab" selected={mode === entry} aria-selected={mode === entry} variant={mode === entry ? "teal" : "dark"} onClick={() => selectMode(entry)} />)}
        </div>
        <RpgFrame padding="sm"><div className="abyssa-shop-list-panel">
          <div className="abyssa-shop-list" role="listbox" aria-label="商品列表">
            {visibleProducts.map((entry) => { const itemStock = stock[entry.id] ?? entry.stock ?? 1; const isSelected = entry.id === item.id; const isAppraised = mode === "appraise" && appraised.has(entry.id); const entryCurrency = entry.currency ?? "lira"; const rarity = itemRarities[entry.id] ?? "bronze"; const icon = resolveItemIcon(entry); const iconMask = { WebkitMaskImage: `url("${icon}")`, maskImage: `url("${icon}")` }; const entryReduced = mode === "buy" && entryCurrency === "lira" && haggled.has(`${mode}:${entry.id}`); const entryPrice = Math.max(0, (entry.price ?? 0) - (entryReduced ? 2 : 0)); return <button type="button" key={entry.id} className="abyssa-shop-item" role="option" data-selected={isSelected || undefined} data-currency={entryCurrency} data-rarity={rarity} data-unsellable={entry.unavailable || undefined} data-done={itemStock <= 0 || isAppraised || undefined} aria-selected={isSelected} onClick={() => selectItem(entry.id)}><span className="abyssa-shop-item__icon" data-rarity={rarity} aria-hidden="true"><i data-part="glyph-inset" /><i data-part="glyph" style={iconMask} /><i data-part="glyph-highlight" style={iconMask} /></span><span className="abyssa-shop-item__name">{entry.name}</span><span className="abyssa-shop-item__marker" data-empty={!entry.recommend || undefined} /><span className="abyssa-shop-item__leader" /><span className="abyssa-shop-item__price">{entry.unavailable ? mode === "sell" ? "拒收" : "非卖品" : itemStock <= 0 ? "售罄" : isAppraised ? "已鉴定" : <CurrencyAmount value={entryPrice} currency={entryCurrency} />}</span></button>; })}
          </div>
          {pageCount > 1 && <nav className="abyssa-shop-list__pagination" aria-label="商品分页"><button type="button" aria-label="上一页商品" disabled={page === 0} onClick={() => selectPage(page - 1)}>‹</button><span>{page + 1} / {pageCount}</span><button type="button" aria-label="下一页商品" disabled={page === pageCount - 1} onClick={() => selectPage(page + 1)}>›</button></nav>}
        </div></RpgFrame>
        <RpgFrame className="abyssa-shop-detail-frame" padding="md"><div className="abyssa-shop-detail">
          <ShopItemPreview item={item} />
          <div className="abyssa-shop-detail__info"><div className="abyssa-shop-detail__head"><h3>{item.name}</h3><span className="abyssa-shop-detail__category">{item.category}</span></div><p className="abyssa-shop-detail__desc">{description}</p><div className="abyssa-shop-detail__meta"><span>库存<b>{item.unavailable ? "—" : mode === "appraise" ? "∞" : remaining}</b></span><span>{mode === "appraise" ? "鉴定费" : mode === "sell" ? "回收价" : "单价"}<b data-currency={currency}>{item.unavailable ? "—" : reduced && item.price != null ? <><s><CurrencyAmount value={item.price} currency={currency} /></s><CurrencyAmount value={unit} currency={currency} /></> : <CurrencyAmount value={unit} currency={currency} />}</b></span></div><div className="abyssa-shop-detail__deal"><div className="abyssa-shop-qty" style={{ visibility: !item.unavailable && mode !== "appraise" ? "visible" : "hidden" }}><IconButton label="减少数量" icon="minus" size="sm" variant="dark" disabled={quantity <= 1 || unavailable} onClick={() => setQuantity((current) => Math.max(1, current - 1))} /><output className="abyssa-shop-qty__value">{quantity}</output><IconButton label="增加数量" icon="plus" size="sm" variant="teal" disabled={quantity >= Math.max(remaining, 1) || unavailable} onClick={() => setQuantity((current) => Math.min(Math.max(remaining, 1), current + 1))} /></div><div className="abyssa-shop-detail__subtotal">{item.unavailable ? "备注" : mode === "appraise" ? "鉴定费" : "小计"}<b data-currency={currency}>{item.unavailable ? mode === "sell" ? "拒收" : "非卖品" : <CurrencyAmount value={mode === "appraise" ? unit : unit * quantity} currency={currency} />}</b></div></div></div>
        </div></RpgFrame>
        <RpgFrame className="abyssa-shop-screen__goldbar" padding="sm">
          <div className="abyssa-shop-screen__purse">
            <span className="abyssa-shop-screen__purse-label">小队资金</span>
            <span className="abyssa-shop-screen__purse-balances">
              <span className="abyssa-shop-screen__purse-value"><CurrencyAmount value={lira} label={`小队里拉余额 ${lira}`} /></span>
              <span className="abyssa-shop-screen__purse-divider" aria-hidden="true" />
              <span className="abyssa-shop-screen__purse-value"><CurrencyAmount value={crystals} currency="crystal" label={`远古晶石余额 ${crystals}`} /></span>
            </span>
          </div>
          <div className="abyssa-shop-screen__actions">
            <RpgNotchedPillButton label="砍 价" variant="dark" hidden={mode === "appraise"} disabled={mode !== "buy" || currency !== "lira" || unavailable || reduced} onClick={haggle} />
            <RpgNotchedPillButton label={action} variant="teal" disabled={unavailable} onClick={transact} />
          </div>
        </RpgFrame>
        </div>
      </section>
      <aside className="abyssa-shop-screen__side" aria-label="店主缇比">
        <RpgFrame className="abyssa-shop-screen__portrait" padding="none">
          <div className="abyssa-shop-screen__portrait-background" aria-hidden="true" />
          <img src="https://files.catbox.moe/0d7uzq.png" alt="缇比·奥雷利亚 上半身立绘" />
          <div className="abyssa-shop-screen__portrait-shade" aria-hidden="true" />
        </RpgFrame>
        <Nameplate name="缇比·奥雷利亚" secondaryName="TIBBY AURELIA" />
        <RpgDialogue name="缇比" text={line} showNameplate={false} typing autoHeight aria-live="polite" />
      </aside>
          </div>
        </div>
      </div>
    </div>
    </AbyssaProvider>
  </Stage>;
}
