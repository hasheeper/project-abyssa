import type { Meta, StoryObj } from "@storybook/react-vite";
import { VerticalIndicator } from "./VerticalIndicator";

const meta = {
  title: "Display/VerticalIndicator",
  component: VerticalIndicator,
  args: { variant: "dark", label: "纵向指示器" },
  argTypes: { variant: { control: "inline-radio", options: ["dark", "light", "teal"] } }
} satisfies Meta<typeof VerticalIndicator>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Reference: Story = {};
export const Light: Story = { args: { variant: "light" } };
export const Teal: Story = { args: { variant: "teal" } };
