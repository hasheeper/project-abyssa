import type { Meta, StoryObj } from "@storybook/react-vite";
import { RpgHeader } from "./RpgHeader";

const meta = {
  title: "Display/RpgHeader",
  component: RpgHeader,
  args: {
    label: "HEADER",
    variant: "dark"
  },
  argTypes: {
    variant: {
      control: "inline-radio",
      options: ["dark", "light", "teal"]
    }
  },
  decorators: [
    (Story) => (
      <div className="abyssa-theme" style={{ width: 820 }}>
        <Story />
      </div>
    )
  ]
} satisfies Meta<typeof RpgHeader>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Dark: Story = {};
export const Light: Story = { args: { variant: "light" } };
export const Teal: Story = { args: { variant: "teal" } };
