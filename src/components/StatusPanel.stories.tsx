import type { Meta, StoryObj } from "@storybook/react-vite";
import { StatusPanel } from "./StatusPanel";

const meta = {
  title: "Display/StatusPanel",
  component: StatusPanel,
  args: {
    data: {
      title: "无冕幼神",
      subtitle: "THE CROWNLESS YOUNG GOD",
      affiliation: { label: "魔王", secondaryLabel: "DEMON LORD", tone: "demon-lord" },
      state: "状态：安定",
      fields: [
        { label: "种族", value: "根源存在" },
        { label: "职能", value: "世界法则稳定器" },
        { label: "外观", value: "少女" },
        { label: "所在地", value: "魔王城" }
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
        { name: "我的平静", description: "她的平静便是世界的安宁，如无形堤岸般挡住黑色潮汐。" },
        { name: "万象原生质", description: "令黑色原生质化作触手、衣装、屏障或其他所需形态。" }
      ],
      record: "灰石村的少女被献入黑色裂隙，根源之力填满躯壳，成为大天平选中的当代魔王。四天王将她带回魔王城；如今那里是她无需解释的“家”。",
      quote: "唔……太阳照在身上的时候，就醒了。……然后晒太阳。"
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
