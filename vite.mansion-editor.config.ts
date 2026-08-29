import { resolve } from "node:path";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  base: "./",
  plugins: [react()],
  build: {
    outDir: "mansion-editor-dist",
    emptyOutDir: true,
    rollupOptions: { input: resolve(import.meta.dirname, "mansion-editor.html") }
  }
});
