import type { Meta, StoryObj } from "@storybook/react-vite";
import { demoCharacters } from "../demo/data";
import { CharacterStatusScreen } from "./CharacterStatusScreen";

const meta = {
  title: "Compositions/CharacterStatusScreen",
  component: CharacterStatusScreen,
  parameters: { layout: "fullscreen" },
  args: {
    characters: demoCharacters,
    defaultSelectedId: "abyssa"
  },
  decorators: [
    (Story) => (
      <div className="abyssa-theme" style={{ minHeight: "100vh", padding: 40, background: "#98a7a9" }}>
        <Story />
      </div>
    )
  ]
} satisfies Meta<typeof CharacterStatusScreen>;

export default meta;
type Story = StoryObj<typeof meta>;
export const Default: Story = {};
export const WithoutOutfits: Story = {
  args: { defaultSelectedId: "eustice" }
};
