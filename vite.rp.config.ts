import { resolve } from "node:path";
import react from "@vitejs/plugin-react";
import { transform } from "esbuild";
import { defineConfig } from "vite";
import type { Plugin } from "vite";

// 业务代码保持可读,React 运行时无需阅读,单独压缩。
function minifyVendorOnly(): Plugin {
  return {
    name: "minify-vendor-only",
    enforce: "post",
    apply: "build",
    async renderChunk(code, chunk) {
      if (chunk.name !== "vendor") return null;
      const { code: minified } = await transform(code, { minify: true, target: "es2020" });
      return { code: minified, map: null };
    }
  };
}

export default defineConfig({
  root: import.meta.dirname,
  base: "./",
  plugins: [react(), minifyVendorOnly()],
  server: {
    host: "127.0.0.1",
    port: 5175
  },
  build: {
    outDir: resolve(import.meta.dirname, "rp-dist"),
    emptyOutDir: true,
    minify: false,
    cssMinify: false,
    modulePreload: { polyfill: false },
    reportCompressedSize: false,
    rollupOptions: {
      input: resolve(import.meta.dirname, "rp.html"),
      output: {
        entryFileNames: "assets/[name].js",
        chunkFileNames: "assets/[name].js",
        assetFileNames: "assets/[name][extname]",
        manualChunks(id) {
          if (id.includes("node_modules")) return "vendor";
        }
      }
    }
  }
});
