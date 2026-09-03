import { existsSync, readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const root = resolve(import.meta.dirname, "../../../..");
const read = (path: string) => readFileSync(resolve(root, path), "utf8");
const cssImports = (source: string) =>
  [...source.matchAll(/@import\s+["']([^"']+)["']/g)].map((match) => match[1]);

describe("shared style entry boundaries", () => {
  it("keeps the compatibility component entry in the established cascade order", () => {
    expect(cssImports(read("src/shared/ui/styles/components-core.css"))).toEqual([
      "./components-foundation.css",
      "./components-controls.css",
      "./components-dialogue.css",
      "./avatar-frame.css"
    ]);
    expect(cssImports(read("src/shared/ui/styles/components-character-status.css"))).toEqual([
      "./components-character-selector.css",
      "./components-status-panel.css",
      "./components-character-screen.css"
    ]);
    expect(cssImports(read("src/shared/ui/styles/components-character-archive.css"))).toEqual([
      "./components-dice-loadout.css",
      "./components-character-chronicle.css"
    ]);
    expect(cssImports(read("src/shared/ui/styles/components.css"))).toEqual([
      "./components-core.css",
      "./components-character-status.css",
      "./components-character-archive.css"
    ]);
  });

  it("keeps product-only character archive styles out of the public library entry", () => {
    const imports = cssImports(read("src/shared/ui/styles/index.css"));

    expect(imports).toContain("./components-core.css");
    expect(imports).toContain("./components-character-status.css");
    expect(imports).not.toContain("./components.css");
    expect(imports).not.toContain("./components-character-archive.css");
  });

  it("uses explicit style packs at application and tool entry points", () => {
    const entries = ["src/apps", "src/tools"].flatMap((directory) =>
      readdirSync(resolve(root, directory), { withFileTypes: true })
        .filter((entry) => entry.isDirectory())
        .map((entry) => `${directory}/${entry.name}/main.tsx`)
        .filter((entry) => existsSync(resolve(root, entry)))
    );

    for (const entry of entries) {
      const source = read(entry);
      expect(source, entry).not.toContain("shared/ui/styles/components.css");
      expect(source, entry).not.toContain("shared/ui/styles/index.css");
    }

    const characterStatus = read("src/apps/character-status/main.tsx");
    expect(characterStatus).toContain("shared/ui/styles/components-character-status.css");
    expect(characterStatus).toContain("shared/ui/styles/components-character-archive.css");
    expect(characterStatus).toContain("shared/ui/styles/items.css");
    expect(read("src/apps/shop/ShopPage.tsx")).not.toContain('from "../../index"');
  });
});
