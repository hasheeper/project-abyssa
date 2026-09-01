import { resolve } from "node:path";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  root: import.meta.dirname,
  base: "./",
  plugins: [react()],
  server: { host: "127.0.0.1", port: 5184, open: "/dice-studio.html" },
  build: {
    outDir: resolve(import.meta.dirname, "dice-studio-dist"),
    emptyOutDir: true,
    rollupOptions: { input: resolve(import.meta.dirname, "dice-studio.html") }
  }
});
