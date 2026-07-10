import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { createServer } from "vite";

const projectRoot = resolve(import.meta.dirname, "..");
const outputDir = resolve(projectRoot, "static-preview");
const previewDir = resolve(projectRoot, "preview");

const server = await createServer({
  root: projectRoot,
  appType: "custom",
  logLevel: "error",
  server: { middlewareMode: true }
});

try {
  const { renderCatalog } = await server.ssrLoadModule("/preview/render.tsx");
  const [template, tokens, components, previewStyles, interactions] = await Promise.all([
    readFile(resolve(previewDir, "index.html"), "utf8"),
    readFile(resolve(projectRoot, "src/styles/tokens.css"), "utf8"),
    readFile(resolve(projectRoot, "src/styles/components.css"), "utf8"),
    readFile(resolve(previewDir, "preview.css"), "utf8"),
    readFile(resolve(previewDir, "app.js"), "utf8")
  ]);

  const html = template
    .replace("<!-- COMPONENT_CATALOG -->", renderCatalog())
    .replace(/></g, ">\n<");
  const css = [tokens, components, previewStyles].join("\n\n");

  await rm(outputDir, { recursive: true, force: true });
  await mkdir(outputDir, { recursive: true });
  await Promise.all([
    writeFile(resolve(outputDir, "index.html"), html),
    writeFile(resolve(outputDir, "styles.css"), css),
    writeFile(resolve(outputDir, "app.js"), interactions)
  ]);
} finally {
  await server.close();
}
