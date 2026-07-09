import type { Meta, StoryObj } from "@storybook/react-vite";
import { RpgDiamondNodeTrack } from "./RpgDiamondNodeTrack";

const items = [{ id: "left", label: "左侧" }, { id: "center", label: "中间" }, { id: "right", label: "右侧", variant: "teal" as const }];
const meta = { title: "Actions/RpgDiamondNodeTrack", component: RpgDiamondNodeTrack, args: { items, defaultValue: "center" } } satisfies Meta<typeof RpgDiamondNodeTrack>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Default: Story = {};
