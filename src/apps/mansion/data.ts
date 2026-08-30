import type { MansionRegionKind } from "../../shared/domain/mansion/regions";

export const MANSION_WORLD_WIDTH = 5162;
export const MANSION_WORLD_HEIGHT = 1910;

export type MansionPhaseId = "dawn" | "day" | "dusk" | "night";
export type MansionFund = "public" | "party";
export type MansionProductionIcon = "meal" | "maintenance" | "supplies" | "records" | "herbs";

export interface MansionPhase {
  id: MansionPhaseId;
  label: string;
  caption: string;
}

/**
 * “相位”是产品时间切片，不是世界观中的法则名词。
 * 文案只描述生活节律，不给它附会大天平或源力机制。
 */
export const MANSION_PHASES: MansionPhase[] = [
  { id: "dawn", label: "晨", caption: "炊烟升起，领地开始苏醒" },
  { id: "day", label: "昼", caption: "主宅集合，驻在与事务最密集" },
  { id: "dusk", label: "昏", caption: "晚餐与篝火前后的归家时刻" },
  { id: "night", label: "夜", caption: "小队回到村舍，行宫转入静夜" }
];

export interface MansionProduction {
  label: string;
  amount: number;
  unit: string;
  icon: MansionProductionIcon;
}

export interface MansionRoomDetail {
  subtitle: string;
  occupant: string;
  description: string;
  trace: string;
  level: number;
  fund?: MansionFund;
  upgradeCost?: number;
  production?: MansionProduction;
  href?: string;
  actionLabel?: string;
  state?: "open" | "sealed" | "provisional";
}

const room = (
  subtitle: string,
  occupant: string,
  description: string,
  trace: string,
  extra: Partial<MansionRoomDetail> = {}
): MansionRoomDetail => ({
  subtitle,
  occupant,
  description,
  trace,
  level: 1,
  ...extra
});

/**
 * 房间正文与生活痕迹以“ABYSSA-守望者之崖-布局骨架-v8定稿.html”为准。
 * 产品层新增的收取/升级数据只描述交互，不反向冒充世界观硬设定。
 */
