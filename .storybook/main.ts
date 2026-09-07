import type { StorybookConfig } from "@storybook/react-vite";

const config: StorybookConfig = {
  stories: ["../src/**/*.stories.@(ts|tsx)"],
  addons: ["@storybook/addon-a11y"],
  staticDirs: [
    { from: "../src/assets/characters/paper-dolls", to: "/character-art" },
    { from: "../src/assets/emote", to: "/emote-art" }
  ],
  viteFinal: async (config) => ({
    ...config,
    define: {
      ...config.define,
      "import.meta.env.VITE_PAPER_DOLL_BASE_URL": JSON.stringify("./character-art/"),
      "import.meta.env.VITE_EMOTE_BASE_URL": JSON.stringify("./emote-art/")
    }
  }),
  framework: {
    name: "@storybook/react-vite",
    options: {}
  },
  docs: {
    autodocs: "tag"
  }
};

export default config;
