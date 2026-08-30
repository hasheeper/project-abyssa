import type { Meta, StoryObj } from "@storybook/react-vite";
import { Nameplate } from "./Nameplate";

const meta = {
  title: "Display/Nameplate",
  component: Nameplate,
  args: {
    name: "艾比希斯·贝尔泽兰",
    secondaryName: "ABYSSA BEELZERAN",
    variant: "dark"
  },
  argTypes: {
    variant: { control: "inline-radio", options: ["dark", "light", "teal"] }
  },
  decorators: [
    (Story) => (
      <div className="abyssa-theme" style={{ width: 354 }}>
        <Story />
      </div>
    )
  ]
} satisfies Meta<typeof Nameplate>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Reference: Story = {};
export const Teal: Story = { args: { variant: "teal" } };
