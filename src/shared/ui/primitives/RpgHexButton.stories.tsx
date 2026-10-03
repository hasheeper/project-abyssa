import type { Meta, StoryObj } from "@storybook/react-vite";
import { RpgHexButton } from "./RpgHexButton";

const meta = {
  title: "Controls/RpgHexButton",
  component: RpgHexButton,
  args: {
    children: "Load Game",
    variant: "teal",
    size: "md"
  },
  argTypes: {
    variant: { control: "inline-radio", options: ["dark", "light", "teal"] },
    size: { control: "inline-radio", options: ["sm", "md", "lg"] },
    layout: { control: "inline-radio", options: ["wide", "compact"] }
  },
  decorators: [
    (Story) => (
      <div className="abyssa-theme" style={{ width: 820 }}>
        <Story />
      </div>
    )
  ]
} satisfies Meta<typeof RpgHexButton>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {};
export const Dark: Story = { args: { variant: "dark" } };
export const Light: Story = { args: { variant: "light" } };
export const Disabled: Story = { args: { disabled: true } };
export const Compact: Story = { args: { layout: "compact", children: "完成编队" } };
