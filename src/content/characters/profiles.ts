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
import eusticeDomainIcon from "../../assets/icons/0-0-all-for-one.svg";
import eusticeSwordIcon from "../../assets/icons/0-1-bouncing-sword.svg";
import eloraMiracleIcon from "../../assets/icons/1-0-embrassed-energy.svg";
import eloraWandIcon from "../../assets/icons/1-1-fairy-wand.svg";
import kororoGravityIcon from "../../assets/icons/2-0-pentagram-rose.svg";
import kororoStarIcon from "../../assets/icons/2-1-explosion-rays.svg";
import normaArsenalIcon from "../../assets/icons/3-0-assassin-pocket.svg";
import normaStealthIcon from "../../assets/icons/3-1-duality-mask.svg";
import abyssaPeaceIcon from "../../assets/icons/4-0-moon.svg";
import abyssaProtoplasmIcon from "../../assets/icons/4-1-goo-explosion.svg";
import mariettaPuppetIcon from "../../assets/icons/5-0-puppet.svg";
import mariettaDomainIcon from "../../assets/icons/5-1-strolabe.svg";
import alvitrOrderIcon from "../../assets/icons/6-0-split-cross.svg";
import alvitrChaosIcon from "../../assets/icons/6-1-fast-arrow.svg";
import lenoreFamiliarIcon from "../../assets/icons/7-0-skeletal-hand.svg";
import lenoreArchiveIcon from "../../assets/icons/7-1-secret-book.svg";
import vivienneRoseIcon from "../../assets/icons/8-0-rose.svg";
import vivienneCurtainIcon from "../../assets/icons/8-1-heart-drop.svg";
import type { CharacterArchiveProfile } from "../../shared/domain/characters/archive";
import coinsPileIcon from "../../assets/icons/items/coins-pile.svg";
import heartKeyIcon from "../../assets/icons/items/heart-key.svg";
import herbsBundleIcon from "../../assets/icons/items/herbs-bundle.svg";
import hoodIcon from "../../assets/icons/items/hood.svg";
import keyringIcon from "../../assets/icons/items/keyring.svg";
import pillowIcon from "../../assets/icons/items/pillow.svg";
import roundShieldIcon from "../../assets/icons/items/round-shield.svg";
import runeSwordIcon from "../../assets/icons/items/rune-sword.svg";
import scrollQuillIcon from "../../assets/icons/items/scroll-quill.svg";
import sewingStringIcon from "../../assets/icons/items/sewing-string.svg";
import sofaIcon from "../../assets/icons/items/sofa.svg";

