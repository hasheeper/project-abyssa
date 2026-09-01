import { resolve } from "node:path";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  base: "./",
  plugins: [react()],
  // 原先没有 server 段,默认落在 5173,与 dev(catalog)/dev:battle 抢端口。
  server: { port: 5185 },
  build: {
    outDir: "character-status-dist",
    emptyOutDir: true,
    rollupOptions: {
      input: resolve(import.meta.dirname, "character-status.html")
    }
  }
});
