import abyssaPortrait from "../../assets/characters/portraits/abyssa.png";
import abyssaGothicPortrait from "../../assets/characters/portraits/abyssa-gothic.png";
import alvitrPortrait from "../../assets/characters/portraits/alvitr.png";
import eloraPortrait from "../../assets/characters/portraits/elora.png";
import eusticePortrait from "../../assets/characters/portraits/eustice.png";
import kororoPortrait from "../../assets/characters/portraits/kororo.png";
import lenorePortrait from "../../assets/characters/portraits/lenore.png";
import mariettaPortrait from "../../assets/characters/portraits/marietta.png";
import normaPortrait from "../../assets/characters/portraits/norma.png";
import viviennePortrait from "../../assets/characters/portraits/vivienne.png";
import abyssaAvatar from "../../assets/characters/avatars/abyssa.png";
import alvitrAvatar from "../../assets/characters/avatars/alvitr.png";
import eloraAvatar from "../../assets/characters/avatars/elora.png";
import eusticeAvatar from "../../assets/characters/avatars/eustice.png";
import kororoAvatar from "../../assets/characters/avatars/kororo.png";
import lenoreAvatar from "../../assets/characters/avatars/lenore.png";
import mariettaAvatar from "../../assets/characters/avatars/marietta.png";
import normaAvatar from "../../assets/characters/avatars/norma.png";
import vivienneAvatar from "../../assets/characters/avatars/vivienne.png";
import type { CharacterArchiveProfile } from "../../shared/domain/characters/archive";
import kaelPortrait from "../../assets/characters/portraits/kael.png";
import { DEFAULT_PLAYER_NAME } from "../../shared/domain/player-identity";