export const characterProfiles: CharacterArchiveProfile[] = [
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
      bond: { level: 4, progress: 38, progressMax: 100, slots: 5 },
      statusChips: [
        { label: "前庭整备中", iconUrl: runeSwordIcon },
        { label: "战术表已备", iconUrl: scrollQuillIcon },
      ],
      pact: {
        name: "王权领域",
        iconUrl: eusticeDomainIcon,
        currentStage: 2,
        trigger: "同花成型时",
        currentTerm: "全队本回合格挡值 +1",
      },
      fields: [
        { label: "种族", value: "人类" },
        { label: "职能", value: "前线指挥官" },
        { label: "年龄", value: "18" },
        { label: "身高", value: "164cm" },
      ],
      traits: [
        {
          name: "王权领域：红莲战阵",
          iconUrl: eusticeDomainIcon,
          summary: "阵地强化 · 敌军压制",
          description:
            "将刺剑刺入地面，展开以阵位为核心的猩红战阵；友军获强化，敌人受压制，阵型越严整越稳定。",
        },
        {
          name: "定理剑术：红莲的轨迹",
          iconUrl: eusticeSwordIcon,
          summary: "弱点锁定 · 轨迹引爆",
          description:
            "以刺剑描出猩红剑轨，锁定防具与魔力薄弱处；残留轨迹会一同引爆，完成精准切割。",
        },
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
      bond: { level: 4, progress: 56, progressMax: 100, slots: 5 },
      statusChips: [
        { label: "温室晒药草", iconUrl: herbsBundleIcon },
        { label: "复核应急金", iconUrl: coinsPileIcon },
      ],
      pact: {
        name: "越限奇迹",
        iconUrl: eloraMiracleIcon,
        currentStage: 2,
        trigger: "三条成型时",
        currentTerm: "治疗生命最低的友方 2 点，并净化一项负面状态",
      },
      fields: [
        { label: "种族", value: "人类" },
        { label: "职能", value: "首席神官" },
        { label: "年龄", value: "15" },
        { label: "身高", value: "141cm" },
      ],
      traits: [
        {
          name: "神圣治愈：越限奇迹",
          iconUrl: eloraMiracleIcon,
          summary: "瞬发复原 · 神圣净化",
          description:
            "无需咏唱即可瞬发复原与净化奇迹，只要灵魂尚未消散便能挽回致命重创。",
        },
        {
          name: "重型威慑：星盘圣杖",
          iconUrl: eloraWandIcon,
          summary: "祈祷媒介 · 近身重击",
          description:
            "那把纯金星盘十字圣杖既是祈祷媒介，也是重型钝器；她能用意外的力气砸退绕后的偷袭者。",
        },
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
      bond: { level: 4, progress: 21, progressMax: 100, slots: 5 },
      statusChips: [
        { label: "房间补觉中", iconUrl: pillowIcon },
        { label: "拒绝今日打扫", iconUrl: sofaIcon },
      ],
      pact: {
        name: "渊星重压",
        iconUrl: kororoGravityIcon,
        currentStage: 2,
        trigger: "小顺成型时",
        currentTerm: "压住一枚敌方意图，使其延迟一回合且伤害 -1",
      },
      fields: [
        { label: "种族", value: "人类" },
        { label: "职能", value: "首席魔法使" },
        { label: "年龄", value: "16" },
        { label: "身高", value: "154cm" },
      ],
      traits: [
        {
          name: "星轨干涉：渊星重压",
          iconUrl: kororoGravityIcon,
          summary: "重力增幅 · 行动封锁",
          description:
            "拨动星盘便能令目标周遭重压骤增；她以极低消耗，让庞大敌人在无形压迫下失去行动能力。",
        },
        {
          name: "极效星法：微缩极星",
          iconUrl: kororoStarIcon,
          summary: "星芒凝缩 · 贯穿破防",
          description:
            "将流星雨的破坏力凝缩为拳大的星芒，以无声重压击穿重甲、结界与最棘手的障碍。",
        },
      ],
      record:
        "传统魔法世家的天才，为逃离高压期待而消极怠工，却在勇者小队选拔中随手打破纪录。凯尔给予的日常照料成了她最安心的归处，也令她开始和艾比希斯争夺沙发与注意力。",
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
      bond: { level: 3, progress: 84, progressMax: 100, slots: 5 },
      statusChips: [
        { label: "杂货铺砍价", iconUrl: coinsPileIcon },
        { label: "夜巡路线已藏", iconUrl: hoodIcon },
      ],
      pact: {
        name: "无音步",
        iconUrl: normaStealthIcon,
        currentStage: 2,
        trigger: "两对且含沉眠面时",
        currentTerm: "标记一枚敌方意图，本回合首次命中追加 2 点伤害",
      },
      fields: [
        { label: "种族", value: "亚人" },
        { label: "职能", value: "斥候与后勤联络员" },
        { label: "年龄", value: "18" },
        { label: "身高", value: "158cm" },
      ],
      traits: [
        {
          name: "黑街戏法：无限制武装",
          iconUrl: normaArsenalIcon,
          summary: "投掷武装 · 异常侵蚀",
          description:
            "腰包就是一座移动黑市：致盲粉、腐蚀酸液与淬毒飞刀齐备，专挑对手最难防的一面下手。",
        },
        {
          name: "死角潜行：无音步",
          iconUrl: normaStealthIcon,
          summary: "无声切入 · 要害收割",
          description:
            "将呼吸、心跳与脚步一并藏进阴影，从绝对死角切入要害后立刻脱离，把低风险收割贯彻到底。",
        },
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
      bond: { level: 5, progress: 100, progressMax: 100, slots: 5 },
      statusChips: [
        { label: "倚窗晒太阳", iconUrl: sofaIcon },
        { label: "等勇者回来", iconUrl: heartKeyIcon },
      ],
      pact: {
        name: "无冕之赦",
        iconUrl: abyssaPeaceIcon,
        currentStage: 3,
        trigger: "三面沉眠同时朝上时",
        currentTerm: "本回合免疫一次失手",
      },
      fields: [
        { label: "种族", value: "根源存在" },
        { label: "职能", value: "世界法则稳定器" },
        { label: "外观", value: "少女" },
        { label: "所在地", value: "魔王城" },
      ],
      traits: [
        {
          name: "我的平静",
          iconUrl: abyssaPeaceIcon,
          summary: "根源安定 · 潮汐抑制",
          description:
            "她的平静便是世界的安宁，如无形堤岸般挡住足以吞没一切的黑色潮汐。",
        },
        {
          name: "万象原生质",
          iconUrl: abyssaProtoplasmIcon,
          summary: "自在塑形 · 万象延伸",
          description:
            "令黑色原生质化作触手、衣装、屏障或其他所需形态；这是她无需起身也能贯彻意志的延伸。",
        },
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
      bond: { level: 3, progress: 31, progressMax: 100, slots: 5 },
      statusChips: [
        { label: "红线运转正常", iconUrl: sewingStringIcon },
        { label: "末轮巡视中", iconUrl: keyringIcon },
      ],
      pact: {
        name: "女仆长的领域",
        iconUrl: mariettaDomainIcon,
        currentStage: 2,
        trigger: "葫芦成型时",
        currentTerm: "重排本回合结算顺序，最先行动的友方获得 2 点格挡",
      },
      fields: [
        { label: "种族", value: "提线魔女 / 自律人偶" },
        { label: "职能", value: "内务与结界总管" },
        { label: "年龄", value: "外观14–15岁" },
        { label: "身高", value: "148cm" },
      ],
      traits: [
        {
          name: "万象操偶",
          iconUrl: mariettaPuppetIcon,
          summary: "万线操控 · 精密切割",
          description:
            "成千上万根红色魔力丝线既能完成无误差家政，也能切割钢铁、束缚敌人。",
        },
        {
          name: "结界：女仆长的领域",
          iconUrl: mariettaDomainIcon,
          summary: "全域感知 · 领地支配",
          description:
            "魔力红线渗入魔王城的砖石，令她感知并支配领地内的一切风吹草动；灰尘也无法越过她的规矩。",
        },
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
      bond: { level: 4, progress: 67, progressMax: 100, slots: 5 },
      statusChips: [
        { label: "塔顶警戒中", iconUrl: roundShieldIcon },
        {
          label: "长枪养护完成",
          iconUrl:
            "data:image/svg+xml,%3csvg%20xmlns='http://www.w3.org/2000/svg'%20viewBox='0%200%20512%20512'%20aria-hidden='true'%20focusable='false'%3e%3cpath%20fill='%23fff'%20d='M20.563%2020.844v44.593l73.124%2072.907c4.878-7.945%2010.962-15.65%2018.126-22.813%207.152-7.15%2014.825-13.194%2022.75-18.06L58.156%2020.843H20.563zm159.812%2081.062c-.566-.005-1.138.014-1.72.03-3.097.097-6.42.522-9.905%201.283-13.942%203.043-29.973%2011.753-43.75%2025.53-13.777%2013.777-22.487%2029.808-25.53%2043.75-2.905%2013.296-.81%2023.935%205.28%2030.78%205.4-20.354%2017.587-41.18%2035.594-59.186%2018.024-18.024%2038.876-30.203%2059.25-35.594-4.718-4.223-11.25-6.526-19.22-6.594zm40.47%2022.156c-3.977.096-8.19.624-12.595%201.563-17.62%203.755-37.603%2014.572-54.72%2031.688C136.417%20174.428%20125.6%20194.38%20121.845%20212c-3.755%2017.62-.633%2032.086%208.47%2041.188.905.906%201.894%201.744%202.905%202.53%204.635-31.49%2018.506-59.084%2039.436-80%2020.69-20.674%2047.894-34.465%2078.938-39.25-.678-.837-1.393-1.642-2.156-2.405-6.827-6.827-16.668-10.288-28.594-10zm55.343%2028.657c-36.56.167-68.017%2013.906-90.344%2036.218-2.24%202.24-4.375%204.58-6.438%207%2022.43%2011.654%2037.317%2026.57%2046.313%2043.062%2010.575%2019.392%2012.977%2040.393%2012.155%2060.03l-18.688-.78c.736-17.565-1.448-34.863-9.875-50.313-7.466-13.688-19.874-26.317-41.03-36.687-18.155%2029.68-24.497%2068.66-12.657%20111.844%2036.472%203.146%2072.888%2024.29%2086.375%2066.25%2045.025-6.375%20119.336%2026.557%20127.22%2064.25%2039.96%2018.477%2084.588%2033.368%20125.717%2045.094-11.33-35.873-24.38-81.097-40.718-116.97-34.53-21.506-49.702-62.82-46.626-106.343-40.336-30.105-70.18-69.518-74.78-112.625-19.782-6.95-38.806-10.113-56.627-10.03zm-9.532%2045.5c10.293%2052.54%2058.667%2086.17%20100.625%2093.718l-3.31%2018.375c-11.09-1.996-22.478-5.503-33.595-10.438-6.93%2019.615%201.34%2041.252%2019.75%2060%2019.638%2019.998%2050.412%2034.906%2081.094%2035.97l-.658%2018.686c-36.154-1.25-70.657-18.014-93.78-41.56-.98-1-1.936-2.004-2.876-3.033-15.47-12.362-27.615-16.12-38.47-15.5-10.918.624-21.598%206.012-33.03%2015.063l-11.594-14.656c13.043-10.327%2027.295-18.134%2043.563-19.063%206.378-.363%2012.9.373%2019.563%202.283-5.637-15.188-6.428-31.344-.25-46.813-31.03-18.508-57.392-48.844-65.344-89.438l18.312-3.593z'/%3e%3c/svg%3e",
        },
      ],
      pact: {
        name: "裂光阵线",
        iconUrl: alvitrOrderIcon,
        currentStage: 2,
        trigger: "大顺成型时",
        currentTerm: "抵消一枚敌方法术意图，并使全队获得 1 点格挡",
      },
      fields: [
        { label: "种族", value: "堕落女武神" },
        { label: "职能", value: "首席卫队长" },
        { label: "年龄", value: "外观少女" },
        { label: "身高", value: "159cm" },
      ],
      traits: [
        {
          name: "秩序残辉：裂光阵线",
          iconUrl: alvitrOrderIcon,
          summary: "节点击碎 · 法术解构",
          description:
            "以长枪精准击碎法术构造的核心节点，将高阶魔法强行打散、还原为无害微光。",
        },
        {
          name: "混沌异化：灰烬瞬步",
          iconUrl: alvitrChaosIcon,
          summary: "混沌跃迁 · 贯穿突袭",
          description:
            "借黑灰化作混沌粒子，无视距离与结界瞬跃；在敌人死角重新凝聚后，以长枪贯穿护盾。",
        },
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
      bond: { level: 3, progress: 62, progressMax: 100, slots: 5 },
      statusChips: [
        { label: "轻伤休养", detail: "2天", tone: "danger", icon: "wound" },
        { label: "闭门阅卷中", icon: "book" },
      ],
      pact: {
        name: "阿卡夏之锁",
        iconUrl: lenoreArchiveIcon,
        currentStage: 2,
        trigger: "两对成型时",
        currentTerm: "捆住一枚敌方意图延迟一回合，目标由你指定",
      },
      fields: [
        { label: "种族", value: "巫妖" },
        { label: "职能", value: "图书与情报部长" },
        { label: "年龄", value: "约千年" },
        { label: "身高", value: "143cm" },
      ],
      traits: [
        {
          name: "伴生魔灵：守墓者之腕",
          iconUrl: lenoreFamiliarIcon,
          summary: "自律骨手 · 防卫拘束",
          description:
            "自律白骨之手平日搬运、翻书、驱赶闯入者；遇袭时可巨大化为巨臂或骨牢，守住她的私人空间。",
        },
        {
          name: "死寂阵地：阿卡夏之锁",
          iconUrl: lenoreArchiveIcon,
          summary: "魔力封锁 · 符文增益",
          description:
            "书页在魂火中化作锁链与阵法，封锁敌人的魔力与发声；也能化作符文书页，为友军附加高阶增益。",
        },
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
      bond: { level: 2, progress: 74, progressMax: 100, slots: 5 },
      statusChips: [
        {
          label: "沙龙会客中",
          iconUrl:
            "data:image/svg+xml,%3csvg%20xmlns='http://www.w3.org/2000/svg'%20viewBox='0%200%20512%20512'%20aria-hidden='true'%20focusable='false'%3e%3cpath%20fill='%23fff'%20d='M133.99%2028v23.512h52.02V28h-52.02zm0%2041.51v90.705c-26.01%2017.34-43.347%2039.014-43.347%2056.353v260.735S90.64%20494%20107.98%20494h103.967c17.411%200%2017.41-17.34%2017.41-17.34V216.568c0-17.34-17.338-39.014-43.347-56.353V69.51h-52.02zM107%20252h106v162H107V252zm194.514%203l-2.051%206.154c-8.474%2025.423-12.793%2058.44-6.233%2086.87%203.28%2014.215%209.429%2027.45%2019.846%2037.273%208.61%208.118%2020.105%2013.533%2033.924%2015.172v74.64C327.601%20479.296%20302%20494%20302%20494h108s-25.601-14.705-45-18.89v-74.641c13.82-1.639%2025.314-7.054%2033.924-15.172%2010.417-9.822%2016.565-23.058%2019.846-37.274%206.56-28.43%202.241-61.446-6.233-86.869l-2.05-6.154H301.513zM125%20270v126h70V270h-70zm189.703%203h82.594c2.639%209.261%204.629%2019.565%205.68%2030h-93.954c1.051-10.435%203.041-20.739%205.68-30zm-6.486%2048h95.566c-.116%208.04-.907%2015.846-2.553%2022.977-2.72%2011.784-7.571%2021.548-14.654%2028.226C379.494%20378.881%20370.126%20383%20356%20383c-14.125%200-23.494-4.12-30.576-10.797-7.083-6.678-11.935-16.442-14.654-28.226-1.646-7.131-2.437-14.938-2.553-22.977z'/%3e%3c/svg%3e",
        },
        { label: "公库账单待批", iconUrl: scrollQuillIcon },
      ],
      pact: {
        name: "猩红帷幕",
        iconUrl: vivienneCurtainIcon,
        currentStage: 2,
        trigger: "四条成型时",
        currentTerm: "令一枚敌方意图失去目标，并附加一回合虚弱",
      },
      fields: [
        { label: "种族", value: "高阶吸血鬼" },
        { label: "职能", value: "外务大臣" },
        { label: "年龄", value: "漫长寿命" },
        { label: "身高", value: "165cm" },
      ],
      traits: [
        {
          name: "荆棘与血蔷薇",
          iconUrl: vivienneRoseIcon,
          summary: "生命汲取 · 荆棘花雨",
          description:
            "以周遭液体或魔力结晶出猩红蔷薇与荆棘；花雨锋利，并会抽取目标的生命力。",
        },
        {
          name: "猩红帷幕",
          iconUrl: vivienneCurtainIcon,
          summary: "五感扰乱 · 认知支配",
          description:
            "以阴影或大衣化作血色帷幕，将区域拖入她支配的剧场，任意扰乱敌人的五感与认知。",
        },
      ],
      record:
        "出身古老纯血氏族，却用筹码与秘密取代粗鄙统治，在人类权贵间织成情报与利益网。担任魔王城外务大臣后，她更愿在谈判桌上瓦解敌对同盟。",
    },
  },
];
