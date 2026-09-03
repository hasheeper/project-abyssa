import { resolve } from "node:path";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  base: "./",
  plugins: [react()],
  // 5188:5173(battle/catalog)、5185(character-status)、5186(map)、5187
  // (party-figure-studio)之后的第一个空位。不写 server 段会默认落回 5173 抢端口。
  server: { port: 5188 },
  build: {
    outDir: "settings-dist",
    emptyOutDir: true,
    rollupOptions: {
      input: resolve(import.meta.dirname, "settings.html")
    }
  }
});
