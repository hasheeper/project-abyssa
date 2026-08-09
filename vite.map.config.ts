import { resolve } from "node:path";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  base: "./",
  plugins: [react()],
  build: {
    outDir: "map-dist",
    emptyOutDir: true,
    rollupOptions: { input: resolve(import.meta.dirname, "map.html") }
  }
});