/** Authored identity and art only. No sample campaign state or combat claims. */
export const characterIdentities: CharacterArchiveProfile[] = [
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
      affiliation: {
        label: "勇者小队",
        secondaryLabel: "HERO PARTY",
        tone: "hero-party",
      },
      fields: [
        { label: "种族", value: "人类" },
        { label: "职能", value: "前线指挥官" },
        { label: "年龄", value: "18" },
        { label: "身高", value: "164cm" },
      ],
      record:
        "格里芬家族出身的王家军事学院首席，以满分毕业后被指派为勇者小队前线指挥。她嘴上严苛，实则把“所有人活着回来”当作不容动摇的骑士底线。",
    },
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
      affiliation: {
        label: "勇者小队",
        secondaryLabel: "HERO PARTY",
        tone: "hero-party",
      },
      fields: [
        { label: "种族", value: "人类" },
        { label: "职能", value: "首席神官" },
        { label: "年龄", value: "15" },
        { label: "身高", value: "141cm" },
      ],
      record:
        "战后流民聚落长大的小神官，早早看见草药与绷带稀缺时的无力。如今她负责小队的物资与治疗：平日精打细算，面对伤病却从不吝惜任何代价。",
    },
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
      affiliation: {
        label: "勇者小队",
        secondaryLabel: "HERO PARTY",
        tone: "hero-party",
      },
      fields: [
        { label: "种族", value: "人类" },
        { label: "职能", value: "首席魔法使" },
        { label: "年龄", value: "16" },
        { label: "身高", value: "154cm" },
      ],
      record:
        "传统魔法世家的天才，为逃离高压期待而消极怠工，却在勇者小队选拔中随手打破纪录。勇者小队的日常照料成了她最安心的归处，也令她开始和艾比希斯争夺沙发与注意力。",
    },
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
      affiliation: {
        label: "勇者小队",
        secondaryLabel: "HERO PARTY",
        tone: "hero-party",
      },
      fields: [
        { label: "种族", value: "亚人" },
        { label: "职能", value: "斥候与后勤联络员" },
        { label: "年龄", value: "18" },
        { label: "身高", value: "158cm" },
      ],
      record:
        "王都黑街长大的亚人孤儿，曾受雇潜入勇者小队监视并清除“弃子”。雨夜遭背弃后，她倒向小队，促成共犯般的结盟，如今负责侦察、联络与最不体面的善后。",
    },
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
        portraitAlt: "艾比希斯·贝尔泽兰原生质睡衣立绘",
      },
      {
        id: "abyssa-gothic",
        label: "哥特礼服",
        displayLabel: "01",
        appearanceLabel: "礼服的样子",
        portraitUrl: abyssaGothicPortrait,
        portraitAlt: "艾比希斯·贝尔泽兰哥特礼服立绘",
      },
    ],
    status: {
      title: "无冕幼神",
      titleRootIndex: 2,
      subtitle: "THE CROWNLESS YOUNG GOD",
      affiliation: {
        label: "魔王",
        secondaryLabel: "DEMON LORD",
        tone: "demon-lord",
      },
      fields: [
        { label: "种族", value: "根源存在" },
        { label: "职能", value: "世界法则稳定器" },
        { label: "外观", value: "少女" },
        { label: "所在地", value: "魔王城" },
      ],
      record:
        "灰石村的少女被献入黑色裂隙，根源之力填满躯壳，成为大天平选中的当代魔王。四天王将她带回魔王城；如今那里是她无需解释的“家”。",
    },
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
      affiliation: {
        label: "魔王干部",
        secondaryLabel: "DEMON LORD'S CADRE",
        tone: "demon-cadre",
      },
      fields: [
        { label: "种族", value: "提线魔女 / 自律人偶" },
        { label: "职能", value: "内务与结界总管" },
        { label: "年龄", value: "外观14–15岁" },
        { label: "身高", value: "148cm" },
      ],
      record:
        "为长久履职而将灵魂与提线魔法融合，蜕为自律人偶。克雷格家族消亡后，她独守旧庄园数百年；接受招揽后，把魔王城视作新的宅邸与职场。",
    },
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
      affiliation: {
        label: "魔王干部",
        secondaryLabel: "DEMON LORD'S CADRE",
        tone: "demon-cadre",
      },
      fields: [
        { label: "种族", value: "堕落女武神" },
        { label: "职能", value: "首席卫队长" },
        { label: "年龄", value: "外观少女" },
        { label: "身高", value: "159cm" },
      ],
      record:
        "曾为掩护主力，在深渊边缘独守三日三夜；神核遭侵蚀后反被神域判为不洁、处以抹除。逃离刑场的她在魔族得到接纳，并将忠诚化作最坚实的防线。",
    },
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
      affiliation: {
        label: "魔王干部",
        secondaryLabel: "DEMON LORD'S CADRE",
        tone: "demon-cadre",
      },
      fields: [
        { label: "种族", value: "巫妖" },
        { label: "职能", value: "图书与情报部长" },
        { label: "年龄", value: "约千年" },
        { label: "身高", value: "143cm" },
      ],
      record:
        "目睹母国覆灭后，她为留存消亡文明而化作不会遗忘的亡灵史官。如今执掌魔王城书库与情报，也以规矩和距离把自己藏进阴影。",
    },
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
      affiliation: {
        label: "魔王干部",
        secondaryLabel: "DEMON LORD'S CADRE",
        tone: "demon-cadre",
      },
      fields: [
        { label: "种族", value: "高阶吸血鬼" },
        { label: "职能", value: "外务大臣" },
        { label: "年龄", value: "漫长寿命" },
        { label: "身高", value: "165cm" },
      ],
      record:
        "出身古老纯血氏族，却用筹码与秘密取代粗鄙统治，在人类权贵间织成情报与利益网。担任魔王城外务大臣后，她更愿在谈判桌上瓦解敌对同盟。",
    },
  },
];

export const playerIdentity: CharacterArchiveProfile = {
  id: "kael",
  number: "U",
  name: DEFAULT_PLAYER_NAME,
  secondaryName: "USER",
  selectorLabel: DEFAULT_PLAYER_NAME,
  portraitUrl: kaelPortrait,
  thumbnailUrl: kaelPortrait,
  appearanceLabel: "行旅的样子",
  status: {
    title: "静谧之楔",
    subtitle: "THE TRANQUIL WEDGE",
    affiliation: { label: "勇者小队", tone: "hero-party" },
    fields: [
      { label: "身份", value: "当代勇者" },
      { label: "出身", value: "退伍老兵" },
    ],
    record:
      "出身底层的退伍老兵，伪典试炼的生还者。他以生存经验与朴素的同理心保护同伴，珍视平静的日常，也擅长烹饪与修缮。",
  },
};
export const archiveIdentities = [playerIdentity, ...characterIdentities];
