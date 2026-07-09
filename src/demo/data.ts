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
    name: "艾比希斯·贝尔泽兰",
    secondaryName: "ABYSSA BEELZERAN",
    selectorVariant: "teal-outline",
    status: {
      title: "当代魔王",
      subtitle: "THE VESSEL OF CHAOS",
      state: "状态：安定",
      fields: [
        { label: "种族", value: "根源存在" },
        { label: "职能", value: "混沌容器" },
        { label: "躯壳", value: "人类" },
        { label: "所在地", value: "守望者之崖" }
      ],
      stats: [
        { label: "生命", secondaryLabel: "LIFE", value: "EX", accent: true },
        { label: "源力", secondaryLabel: "MANA", value: "EX", accent: true },
        { label: "力量", secondaryLabel: "POWER", value: "EX", accent: true },
        { label: "抗性", secondaryLabel: "WARD", value: "EX", accent: true },
        { label: "敏捷", secondaryLabel: "AGILITY", value: "D" },
        { label: "控制", secondaryLabel: "CONTROL", value: "A" }
      ],
      traits: [
        { name: "我的平静", description: "作为容纳混沌的堤岸，维持周围源力与现实结构的稳定。" },
        { name: "万象原生质", description: "操纵由自身延伸出的黑色原生质，使其化为触手、衣装或屏障。" },
        { name: "静谧之楔", description: "凯尔在场时，混沌波动受到持续中和，安定状态大幅提升。" }
      ],
      record: "大天平指定的当代魔王，也是容纳现世灾厄的活体器皿。她平日慵懒而寡言，以直觉和感官理解世界，对阳光、安静的环境，以及凯尔平稳的体温抱有明显依赖。",
      quote: "太阳的光，感觉舒服的时候，就醒了。这里的阳光，味道最好。"
    }
  }
];
