import { resolve } from "node:path";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  base: "./",
  plugins: [react()],
  build: {
    outDir: "map-dist",
    emptyOutDir: true,
    // WebGLRenderer dominates the Three.js chunk in r128. Keep a narrow,
    // explicit allowance while warning on any renewed growth beyond it.
    chunkSizeWarningLimit: 520,
    rollupOptions: {
      input: resolve(import.meta.dirname, "map.html"),
      output: {
        manualChunks(id) {
          if (id.includes("/node_modules/three/")) return "three";
          if (id.includes("/node_modules/gsap/")) return "gsap";
          if (id.includes("/node_modules/")) return "vendor";
        }
      }
    }
  }
});
