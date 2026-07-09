import type { Preview } from "@storybook/react-vite";
import "../src/styles/index.css";
import "../src/demo/demo.css";

const preview: Preview = {
  parameters: {
    controls: { expanded: true },
    layout: "centered",
    backgrounds: {
      default: "abyssa",
      values: [
        { name: "abyssa", value: "#95a5a7" },
        { name: "night", value: "#111717" }
      ]
    }
  },
  tags: ["autodocs"]
};

export default preview;
