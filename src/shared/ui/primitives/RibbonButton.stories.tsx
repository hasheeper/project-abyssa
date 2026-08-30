import type { Meta, StoryObj } from "@storybook/react-vite";
import { RibbonButton } from "./RibbonButton";

const meta = {
  title: "Controls/RibbonButton",
  component: RibbonButton,
  args: {
    children: "Select Button",
    variant: "dark",
    size: "md"
  },
  argTypes: {
    variant: { control: "inline-radio", options: ["dark", "light", "teal"] },
    size: { control: "inline-radio", options: ["sm", "md", "lg"] }
  },
  decorators: [(Story) => <div className="abyssa-theme" style={{ width: 720 }}><Story /></div>]
} satisfies Meta<typeof RibbonButton>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {};
export const Selected: Story = { args: { variant: "teal", selected: true } };
export const Disabled: Story = { args: { disabled: true } };
