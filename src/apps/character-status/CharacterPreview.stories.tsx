import type { Meta, StoryObj } from "@storybook/react-vite";
import { CharacterPreview } from "./CharacterPreview";
import "./app.css";
import "../../shared/stage/stage.css";
const meta = {
  title: "Scenes/Character archive sample",
  component: CharacterPreview,
  parameters: { layout: "fullscreen" },
} satisfies Meta<typeof CharacterPreview>;
export default meta;
export const Sample: StoryObj<typeof meta> = {};
