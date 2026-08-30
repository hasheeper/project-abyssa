import type { CharacterProfile } from "../ui/patterns/CharacterStatusScreen";

/** Minimal UI fixture. Project roster assertions belong to content tests. */
export const characterStatusFixture: CharacterProfile[] = [
  {
    id: "eustice",
    number: "00",
    name: "尤斯缇丝·格里芬",
    secondaryName: "EUSTICE GRIFFIN",
    selectorVariant: "gray",
    portraitUrl: "/fixtures/eustice.png",
    portraitAlt: "尤斯缇丝·格里芬角色立绘",
    appearanceLabel: "冒险的样子",
    thumbnailUrl: "/fixtures/eustice-avatar.png",
    thumbnailAlt: "尤斯缇丝·格里芬头像",
    status: {
      title: "红莲剑姬",
      affiliation: {
        label: "勇者小队",
        secondaryLabel: "HERO PARTY",
        tone: "hero-party"
      }
    }
  },
  {
    id: "abyssa",
    number: "04",
    name: "艾比希斯·贝尔泽兰",
    secondaryName: "ABYSSA BEELZERAN",
    selectorVariant: "dark",
    portraitUrl: "/fixtures/abyssa.png",
    portraitAlt: "艾比希斯·贝尔泽兰角色立绘",
    appearanceLabel: "原生的样子",
    thumbnailUrl: "/fixtures/abyssa-avatar.png",
    thumbnailAlt: "艾比希斯·贝尔泽兰头像",
    outfits: [
      {
        id: "native",
        label: "原生质睡衣",
        displayLabel: "00",
        appearanceLabel: "原生的样子",
        portraitUrl: "/fixtures/abyssa-native.png",
        portraitAlt: "艾比希斯·贝尔泽兰原生质睡衣立绘"
      },
      {
        id: "gothic",
        label: "哥特礼服",
        displayLabel: "01",
        appearanceLabel: "礼服的样子",
        portraitUrl: "/fixtures/abyssa-gothic.png",
        portraitAlt: "艾比希斯·贝尔泽兰哥特礼服立绘"
      }
    ],
    status: {
      title: "无垢幼魔",
      titleRootIndex: 2,
      affiliation: {
        label: "魔王",
        secondaryLabel: "DEMON LORD",
        tone: "demon-lord"
      }
    }
  },
  {
    id: "vivienne",
    number: "08",
    name: "薇薇安·桑格温",
    secondaryName: "VIVIENNE SANGUINE",
    selectorVariant: "gray",
    portraitUrl: "/fixtures/vivienne.png",
    portraitAlt: "薇薇安·桑格温角色立绘",
    appearanceLabel: "社交的样子",
    thumbnailUrl: "/fixtures/vivienne-avatar.png",
    thumbnailAlt: "薇薇安·桑格温头像",
    status: {
      title: "血宴女爵",
      affiliation: {
        label: "魔王干部",
        secondaryLabel: "DEMON LORD'S CADRE",
        tone: "demon-cadre"
      }
    }
  }
];
