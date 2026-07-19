import abyssaPortrait from "../assets/png/abyssa.png";
import abyssaGothicPortrait from "../assets/png/abyssa-b.png";
import alvitrPortrait from "../assets/png/alvitr.png";
import eloraPortrait from "../assets/png/elora.png";
import eusticePortrait from "../assets/png/eustice.png";
import kororoPortrait from "../assets/png/kororo.png";
import lenorePortrait from "../assets/png/lenore.png";
import mariettaPortrait from "../assets/png/marietta.png";
import normaPortrait from "../assets/png/norma.png";
import viviennePortrait from "../assets/png/vivienne.png";
import abyssaAvatar from "../assets/avatar/abyssa.png";
import alvitrAvatar from "../assets/avatar/alvitr.png";
import eloraAvatar from "../assets/avatar/elora.png";
import eusticeAvatar from "../assets/avatar/eustice.png";
import kororoAvatar from "../assets/avatar/kororo.png";
import lenoreAvatar from "../assets/avatar/lenore.png";
import mariettaAvatar from "../assets/avatar/marietta.png";
import normaAvatar from "../assets/avatar/norma.png";
import vivienneAvatar from "../assets/avatar/vivienne.png";
import eusticeDomainIcon from "../assets/svg/0-0-all-for-one.svg";
import eusticeSwordIcon from "../assets/svg/0-1-bouncing-sword.svg";
import eloraMiracleIcon from "../assets/svg/1-0-embrassed-energy.svg";
import eloraWandIcon from "../assets/svg/1-1-fairy-wand.svg";
import kororoGravityIcon from "../assets/svg/2-0-pentagram-rose.svg";
import kororoStarIcon from "../assets/svg/2-1-explosion-rays.svg";
import normaArsenalIcon from "../assets/svg/3-0-assassin-pocket.svg";
import normaStealthIcon from "../assets/svg/3-1-duality-mask.svg";
import abyssaPeaceIcon from "../assets/svg/4-0-moon.svg";
import abyssaProtoplasmIcon from "../assets/svg/4-1-goo-explosion.svg";
import mariettaPuppetIcon from "../assets/svg/5-0-puppet.svg";
import mariettaDomainIcon from "../assets/svg/5-1-strolabe.svg";
import alvitrOrderIcon from "../assets/svg/6-0-split-cross.svg";
import alvitrChaosIcon from "../assets/svg/6-1-fast-arrow.svg";
import lenoreFamiliarIcon from "../assets/svg/7-0-skeletal-hand.svg";
import lenoreArchiveIcon from "../assets/svg/7-1-secret-book.svg";
import vivienneRoseIcon from "../assets/svg/8-0-rose.svg";
import vivienneCurtainIcon from "../assets/svg/8-1-heart-drop.svg";
import type { CharacterProfile } from "../components/CharacterStatusScreen";

type ParameterRank = "D" | "C" | "B" | "A" | "S" | "EX";
type ParameterRanks = readonly [
  ParameterRank,
  ParameterRank,
  ParameterRank,
  ParameterRank,
  ParameterRank,
  ParameterRank
];

const parameterDefinitions = [
  { label: "生命", secondaryLabel: "LIFE" },
  { label: "力量", secondaryLabel: "POWER" },
  { label: "敏捷", secondaryLabel: "AGILITY" },
  { label: "源力", secondaryLabel: "MANA" },
  { label: "控制", secondaryLabel: "CONTROL" },
  { label: "战术", secondaryLabel: "TACTICS" }
] as const;

function createStats(values: ParameterRanks) {
  return parameterDefinitions.map((definition, index) => {
    const value = values[index] as ParameterRank;

    return {
      ...definition,
      value,
      accent: value === "S" || value === "EX"
    };
  });
}

