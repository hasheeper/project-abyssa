import { resolve } from "node:path";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  base: "./",
  plugins: [react()],
  build: {
    outDir: "menu-dist",
    emptyOutDir: true,
    rollupOptions: {
      /* 黑幕接力只做同源相对跳转,目标页必须一起打进产物,
         否则 navigate("./character-status.html") 在构建版落到 404。 */
      input: [
        resolve(import.meta.dirname, "menu.html"),
        resolve(import.meta.dirname, "character-status.html")
      ]
    }
  }
});