export const MANSION_ROOM_DETAILS: Record<string, MansionRoomDetail> = {
  tibby: room(
    "TIBBY'S STORE",
    "驻在：缇比 / 诺玛（砍价中）",
    "离领地足有二十分钟脚程的海边黑店。店主选这里的理由很充分：「离那位小祖宗远点，免得她天天来『视察』~」",
    "「勇者专用折扣区」的标价全是手写的，每个数字墨迹深浅都不一样——显然改了又改。",
    { level: 2, href: "shop.html", actionLabel: "前往杂货铺" }
  ),
  dock: room(
    "OLD DOCK",
    "驻在：—",
    "缇比的私人水路，「特殊进货」都从这里上岸。据说有些货箱里会传出呼吸声。",
    "木牌写着「最终解释权归缇比所有」。上一个讨价还价的外地商人，最后把船抵给了她。",
    { href: "dice.html", actionLabel: "前往码头骰局" }
  ),
  abyssa: room(
    "ABYSSA'S CHAMBER",
    "驻在：艾比希斯（熟睡中）",
    "主楼二层，全世界最危险的地方。推门向右就是她的日光露台。",
    "门边告示牌是玛丽埃塔写的「入内请轻声」，下面有人用歪歪扭扭的字补了一句：「…嗯。」",
    { level: 2, fund: "public", upgradeCost: 1200 }
  ),
  bath: room(
    "BATH",
    "驻在：—",
    "公用大浴池。魔王的「投放作业」需要凯尔与女仆长联手执行。",
    "最边上一条纯黑毛巾没绣字——给那位从不自己洗、但总有人替她准备好的主人。",
    { fund: "public", upgradeCost: 800 }
  ),
  lounge: room(
    "SECOND-FLOOR LOUNGE",
    "驻在：待确认",
    "PSD 美术新增的二层起居空间，尚未在 v8 房间设定中定义正式职能。",
    "生活痕迹待补。",
    { state: "provisional" }
  ),
  hall: room(
    "GRAND HALL",
    "驻在：—",
    "宅邸中庭，壁炉全年不熄。小队白天在这里集合，晚上回村舍——这是凯尔定的规矩：「家里得有个人间烟火的样子」。",
    "沙发停火线由三个抱枕划定：左归魔王，右归柯萝萝，中间留给凯尔。",
    { level: 2, fund: "public", upgradeCost: 960 }
  ),
  kitchen: room(
    "KITCHEN",
    "驻在：凯尔（烹饪中）",
    "凯尔每天从村舍走五分钟过来生火。炊烟一起，全村就知道：开饭时间到了。",
    "今日菜单：炖菜、烤饼、草莓布丁×2（一份是柯萝萝的例贡）。",
    {
      level: 2,
      fund: "public",
      upgradeCost: 900,
      production: { label: "备餐", amount: 2, unit: "份", icon: "meal" }
    }
  ),
  dining: room(
    "DINING",
    "驻在：—",
    "长桌每天坐得满满当当。魔王主位挨着凯尔，柯萝萝离布丁最近。",
    "尤斯缇丝曾提议按礼制重排座次，被全票否决——包括她自己那张弃权票。",
    { fund: "public", upgradeCost: 720 }
  ),
  foyer: room(
    "FOYER",
    "驻在：—",
    "宅邸正门，朝向村舍与大路。门垫下压着缇比这个月的账单。",
    "门垫印着小字：「请先擦净鞋底，泥迹会使红线提前启动。」"
  ),
  terrace: room(
    "TERRACE",
    "驻在：暂无（领土争议区）",
    "职能翼的屋顶平台，魔王裹着毯子晒太阳的地方，像一块正在发酵的面团。",
    "柯萝萝在躺椅背上刻了个「柯」字，第二天旁边多了一枚黑泥爪印。双方维持冷战。"
  ),
  towerTop: room(
    "WATCHTOWER",
    "驻在：阿尔薇特（警戒中）",
    "她坚持住在塔上，理由是「睡得着的地方看不见海」。烽火台从未点燃过——但愿永远如此。",
    "每巡一圈，她最后总会看一眼两处炊烟：主宅的，和村舍的。确认都在，才继续警戒。",
    { level: 2 }
  ),
  towerHall: room(
    "TOWER HALL",
    "驻在：—",
    "塔身过厅，螺旋梯贯通上下，墙上挂着海图与信号灯。",
    "第三级台阶有点松，踩上去会响——没人修，那是最好的「有人上楼」警报。"
  ),
  armory: room(
    "ARMORY",
    "驻在：—",
    "塔底武备库，小队的武器在此保养。长枪立在角落，寒光让灰尘都不敢靠近。",
    "第二排架子上，锈穿的旧水杯里插着磨刀石，标签写着「防潮罐」——三个字写得格外用力。",
    { fund: "party", upgradeCost: 650 }
  ),
  salon: room(
    "SALON",
    "驻在：薇薇安（办公中）",
    "外务会客厅。她每周从魔王城来三次，每次都嫌远，每次都「顺便」带来一整箱给魔王的新裙子。",
    "她听完「蔬菜炖肉连续四次」的汇报，当场批了「每周两次配得上银餐具的菜品」预算——从公款出。",
    { level: 2, fund: "public", upgradeCost: 1000 }
  ),
  workshop: room(
    "WORKSHOP",
    "驻在：—",
    "用于修缮受瘴气与战斗侵蚀的普通装备。设施自行运转，角色在场不改变效率。",
    "该空间为 PSD 美术补充；生活痕迹待补。",
    {
      fund: "party",
      upgradeCost: 760,
      production: { label: "装备保养", amount: 1, unit: "件", icon: "maintenance" }
    }
  ),
  maid: room(
    "ATELIER",
    "驻在：玛丽埃塔（缝纫中）",
    "地下后勤区的心脏，红线从这里织向全宅每块砖石。她嘴上说「只是轮值驻在」，排班表却已经排到了明年春天。",
    "排班表精确到分钟，唯独「叫魔王起床」一栏写着：随缘。",
    { level: 2, fund: "public", upgradeCost: 1100 }
  ),
  storage: room(
    "STORAGE",
    "驻在：—",
    "标签全是艾洛拉工整的小字。最里层有诺玛私藏的一箱「战略物资」棒棒糖。",
    "箱子少了一根糖，现场多了一枚银币和一张「谢了~」——某条龙的笔迹。",
    {
      fund: "public",
      upgradeCost: 680,
      production: { label: "外围补给", amount: 1, unit: "批", icon: "supplies" }
    }
  ),
  cellar: room(
    "CELLAR",
    "驻在：—",
    "薇薇安一个世纪的收藏。铜锁边缘有极细的划痕——女仆长每月查库存，从不开锁。",
    "「数目不对的话，灰尘会告诉我。」"
  ),
  laundry: room(
    "LAUNDRY",
    "驻在：—",
    "最高处晾着魔王的「睡衣」——虽然那东西每晚都会自己融化重组。",
    "玛丽埃塔坚持：「洗过晒过的才算干净。」",
    { fund: "public", upgradeCost: 620 }
  ),
  library: room(
    "ARCHIVE",
    "驻在：蕾诺尔（阅读中）",
    "名义上她只是「驻馆值守」，实际上她大概一百年没出过门了。书堆里有一小团斗篷，传出平稳的翻页声。",
    "白骨之手递回字条：「左侧第三架有你要的记录。还有——谢谢。」最后一个词写得特别小。",
    { level: 2, fund: "public", upgradeCost: 980 }
  ),
  array: room(
    "CORE",
    "驻在：—",
    "整片领地的心脏，红线如脉搏明暗起伏。其中一根颜色最深——直通魔王寝室。",
    "「不是监视，是备用。万一她睡相不好滚下床，我得第一时间知道。」",
    {
      level: 2,
      fund: "public",
      upgradeCost: 1400,
      production: { label: "结界记录", amount: 1, unit: "份", icon: "records" }
    }
  ),
  seal: room(
    "SEALED GATE",
    "驻在：禁止驻在",
    "地下最深处的石门，符纸无风自动。连四天王都很少提及。",
    "蕾诺尔说那只是「岩层渗水的回音」。她当时抱书的手，比平时多用了三成力气。",
    { level: 0, state: "sealed" }
  ),
  greenhouse: room(
    "GREENHOUSE",
    "驻在：艾洛拉（照料中）",
    "村舍与主宅之间的玻璃房，番茄与净光草长势喜人。魔王偶尔飘进来，对着草莓「盯——」很久。",
    "「禁止偷吃」的牌子旁补了一行小字：「……摘之前请先告诉我，洗过的才可以。」",
    {
      fund: "public",
      upgradeCost: 740,
      production: { label: "净光草", amount: 3, unit: "束", icon: "herbs" }
    }
  ),
  kaelHut: room(
    "KAEL'S HUT",
    "驻在：—（本人在主宅厨房）",
    "老兵自己挑的地皮，亲手盖的石屋。离主宅厨房五分钟，离魔王也是五分钟——都是他算好的。",
    "屋里最值钱的是那套修补了无数次的厨具。墙上挂着尤斯缇丝重缝的旧斗篷。"
  ),
  plaza: room(
    "PLAZA",
    "驻在：尤斯缇丝（生火中）",
    "村子的中心：一堆篝火，一口水井。晚饭后的固定节目是围着火堆听诺玛吹牛，顺便清算今天的开销。",
    "分工明确：尤斯缇丝生火，柯萝萝取暖，艾洛拉烤棉花糖，凯尔收拾。魔王偶尔会飘过来，把棉花糖全拿走。"
  ),
  eustice: room(
    "EUSTICE'S ROOM",
    "驻在：—",
    "她自己要求的二楼：「视野和纪律一样重要。」窗台一尘不染，被子叠成标准的豆腐块。",
    "衣柜深处藏着针线包——给某人缝斗篷的丝线按损耗估算，还够补三年。"
  ),
  norma: room(
    "NORMA'S ROOM",
    "驻在：—（本人在缇比店里）",
    "她选二楼的理由相当直白：「方便翻窗。」窗台挂着风干的肉脯和一根来历不明的羽毛。",
    "地板第三块砖下藏着私房钱。枕边铁盒里有半根棒棒糖，留着「破产纪念日」吃。"
  ),
  elora: room(
    "ELORA'S ROOM",
    "驻在：—（本人在温室）",
    "一楼向阳，窗台上晒满了药草。床头铁盒是小队应急金，她每天数一遍，对着空掉的那格叹气。",
    "清单「绝对不能再浪费的东西」第一行写着「高阶净化卷轴」，字迹有点抖。"
  ),
  kororo: room(
    "KORORO'S ROOM",
    "驻在：柯萝萝（睡眠中）",
    "她选一楼的理由是「楼梯会杀人」。被子维持人形凹陷，抱枕堆成防御工事。",
    "门口「打扫会死」的字条已换到第七版。玛丽埃塔在每版下面都端庄地回复：「已阅，周三照常。」"
  ),
  attic: room(
    "ATTIC OBSERVATORY",
    "驻在：待确认",
    "PSD 美术新增的阁楼观星空间，尚未在 v8 房间设定中定义正式职能。",
    "生活痕迹待补。",
    { state: "provisional" }
  ),
  gate: room(
    "MAIN GATE",
    "驻在：卫兵（交接中）",
    "领地唯一的陆路入口，纹章一半王徽一半荆棘。访客永远被拦在三里外。",
    "门柱两道旧痕：一道剑痕来自圣战那年；一道新的是爪印——某位魔王觉得柱子「看着不顺眼」。",
    { level: 2, href: "battle.html", actionLabel: "查看肃清任务" }
  )
};

