import { resolve } from "node:path";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  base: "./",
  plugins: [react()],
  server: {
    host: "127.0.0.1",
    port: 5173
  },
  build: {
    outDir: "battle-dist",
    emptyOutDir: true,
    rollupOptions: {
      input: resolve(import.meta.dirname, "battle.html")
    }
  }
});
