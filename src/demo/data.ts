import type { CharacterProfile } from "../components/CharacterStatusScreen";

export const demoCharacters: CharacterProfile[] = [
  {
    id: "kael",
    number: "01",
    name: "凯尔",
    secondaryName: "KAEL · THE WARDEN",
    selectorVariant: "dark",
    status: {
      title: "凯尔",
      subtitle: "THE LAST WARDEN",
      state: "稳定",
      fields: [
        { label: "种族", value: "人类" },
        { label: "职能", value: "守望者" },
        { label: "所在地", value: "北境边墙" }
      ],
      stats: [
        { label: "力量", value: "A" },
        { label: "耐久", value: "A" },
        { label: "敏捷", value: "B" },
        { label: "魔力", value: "C" },
        { label: "幸运", value: "B" },
        { label: "领域", value: "A+", accent: true }
      ],
      traits: [
        { name: "边境誓约", description: "在防守与护卫行动中保持绝对专注。" },
        { name: "不屈", description: "伤势不会立刻削弱行动能力。" }
      ],
      record: "旧王国最后一位守望者，沉默地记录着边境之外的潮汐。",
      quote: "城墙会倾倒，誓言不会。"
    }
  },
  {
    id: "eustia",
    number: "02",
    name: "尤斯缇丝",
    secondaryName: "EUSTIA · STAR READER",
    selectorVariant: "gray",
    status: {
      title: "尤斯缇丝",
      subtitle: "THE STAR READER",
      state: "观测中",
      fields: [
        { label: "种族", value: "星裔" },
        { label: "职能", value: "占星术士" },
        { label: "所在地", value: "无光塔" }
      ],
      stats: [
        { label: "力量", value: "D" },
        { label: "耐久", value: "C" },
        { label: "敏捷", value: "B" },
        { label: "魔力", value: "EX", accent: true },
        { label: "幸运", value: "A" },
        { label: "领域", value: "A" }
      ],
      traits: [
        { name: "星图记忆", description: "能够复现曾经观测过的所有星轨。" },
        { name: "静默预言", description: "预言只以梦境和符号显现。" }
      ],
      record: "她在没有星空的年代继续绘制星图，仿佛那些光仍然存在。",
      quote: "我们看见的不是未来，只是未来留下的倒影。"
    }
  },
  {
    id: "abyssa",
    number: "06",
    name: "艾比希斯",
    secondaryName: "ABYSSA · BEELZERAN",
    selectorVariant: "teal-outline",
    status: {
      title: "艾比希斯",
      subtitle: "ABYSSA · BEELZERAN",
      state: "稳定性 83%",
      fields: [
        { label: "种族", value: "根源存在" },
        { label: "职能", value: "混沌容器" },
        { label: "躯壳", value: "人类" },
        { label: "所在地", value: "守望者之崖" }
      ],
      stats: [
        { label: "力量", value: "EX", accent: true },
        { label: "耐久", value: "EX", accent: true },
        { label: "敏捷", value: "EX", accent: true },
        { label: "魔力", value: "EX", accent: true },
        { label: "幸运", value: "D" },
        { label: "领域", value: "A" }
      ],
      traits: [
        { name: "我的平静", description: "以近乎静止的方式容纳不断扩张的混沌。" },
        { name: "万象原生质", description: "形态与属性会回应观察者的认知。" },
        { name: "静谧之楔", description: "锚定周围空间，抑制异常扩散。" }
      ],
      record: "被记录为深渊本身的投影。她仍以人的名字生活，并拒绝所有预设的结局。",
      quote: "若深渊凝视你，那或许只是我在确认你仍然存在。"
    }
  }
];
