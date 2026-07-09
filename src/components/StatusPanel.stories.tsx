import type { Meta, StoryObj } from "@storybook/react-vite";
import { StatusPanel } from "./StatusPanel";

const meta = {
  title: "Display/StatusPanel",
  component: StatusPanel,
  args: {
    data: {
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
  },
  decorators: [
    (Story) => (
      <div className="abyssa-theme" style={{ width: 598, minHeight: 495 }}>
        <Story />
      </div>
    )
  ]
} satisfies Meta<typeof StatusPanel>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Reference: Story = {};
