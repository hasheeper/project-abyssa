import type { Meta, StoryObj } from "@storybook/react-vite";
import { RpgSquarePanel } from "./RpgSquarePanel";

const meta = {
  title: "Controls/RpgSquarePanel",
  component: RpgSquarePanel,
  args: {
    number: "06",
    variant: "teal",
    "aria-label": "小面板 06"
  },
  argTypes: {
    variant: {
      control: "inline-radio",
      options: ["dark", "gray", "deep", "teal", "teal-outline", "light"]
    }
  },
  decorators: [
    (Story) => (
      <div className="abyssa-theme" style={{ width: 116 }}>
        <Story />
      </div>
    )
  ]
} satisfies Meta<typeof RpgSquarePanel>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {};
export const Selected: Story = {
  args: { variant: "teal-outline", selected: true }
};