export const demoCharacters: CharacterProfile[] = [
  {
    id: "eustice",
    number: "00",
    name: "尤斯缇丝·格里芬",
    secondaryName: "EUSTICE GRIFFIN",
    selectorLabel: "尤斯缇丝",
    selectorVariant: "gray",
    portraitUrl: eusticePortrait,
    portraitAlt: "尤斯缇丝·格里芬角色立绘",
    appearanceLabel: "冒险的样子",
    thumbnailUrl: eusticeAvatar,
    thumbnailAlt: "尤斯缇丝·格里芬头像",
    status: {
      title: "红莲剑姬",
      titleRootIndex: 2,
      subtitle: "THE CRIMSON SWORD PRINCESS",
      affiliation: { label: "勇者小队", secondaryLabel: "HERO PARTY", tone: "hero-party" },
      fields: [
        { label: "种族", value: "人类" },
        { label: "职能", value: "前线指挥官" },
        { label: "年龄", value: "18" },
        { label: "身高", value: "164cm" }
      ],
      stats: createStats(["A", "A", "A", "A", "S", "S"]),
      traits: [
        {
          name: "王权领域：红莲战阵",
          iconUrl: eusticeDomainIcon,
          summary: "阵地强化 · 敌军压制",
          description: "将刺剑刺入地面，展开以阵位为核心的猩红战阵；友军获强化，敌人受压制，阵型越严整越稳定。"
        },
        {
          name: "定理剑术：红莲的轨迹",
          iconUrl: eusticeSwordIcon,
          summary: "弱点锁定 · 轨迹引爆",
          description: "以刺剑描出猩红剑轨，锁定防具与魔力薄弱处；残留轨迹会一同引爆，完成精准切割。"
        }
      ],
      record: "格里芬家族出身的王家军事学院首席，以满分毕业后被指派为勇者小队前线指挥。她嘴上严苛，实则把“所有人活着回来”当作不容动摇的骑士底线。",
      quote: "哼，知道就好。就你刚才那种完全不顾死活的冲锋，要不是本小姐盯着，你现在连骨头都找不全了。"
    }
  },
  {
    id: "elora",
    number: "01",
    name: "艾洛拉·亚金特",
    secondaryName: "ELORA ARGENT",
    selectorLabel: "艾洛拉",
    selectorVariant: "light",
    portraitUrl: eloraPortrait,
    portraitAlt: "艾洛拉·亚金特角色立绘",
    appearanceLabel: "冒险的样子",
    thumbnailUrl: eloraAvatar,
    thumbnailAlt: "艾洛拉·亚金特头像",
    status: {
      title: "奇迹白圣女",
      titleRootIndex: 2,
      subtitle: "THE MIRACULOUS WHITE SAINT",
      affiliation: { label: "勇者小队", secondaryLabel: "HERO PARTY", tone: "hero-party" },
      fields: [
        { label: "种族", value: "人类" },
        { label: "职能", value: "首席神官" },
        { label: "年龄", value: "15" },
        { label: "身高", value: "141cm" }
      ],
      stats: createStats(["B", "A", "C", "EX", "S", "B"]),
      traits: [
        {
          name: "神圣治愈：越限奇迹",
          iconUrl: eloraMiracleIcon,
          summary: "瞬发复原 · 神圣净化",
          description: "无需咏唱即可瞬发复原与净化奇迹，只要灵魂尚未消散便能挽回致命重创。"
        },
        {
          name: "重型威慑：星盘圣杖",
          iconUrl: eloraWandIcon,
          summary: "祈祷媒介 · 近身重击",
          description: "那把纯金星盘十字圣杖既是祈祷媒介，也是重型钝器；她能用意外的力气砸退绕后的偷袭者。"
        }
      ],
      record: "战后流民聚落长大的小神官，早早看见草药与绷带稀缺时的无力。如今她负责小队的物资与治疗：平日精打细算，面对伤病却从不吝惜任何代价。",
      quote: "在集市上，为了三个铜板我都会跟人讨价还价。但唯独在凯尔的身体上，我就是要毫无保留地浪费。"
    }
  },
  {
    id: "kororo",
    number: "02",
    name: "柯萝萝·拉普拉斯",
    secondaryName: "KORORO LAPLACE",
    selectorLabel: "柯萝萝",
    selectorVariant: "deep",
    portraitUrl: kororoPortrait,
    portraitAlt: "柯萝萝·拉普拉斯角色立绘",
    appearanceLabel: "冒险的样子",
    thumbnailUrl: kororoAvatar,
    thumbnailAlt: "柯萝萝·拉普拉斯头像",
    status: {
      title: "星盘魔法使",
      titleRootIndex: 2,
      subtitle: "THE ASTROLABE MAGE",
      affiliation: { label: "勇者小队", secondaryLabel: "HERO PARTY", tone: "hero-party" },
      fields: [
        { label: "种族", value: "人类" },
        { label: "职能", value: "首席魔法使" },
        { label: "年龄", value: "16" },
        { label: "身高", value: "154cm" }
      ],
      stats: createStats(["D", "D", "B", "EX", "EX", "A"]),
      traits: [
        {
          name: "星轨干涉：渊星重压",
          iconUrl: kororoGravityIcon,
          summary: "重力增幅 · 行动封锁",
          description: "拨动星盘便能令目标周遭重压骤增；她以极低消耗，让庞大敌人在无形压迫下失去行动能力。"
        },
        {
          name: "极效星法：微缩极星",
          iconUrl: kororoStarIcon,
          summary: "星芒凝缩 · 贯穿破防",
          description: "将流星雨的破坏力凝缩为拳大的星芒，以无声重压击穿重甲、结界与最棘手的障碍。"
        }
      ],
      record: "传统魔法世家的天才，为逃离高压期待而消极怠工，却在勇者小队选拔中随手打破纪录。凯尔给予的日常照料成了她最安心的归处，也令她开始和艾比希斯争夺沙发与注意力。",
      quote: "因为吃饭是生存刚需，擦地不是。啊——队长顺手擦一下嘛。"
    }
  },
  {
    id: "norma",
    number: "03",
    name: "诺玛·洛克",
    secondaryName: "NORMA LOCKE",
    selectorLabel: "诺玛",
    selectorVariant: "dark",
    portraitUrl: normaPortrait,
    portraitAlt: "诺玛·洛克角色立绘",
    appearanceLabel: "冒险的样子",
    thumbnailUrl: normaAvatar,
    thumbnailAlt: "诺玛·洛克头像",
    status: {
      title: "黑街潜行者",
      titleRootIndex: 2,
      subtitle: "THE BLACKSTREET INFILTRATOR",
      affiliation: { label: "勇者小队", secondaryLabel: "HERO PARTY", tone: "hero-party" },
      fields: [
        { label: "种族", value: "亚人" },
        { label: "职能", value: "斥候与后勤联络员" },
        { label: "年龄", value: "18" },
        { label: "身高", value: "158cm" }
      ],
      stats: createStats(["B", "C", "S", "C", "A", "A"]),
      traits: [
        {
          name: "黑街戏法：无限制武装",
          iconUrl: normaArsenalIcon,
          summary: "投掷武装 · 异常侵蚀",
          description: "腰包就是一座移动黑市：致盲粉、腐蚀酸液与淬毒飞刀齐备，专挑对手最难防的一面下手。"
        },
        {
          name: "死角潜行：无音步",
          iconUrl: normaStealthIcon,
          summary: "无声切入 · 要害收割",
          description: "将呼吸、心跳与脚步一并藏进阴影，从绝对死角切入要害后立刻脱离，把低风险收割贯彻到底。"
        }
      ],
      record: "王都黑街长大的亚人孤儿，曾受雇潜入勇者小队监视并清除“弃子”。雨夜遭背弃后，她倒向小队，促成共犯般的结盟，如今负责侦察、联络与最不体面的善后。",
      quote: "大小姐要多长长眼睛，这就是个生锈的弹簧锁。"
    }
  },
  {
    id: "abyssa",
    number: "04",
    name: "艾比希斯·贝尔泽兰",
    secondaryName: "ABYSSA BEELZERAN",
    selectorLabel: "艾比希斯",
    selectorVariant: "teal-outline",
    portraitUrl: abyssaPortrait,
    portraitAlt: "艾比希斯·贝尔泽兰角色立绘",
    appearanceLabel: "原生的样子",
    thumbnailUrl: abyssaAvatar,
    thumbnailAlt: "艾比希斯·贝尔泽兰头像",
    outfits: [
      {
        id: "abyssa-origin",
        label: "原生质睡衣",
        displayLabel: "00",
        appearanceLabel: "原生的样子",
        portraitUrl: abyssaPortrait,
        portraitAlt: "艾比希斯·贝尔泽兰原生质睡衣立绘"
      },
      {
        id: "abyssa-gothic",
        label: "哥特礼服",
        displayLabel: "01",
        appearanceLabel: "礼服的样子",
        portraitUrl: abyssaGothicPortrait,
        portraitAlt: "艾比希斯·贝尔泽兰哥特礼服立绘"
      }
    ],
    status: {
      title: "无冕幼神",
      titleRootIndex: 2,
      subtitle: "THE CROWNLESS YOUNG GOD",
      affiliation: { label: "魔王", secondaryLabel: "DEMON LORD", tone: "demon-lord" },
      fields: [
        { label: "种族", value: "根源存在" },
        { label: "职能", value: "世界法则稳定器" },
        { label: "外观", value: "少女" },
        { label: "所在地", value: "魔王城" }
      ],
      stats: createStats(["EX", "EX", "D", "EX", "A", "C"]),
      traits: [
        {
          name: "我的平静",
          iconUrl: abyssaPeaceIcon,
          summary: "根源安定 · 潮汐抑制",
          description: "她的平静便是世界的安宁，如无形堤岸般挡住足以吞没一切的黑色潮汐。"
        },
        {
          name: "万象原生质",
          iconUrl: abyssaProtoplasmIcon,
          summary: "自在塑形 · 万象延伸",
          description: "令黑色原生质化作触手、衣装、屏障或其他所需形态；这是她无需起身也能贯彻意志的延伸。"
        }
      ],
      record: "灰石村的少女被献入黑色裂隙，根源之力填满躯壳，成为大天平选中的当代魔王。四天王将她带回魔王城；如今那里是她无需解释的“家”。",
      quote: "唔……太阳照在身上的时候，就醒了。……然后晒太阳。"
    }
  },
  {
    id: "marietta",
    number: "05",
    name: "玛丽埃塔·克雷格",
    secondaryName: "MARIETTA CRAIG",
    selectorLabel: "玛丽埃塔",
    selectorVariant: "gray",
    portraitUrl: mariettaPortrait,
    portraitAlt: "玛丽埃塔·克雷格角色立绘",
    appearanceLabel: "工作的样子",
    thumbnailUrl: mariettaAvatar,
    thumbnailAlt: "玛丽埃塔·克雷格头像",
    status: {
      title: "提线魔女",
      titleRootIndex: 2,
      subtitle: "THE MARIONETTE WITCH",
      affiliation: { label: "魔王干部", secondaryLabel: "DEMON LORD'S CADRE", tone: "demon-cadre" },
      fields: [
        { label: "种族", value: "提线魔女 / 自律人偶" },
        { label: "职能", value: "内务与结界总管" },
        { label: "年龄", value: "外观14–15岁" },
        { label: "身高", value: "148cm" }
      ],
      stats: createStats(["S", "B", "A", "S", "EX", "A"]),
      traits: [
        {
          name: "万象操偶",
          iconUrl: mariettaPuppetIcon,
          summary: "万线操控 · 精密切割",
          description: "成千上万根红色魔力丝线既能完成无误差家政，也能切割钢铁、束缚敌人。"
        },
        {
          name: "结界：女仆长的领域",
          iconUrl: mariettaDomainIcon,
          summary: "全域感知 · 领地支配",
          description: "魔力红线渗入魔王城的砖石，令她感知并支配领地内的一切风吹草动；灰尘也无法越过她的规矩。"
        }
      ],
      record: "为长久履职而将灵魂与提线魔法融合，蜕为自律人偶。克雷格家族消亡后，她独守旧庄园数百年；接受招揽后，把魔王城视作新的宅邸与职场。",
      quote: "如您所愿。既然还需要交涉，我这就将他取下。"
    }
  },
  {
    id: "alvitr",
    number: "06",
    name: "阿尔薇特·塞维琳",
    secondaryName: "ALVITR SEVERIN",
    selectorLabel: "阿尔薇特",
    selectorVariant: "deep",
    portraitUrl: alvitrPortrait,
    portraitAlt: "阿尔薇特·塞维琳角色立绘",
    appearanceLabel: "战斗的样子",
    thumbnailUrl: alvitrAvatar,
    thumbnailAlt: "阿尔薇特·塞维琳头像",
    status: {
      title: "堕落武神",
      titleRootIndex: 2,
      subtitle: "THE FALLEN VALKYRIE",
      affiliation: { label: "魔王干部", secondaryLabel: "DEMON LORD'S CADRE", tone: "demon-cadre" },
      fields: [
        { label: "种族", value: "堕落女武神" },
        { label: "职能", value: "首席卫队长" },
        { label: "年龄", value: "外观少女" },
        { label: "身高", value: "159cm" }
      ],
      stats: createStats(["S", "S", "EX", "A", "S", "S"]),
      traits: [
        {
          name: "秩序残辉：裂光阵线",
          iconUrl: alvitrOrderIcon,
          summary: "节点击碎 · 法术解构",
          description: "以长枪精准击碎法术构造的核心节点，将高阶魔法强行打散、还原为无害微光。"
        },
        {
          name: "混沌异化：灰烬瞬步",
          iconUrl: alvitrChaosIcon,
          summary: "混沌跃迁 · 贯穿突袭",
          description: "借黑灰化作混沌粒子，无视距离与结界瞬跃；在敌人死角重新凝聚后，以长枪贯穿护盾。"
        }
      ],
      record: "曾为掩护主力，在深渊边缘独守三日三夜；神核遭侵蚀后反被神域判为不洁、处以抹除。逃离刑场的她在魔族得到接纳，并将忠诚化作最坚实的防线。",
      quote: "……就那个吧。骨翼清理起来很麻烦，这套梳刷刚好能用。"
    }
  },
  {
    id: "lenore",
    number: "07",
    name: "蕾诺尔·伏尼契",
    secondaryName: "LENORE VOYNICH",
    selectorLabel: "蕾诺尔",
    selectorVariant: "dark",
    portraitUrl: lenorePortrait,
    portraitAlt: "蕾诺尔·伏尼契角色立绘",
    appearanceLabel: "常态",
    thumbnailUrl: lenoreAvatar,
    thumbnailAlt: "蕾诺尔·伏尼契头像",
    status: {
      title: "禁书库之主",
      titleRootIndex: 4,
      subtitle: "THE FORBIDDEN ARCHIVIST",
      affiliation: { label: "魔王干部", secondaryLabel: "DEMON LORD'S CADRE", tone: "demon-cadre" },
      fields: [
        { label: "种族", value: "巫妖" },
        { label: "职能", value: "图书与情报部长" },
        { label: "年龄", value: "约千年" },
        { label: "身高", value: "143cm" }
      ],
      stats: createStats(["B", "C", "D", "EX", "S", "EX"]),
      traits: [
        {
          name: "伴生魔灵：守墓者之腕",
          iconUrl: lenoreFamiliarIcon,
          summary: "自律骨手 · 防卫拘束",
          description: "自律白骨之手平日搬运、翻书、驱赶闯入者；遇袭时可巨大化为巨臂或骨牢，守住她的私人空间。"
        },
        {
          name: "死寂阵地：阿卡夏之锁",
          iconUrl: lenoreArchiveIcon,
          summary: "魔力封锁 · 符文增益",
          description: "书页在魂火中化作锁链与阵法，封锁敌人的魔力与发声；也能化作符文书页，为友军附加高阶增益。"
        }
      ],
      record: "目睹母国覆灭后，她为留存消亡文明而化作不会遗忘的亡灵史官。如今执掌魔王城书库与情报，也以规矩和距离把自己藏进阴影。",
      quote: "……勇者。那册北境卷宗，昨天日落前就该还回来了。"
    }
  },
  {
    id: "vivienne",
    number: "08",
    name: "薇薇安·桑格温",
    secondaryName: "VIVIENNE SANGUINE",
    selectorLabel: "薇薇安",
    selectorVariant: "gray",
    portraitUrl: viviennePortrait,
    portraitAlt: "薇薇安·桑格温角色立绘",
    appearanceLabel: "社交的样子",
    thumbnailUrl: vivienneAvatar,
    thumbnailAlt: "薇薇安·桑格温头像",
    status: {
      title: "血宴女爵",
      titleRootIndex: 2,
      subtitle: "THE BLOODFEAST COUNTESS",
      affiliation: { label: "魔王干部", secondaryLabel: "DEMON LORD'S CADRE", tone: "demon-cadre" },
      fields: [
        { label: "种族", value: "高阶吸血鬼" },
        { label: "职能", value: "外务大臣" },
        { label: "年龄", value: "漫长寿命" },
        { label: "身高", value: "165cm" }
      ],
      stats: createStats(["A", "B", "A", "S", "S", "EX"]),
      traits: [
        {
          name: "荆棘与血蔷薇",
          iconUrl: vivienneRoseIcon,
          summary: "生命汲取 · 荆棘花雨",
          description: "以周遭液体或魔力结晶出猩红蔷薇与荆棘；花雨锋利，并会抽取目标的生命力。"
        },
        {
          name: "猩红帷幕",
          iconUrl: vivienneCurtainIcon,
          summary: "五感扰乱 · 认知支配",
          description: "以阴影或大衣化作血色帷幕，将区域拖入她支配的剧场，任意扰乱敌人的五感与认知。"
        }
      ],
      record: "出身古老纯血氏族，却用筹码与秘密取代粗鄙统治，在人类权贵间织成情报与利益网。担任魔王城外务大臣后，她更愿在谈判桌上瓦解敌对同盟。",
      quote: "既然那位胖会长有闲钱资助边境的雇佣兵，不如直接赞助我的衣帽间。用来买他那条命，这价格已经很公道了哦~"
    }
  }
];
