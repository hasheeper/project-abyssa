import { copyFile } from "node:fs/promises";
import { resolve } from "node:path";
import react from "@vitejs/plugin-react";
import { defineConfig, type Plugin } from "vite";

export default defineConfig({
  base: "./",
  plugins: [diceEntry(), react(), diceBuildIndex()],
  server: {
    proxy: {
      "/api": "http://127.0.0.1:8787",
    },
  },
  build: {
    outDir: "dice-dist",
    emptyOutDir: true,
    rollupOptions: { input: resolve(import.meta.dirname, "dice.html") },
  },
});

function diceEntry(): Plugin {
  const redirectRoot = (): Plugin["configureServer"] => (server) => {
    server.middlewares.use((request, response, next) => {
      if (request.url !== "/" && !request.url?.startsWith("/?")) {
        next();
        return;
      }
      response.statusCode = 302;
      response.setHeader(
        "location",
        `/dice.html${request.url?.slice(1) ?? ""}`,
      );
      response.end();
    });
  };

  return {
    name: "lumen-dice-entry",
    configureServer: redirectRoot(),
    configurePreviewServer: redirectRoot(),
  };
}

function diceBuildIndex(): Plugin {
  const outputDirectory = resolve(import.meta.dirname, "dice-dist");
  return {
    name: "lumen-dice-build-index",
    apply: "build",
    async closeBundle() {
      await copyFile(
        resolve(outputDirectory, "dice.html"),
        resolve(outputDirectory, "index.html"),
      );
    },
  };
}
