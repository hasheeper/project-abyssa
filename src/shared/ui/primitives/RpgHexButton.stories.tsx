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
    size: { control: "inline-radio", options: ["sm", "md", "lg"] }
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
