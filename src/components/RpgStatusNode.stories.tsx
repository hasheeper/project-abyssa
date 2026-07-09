import type { Meta, StoryObj } from "@storybook/react-vite";
import { RpgStatusNode } from "./RpgStatusNode";

const meta = { title: "Display/RpgStatusNode", component: RpgStatusNode, args: { label: "已确认", icon: "check", variant: "dark" } } satisfies Meta<typeof RpgStatusNode>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Disabled: Story = { args: { label: "不可用", icon: "close", variant: "disabled" } };
export const Dark: Story = {};
export const Teal: Story = { args: { label: "已选中", variant: "teal" } };
