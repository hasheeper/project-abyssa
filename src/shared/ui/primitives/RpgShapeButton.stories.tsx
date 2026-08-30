import type { Meta, StoryObj } from "@storybook/react-vite";
import { RpgShapeButton } from "./RpgShapeButton";

const meta = {
  title: "Actions/RpgShapeButton",
  component: RpgShapeButton,
  args: { label: "Button", shape: "chamfer", variant: "dark" },
  argTypes: {
    shape: { control: "inline-radio", options: ["circle", "square", "chamfer", "pill"] },
    variant: { control: "inline-radio", options: ["dark", "light", "teal"] }
  }
} satisfies Meta<typeof RpgShapeButton>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Reference: Story = {};
export const Circle: Story = { args: { shape: "circle" } };
export const Square: Story = { args: { shape: "square" } };
export const Pill: Story = { args: { shape: "pill", variant: "teal" } };
