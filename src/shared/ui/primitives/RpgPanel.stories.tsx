import type { Meta, StoryObj } from "@storybook/react-vite";
import { RpgPanel } from "./RpgPanel";

const meta = {
  title: "Controls/RpgPanel",
  component: RpgPanel,
  args: {
    number: "06",
    variant: "teal",
    "aria-label": "角色 06"
  },
  decorators: [(Story) => <div className="abyssa-theme" style={{ width: 180 }}><Story /></div>]
} satisfies Meta<typeof RpgPanel>;

export default meta;
type Story = StoryObj<typeof meta>;
export const Playground: Story = {};
export const Selected: Story = { args: { selected: true } };