export type MansionFaction = "lord" | "king" | "party" | "neutral" | "guard";

export interface MansionCharacter {
  id: string;
  name: string;
  secondaryName: string;
  role: string;
  faction: MansionFaction;
  schedule: Record<MansionPhaseId, string | null>;
  lines: Record<MansionPhaseId, string>;
}

/**
 * “昼”复现 v8 定稿中的 11 人驻在快照；其余三档是产品演示排布，
 * 仅在 v8 已确认的家/职掌/公共生活场景之间移动，不作为世界观作息表。
 */
export const MANSION_CHARACTERS: MansionCharacter[] = [
  {
    id: "abyssa",
    name: "艾比希斯",
    secondaryName: "ABYSSA BEELZERAN",
    role: "无冕幼神 · 灾厄魔王",
    faction: "lord",
    schedule: { dawn: "abyssa", day: "abyssa", dusk: "terrace", night: "abyssa" },
    lines: {
      dawn: "太阳照进来了。……再睡一会儿。",
      day: "……勇者呢？",
      dusk: "这里很暖。毯子也是。",
      night: "门边的字写得很清楚：入内请轻声。……嗯。"
    }
  },
  {
    id: "alvitr",
    name: "阿尔薇特",
    secondaryName: "ALVITR SEVERIN",
    role: "军务与防卫席",
    faction: "king",
    schedule: { dawn: "towerTop", day: "towerTop", dusk: "armory", night: "towerTop" },
    lines: {
      dawn: "海面无异常。主宅和村舍的炊烟都在。",
      day: "警戒继续。烽火台不需要点燃。",
      dusk: "武器保养结束。那只旧杯子现在是防潮罐。",
      night: "你去休息。我再巡一圈。"
    }
  },
  {
    id: "marietta",
    name: "玛丽埃塔",
    secondaryName: "MARIETTA CRAIG",
    role: "内务与结界席",
    faction: "king",
    schedule: { dawn: "maid", day: "maid", dusk: "dining", night: "array" },
    lines: {
      dawn: "勇者大人，早餐与今日的修缮提案都已备妥。",
      day: "红线运转正常。至于叫魔王大人起床……随缘。",
      dusk: "请先擦净鞋底。餐厅刚刚整理完毕。",
      night: "核心阵法稳定。最后一轮巡视由我完成。"
    }
  },
  {
    id: "lenore",
    name: "蕾诺尔",
    secondaryName: "LENORE VOYNICH",
    role: "典籍与法术席",
    faction: "king",
    schedule: { dawn: "library", day: "library", dusk: "library", night: "library" },
    lines: {
      dawn: "生者，把书放在桌角。不要放在地上。",
      day: "左侧第三架有你要的记录。",
      dusk: "此身没有离开书库的必要。",
      night: "还有——谢谢。……最后两个字不必念出来。"
    }
  },
  {
    id: "vivienne",
    name: "薇薇安",
    secondaryName: "VIVIENNE SANGUINE",
    role: "外事与公库席",
    faction: "king",
    schedule: { dawn: null, day: "salon", dusk: "salon", night: null },
    lines: {
      dawn: "今日尚未驻馆。",
      day: "连续四次蔬菜炖肉？这笔餐饮预算，我批了。",
      dusk: "银餐具不是浪费，是行宫应有的体面。",
      night: "今日外务已经结束。"
    }
  },
  {
    id: "kael",
    name: "凯尔",
    secondaryName: "KAEL",
    role: "静谧之楔 · 勇者",
    faction: "party",
    schedule: { dawn: "kitchen", day: "kitchen", dusk: "plaza", night: "kaelHut" },
    lines: {
      dawn: "灶火正好。等炊烟升起来，大家就知道该吃饭了。",
      day: "炖菜还差最后一点盐。",
      dusk: "火堆交给尤斯缇丝，我来收拾剩下的。",
      night: "门外安静。今天也算平安过去了。"
    }
  },
  {
    id: "eustice",
    name: "尤斯缇丝",
    secondaryName: "EUSTICE GRIFFIN",
    role: "红莲剑姬 · 前线指挥",
    faction: "party",
    schedule: { dawn: "eustice", day: "plaza", dusk: "plaza", night: "eustice" },
    lines: {
      dawn: "被子当然要叠整齐。这是最基本的纪律。",
      day: "本小姐只是提前把篝火准备好。不要多想。",
      dusk: "针脚全歪了。拆掉，我来重缝。",
      night: "明天的整备表已经放在桌上了。"
    }
  },
  {
    id: "norma",
    name: "诺玛",
    secondaryName: "NORMA LOCKE",
    role: "黑街潜行者 · 斥候",
    faction: "party",
    schedule: { dawn: "norma", day: "tibby", dusk: "plaza", night: "norma" },
    lines: {
      dawn: "BOSS，今天第一根糖算在情报费里。",
      day: "再便宜一点嘛。你看，我可是常客。",
      dusk: "今天这点开销，听我慢慢解释。",
      night: "地板第三块砖？哪有什么第三块砖。"
    }
  },
  {
    id: "elora",
    name: "艾洛拉",
    secondaryName: "ELORA ARGENT",
    role: "奇迹白圣女 · 后勤",
    faction: "party",
    schedule: { dawn: "elora", day: "greenhouse", dusk: "plaza", night: "elora" },
    lines: {
      dawn: "药草晒好以后，还要再核一次应急金。",
      day: "草莓可以摘，但要先告诉我。洗过才可以。",
      dusk: "棉花糖这一包没有超预算，真的。",
      night: "净化卷轴不能省。其他地方我会再想办法。"
    }
  },
  {
    id: "kororo",
    name: "柯萝萝",
    secondaryName: "KORORO LAPLACE",
    role: "星盘魔法使",
    faction: "party",
    schedule: { dawn: "kororo", day: "kororo", dusk: "plaza", night: "kororo" },
    lines: {
      dawn: "楼梯会杀人。今天也不要上楼。",
      day: "抹布在厨房，队长去拿。不要——出去好冷。",
      dusk: "我只负责取暖。棉花糖是额外工作。",
      night: "门口写着『打扫会死』。这不是建议。"
    }
  },
  {
    id: "tibby",
    name: "缇比",
    secondaryName: "TIBBY AURELIA",
    role: "黑店掌柜 · 黄金古龙",
    faction: "neutral",
    schedule: { dawn: "tibby", day: "tibby", dusk: "tibby", night: "tibby" },
    lines: {
      dawn: "早起的勇者有折扣哦。至于折多少，要看今天的金价。",
      day: "童叟无欺，一口价只收百分之二。",
      dusk: "最后一批特殊进货刚从码头上岸。",
      night: "打烊？古龙没有这种世俗的作息。"
    }
  }
];

export function fallbackRoomDetail(kind: MansionRegionKind): MansionRoomDetail {
  return room(
    kind === "building" ? "BLUFF FACILITY" : "MANSION ROOM",
    "驻在：—",
    "该区域已经完成热区标定，正式内容仍待设定补充。",
    "生活痕迹待补。",
    { state: "provisional" }
  );
}
