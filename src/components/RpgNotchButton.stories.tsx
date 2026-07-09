import type { Meta, StoryObj } from "@storybook/react-vite";
import { RpgNotchButton } from "./RpgNotchButton";

const meta = { title: "Actions/RpgNotchButton", component: RpgNotchButton, args: { label: "上传" } } satisfies Meta<typeof RpgNotchButton>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Dark: Story = {};
export const Light: Story = { args: { variant: "light" } };
export const Teal: Story = { args: { variant: "teal" } };
