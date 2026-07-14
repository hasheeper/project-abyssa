import { copyFile, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { createServer } from "vite";

const projectRoot = resolve(import.meta.dirname, "..");
const outputDir = resolve(projectRoot, "static-preview");
const previewDir = resolve(projectRoot, "preview");
const frameCornerSource = resolve(
  projectRoot,
  "src/assets/png2/frame-corner-symmetric.png"
);
const frameCornerOutput = resolve(outputDir, "assets/frame-corner.png");
const frameCornerCssSource = "../assets/png2/frame-corner-symmetric.png";
const frameCornerCssOutput = "./assets/frame-corner.png";
const redFrameCornerSource = resolve(
  projectRoot,
  "src/assets/png2/frame-corner-symmetric-red.png"
);
const redFrameCornerOutput = resolve(outputDir, "assets/frame-corner-red.png");
const redFrameCornerCssSource = "../assets/png2/frame-corner-symmetric-red.png";
const redFrameCornerCssOutput = "./assets/frame-corner-red.png";
const goldFrameCornerSource = resolve(
  projectRoot,
  "src/assets/png2/frame-corner-symmetric-gold.png"
);
const goldFrameCornerOutput = resolve(outputDir, "assets/frame-corner-gold.png");
const goldFrameCornerCssSource = "../assets/png2/frame-corner-symmetric-gold.png";
const goldFrameCornerCssOutput = "./assets/frame-corner-gold.png";
const affiliationIconSource = resolve(projectRoot, "src/assets/png2/icon.png");
const affiliationIconOutput = resolve(outputDir, "assets/affiliation-icons.png");
const affiliationIconCssSource = "../assets/png2/icon.png";
const affiliationIconCssOutput = "./assets/affiliation-icons.png";
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
  const previewComponents = components.replaceAll(
    frameCornerCssSource,
    frameCornerCssOutput
  ).replaceAll(
    redFrameCornerCssSource,
    redFrameCornerCssOutput
  ).replaceAll(
    goldFrameCornerCssSource,
    goldFrameCornerCssOutput
  ).replaceAll(affiliationIconCssSource, affiliationIconCssOutput);
  const css = [tokens, previewComponents, previewStyles].join("\n\n");

  await rm(outputDir, { recursive: true, force: true });
  await mkdir(resolve(outputDir, "assets"), { recursive: true });
  await Promise.all([
    writeFile(resolve(outputDir, "index.html"), html),
    writeFile(resolve(outputDir, "styles.css"), css),
    writeFile(resolve(outputDir, "app.js"), interactions),
    copyFile(frameCornerSource, frameCornerOutput),
    copyFile(redFrameCornerSource, redFrameCornerOutput),
    copyFile(goldFrameCornerSource, goldFrameCornerOutput),
    copyFile(affiliationIconSource, affiliationIconOutput)
  ]);
} finally {
  await server.close();
}
