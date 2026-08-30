import type { Meta, StoryObj } from "@storybook/react-vite";
import { RpgCheckbox, RpgRadio } from "./RpgChoice";

const meta = {
  title: "Actions/RpgChoice",
  component: RpgRadio,
  args: { label: "暗色主题", name: "theme", variant: "dark", defaultChecked: true },
  argTypes: { variant: { control: "inline-radio", options: ["gray", "dark", "teal"] } }
} satisfies Meta<typeof RpgRadio>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Radio: Story = {};
export const Checkbox: Story = {
  render: () => <RpgCheckbox label="启用选项" variant="teal" defaultChecked />
};
