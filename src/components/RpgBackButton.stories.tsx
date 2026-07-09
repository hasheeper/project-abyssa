import type { Meta, StoryObj } from "@storybook/react-vite";
import { RpgBackButton } from "./RpgBackButton";

const meta = {
  title: "Actions/RpgBackButton",
  component: RpgBackButton,
  args: { label: "Back", variant: "dark" },
  argTypes: { variant: { control: "inline-radio", options: ["dark", "light", "teal"] } }
} satisfies Meta<typeof RpgBackButton>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Reference: Story = {};
export const Light: Story = { args: { variant: "light" } };
export const Teal: Story = { args: { variant: "teal" } };
