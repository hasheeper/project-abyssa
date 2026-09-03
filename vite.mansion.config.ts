import { cp } from "node:fs/promises";
import { resolve } from "node:path";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import type { Plugin } from "vite";

const MANSION_CHARACTER_IDS = [
  "abyssa",
  "alvitr",
  "marietta",
  "lenore",
  "vivienne",
  "eustice",
  "norma",
  "elora",
  "kororo",
  "tibby"
] as const;

function copyMansionCharacterArt(): Plugin {
  return {
    name: "copy-mansion-character-art",
    apply: "build",
    async writeBundle(outputOptions) {
      const outputDirectory = resolve(import.meta.dirname, outputOptions.dir ?? "mansion-dist");
      await Promise.all(MANSION_CHARACTER_IDS.map((characterId) => cp(
        resolve(import.meta.dirname, "src/assets/characters/paper-dolls", characterId),
        resolve(outputDirectory, "character-art", characterId),
        { recursive: true }
      )));
    }
  };
}

export default defineConfig({
  base: "./",
  plugins: [react(), copyMansionCharacterArt()],
  build: {
    outDir: "mansion-dist",
    emptyOutDir: true,
    rollupOptions: {
      input: {
        mansion: resolve(import.meta.dirname, "mansion.html"),
        shop: resolve(import.meta.dirname, "shop.html"),
        dice: resolve(import.meta.dirname, "dice.html"),
        battle: resolve(import.meta.dirname, "battle.html")
      }
    }
  }
});
