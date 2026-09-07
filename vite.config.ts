import { defineConfig } from "vite";
import { createTargetConfig } from "./config/vite/create-config.mjs";

// Direct Vite remains supported; npm scripts use the same target factory.
export default defineConfig(({ command }) =>
  createTargetConfig(command === "build" ? "ui" : "entry:catalog")
);
