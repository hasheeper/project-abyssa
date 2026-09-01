import { resolve } from "node:path";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

/* 标题画面会跳向 menu.html,所以两者必须同产物目录才点得通 ——
   同源相对 URL 是仓库唯一的跨页手段(没有 Router)。
   与 vite.mansion.config.ts 把下游页一起纳入 input 是同一个理由。 */
export default defineConfig({
  base: "./",
  plugins: [react()],
  server: { host: "127.0.0.1", port: 5182, open: "/title.html" },
  build: {
    outDir: "title-dist",
    emptyOutDir: true,
    rollupOptions: {
      input: {
        title: resolve(import.meta.dirname, "title.html"),
        menu: resolve(import.meta.dirname, "menu.html")
      }
    }
  }
});
