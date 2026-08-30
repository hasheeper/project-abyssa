import type { Meta, StoryObj } from "@storybook/react-vite";
import { RpgDialogue } from "./RpgDialogue";

const meta = { title: "Structure/RpgDialogue", component: RpgDialogue, args: { name: "Abyssa", text: "……太阳的光，感觉舒服的时候，就醒了。\n这里的阳光，味道最好。" }, parameters: { layout: "padded" } } satisfies Meta<typeof RpgDialogue>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Dark: Story = {};
export const LightShell: Story = { args: { variant: "light", name: "name tag", text: "" } };
