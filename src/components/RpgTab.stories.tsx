import type { Meta, StoryObj } from "@storybook/react-vite";
import { RpgTab } from "./RpgTab";

const meta = {
  title: "Actions/RpgTab",
  component: RpgTab,
  args: { label: "Archive", variant: "decorated", selected: false },
  argTypes: {
    variant: { control: "inline-radio", options: ["dark", "light", "decorated", "teal"] }
  },
  decorators: [(Story) => <div style={{ width: 180, borderBottom: "5px solid #192020" }}><Story /></div>]
} satisfies Meta<typeof RpgTab>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Reference: Story = {};
export const Selected: Story = { args: { selected: true, variant: "teal" } };
