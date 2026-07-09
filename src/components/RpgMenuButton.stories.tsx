import type { Meta, StoryObj } from "@storybook/react-vite";
import { RpgMenuButton } from "./RpgMenuButton";

const meta = {
  title: "Controls/RpgMenuButton",
  component: RpgMenuButton,
  args: {
    children: "状态",
    secondaryLabel: "STATUS",
    variant: "dark"
  },
  argTypes: {
    variant: {
      control: "inline-radio",
      options: ["dark", "light", "teal"]
    }
  },
  decorators: [
    (Story) => (
      <div className="abyssa-theme" style={{ width: 280 }}>
        <Story />
      </div>
    )
  ]
} satisfies Meta<typeof RpgMenuButton>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Dark: Story = {};
export const Selected: Story = {
  args: { variant: "teal", selected: true }
};
