import type { Meta, StoryObj } from "@storybook/react-vite";
import { IconButton } from "./IconButton";

const meta = {
  title: "Actions/IconButton",
  component: IconButton,
  args: { label: "增加", icon: "plus", shape: "circle", variant: "dark", size: "lg" },
  argTypes: {
    icon: { control: "inline-radio", options: ["close", "plus", "minus"] },
    shape: { control: "inline-radio", options: ["diamond", "circle"] },
    variant: { control: "inline-radio", options: ["dark", "light", "teal"] },
    size: { control: "inline-radio", options: ["sm", "md", "lg"] }
  }
} satisfies Meta<typeof IconButton>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Regular: Story = {};
export const Compact: Story = { args: { size: "md" } };
export const CloseDiamond: Story = { args: { label: "关闭", icon: "close", shape: "diamond" } };
