import type { Meta, StoryObj } from "@storybook/react-vite";
import { RpgNotchedPillButton } from "./RpgNotchedPillButton";

const meta = { title: "Actions/RpgNotchedPillButton", component: RpgNotchedPillButton, args: { label: "Auto" } } satisfies Meta<typeof RpgNotchedPillButton>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Dark: Story = {};
export const Light: Story = { args: { variant: "light" } };
export const Teal: Story = { args: { variant: "teal" } };
