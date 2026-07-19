import type { Meta, StoryObj } from "@storybook/react-vite";
import { RpgDirectionPad } from "./RpgDirectionPad";

const meta = {
  title: "Controls/RpgDirectionPad",
  component: RpgDirectionPad,
  args: { label: "MOVE", defaultValue: "up", variant: "teal", size: "md" },
  argTypes: {
    variant: { control: "inline-radio", options: ["teal", "dark", "light"] },
    size: { control: "inline-radio", options: ["sm", "md", "lg"] }
  },
  decorators: [
    (Story) => (
      <div className="abyssa-theme" style={{ display: "grid", minHeight: 440, padding: 40, placeItems: "center" }}>
        <Story />
      </div>
    )
  ]
} satisfies Meta<typeof RpgDirectionPad>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {};
export const Dark: Story = { args: { variant: "dark", defaultValue: "left" } };
export const Disabled: Story = { args: { disabled: true, defaultValue: "down" } };
