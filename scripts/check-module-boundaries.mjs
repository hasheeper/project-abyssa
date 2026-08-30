import { readdir, readFile } from "node:fs/promises";
import { dirname, extname, relative, resolve, sep } from "node:path";

const repositoryRoot = resolve(import.meta.dirname, "..");
const sourceRoot = resolve(repositoryRoot, "src");

const legacyApps = new Set([
  "battle",
  "character-status",
  "demo",
  "dice",
  "mansion",
  "map",
  "novel",
  "rp",
  "shop"
]);

const legacyTools = new Set(["mansion-editor", "studio"]);
const legacyShared = new Set(["components", "hooks", "stage", "styles", "utils"]);
const legacyTargets = new Map([
  ...[...legacyApps].map((name) => [name, `src/apps/${name === "demo" ? "catalog" : name}`]),
  ...[...legacyTools].map((name) => [name, `src/tools/${name}`]),
  ...[...legacyShared].map((name) => [name, "src/shared"])
]);
const sourceExtensions = new Set([".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs"]);

function slash(pathname) {
  return pathname.split(sep).join("/");
}

function repositoryPath(pathname) {
  return slash(relative(repositoryRoot, pathname));
}

function sourceParts(pathname) {
  return slash(relative(sourceRoot, pathname)).split("/");
}

function classify(pathname) {
  const parts = sourceParts(pathname);
  const [first, second] = parts;

  if (first === "apps" && second) return { kind: "app", owner: second };
  if (first === "tools" && second) return { kind: "tool", owner: second };
  if (first === "shared") return { kind: "shared", owner: "shared", parts };
  if (first === "content") return { kind: "content", owner: "content", parts };
  if (first === "assets") return { kind: "assets", owner: "assets", parts };
  if (legacyApps.has(first)) return { kind: "app", owner: first };
  if (legacyTools.has(first)) return { kind: "tool", owner: first };
  if (legacyShared.has(first)) return { kind: "shared", owner: "shared", parts };
  return { kind: "infrastructure", owner: first ?? "src", parts };
}

function explainViolation(importer, imported) {
  const from = classify(importer);
  const to = classify(imported);

  if (from.kind === "app") {
    if (to.kind === "app" && from.owner !== to.owner) {
      return `app \"${from.owner}\" must not import app \"${to.owner}\"`;
    }
    if (to.kind === "tool") {
      return `app \"${from.owner}\" must not import tool \"${to.owner}\"`;
    }
  }

  if (from.kind === "tool" && to.kind === "app") {
    return `tool \"${from.owner}\" must not import app \"${to.owner}\"`;
  }

  if (from.kind === "shared" && ["app", "tool", "content"].includes(to.kind)) {
    return `shared must not import ${to.kind} \"${to.owner}\"`;
  }

  if (from.kind === "content") {
    if (["app", "tool"].includes(to.kind)) {
      return `content must not import ${to.kind} \"${to.owner}\"`;
    }
    if (to.kind === "shared") {
      const sharedParts = sourceParts(imported);
      const isDomain = sharedParts[0] === "shared" && sharedParts[1] === "domain";
      if (!isDomain) return "content may only import shared/domain";
    }
  }

  return null;
}

async function collectSourceFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const nested = await Promise.all(entries.map(async (entry) => {
    const pathname = resolve(directory, entry.name);
    if (entry.isDirectory()) return collectSourceFiles(pathname);
    return sourceExtensions.has(extname(entry.name)) ? [pathname] : [];
  }));
  return nested.flat();
}

function importSpecifiers(sourceText, filename) {
  void filename;
  const imports = new Set();
  const patterns = [
    // Static imports and re-exports, including multiline named bindings.
    /^\s*(?:import|export)\s+(?:type\s+)?[^;]*?\bfrom\s*["']([^"']+)["']/gm,
    // Side-effect imports such as `import "./styles.css"`.
    /^\s*import\s*["']([^"']+)["']/gm,
    // Literal dynamic imports.
    /\bimport\s*\(\s*["']([^"']+)["']\s*\)/g
  ];

  for (const pattern of patterns) {
    for (const match of sourceText.matchAll(pattern)) imports.add(match[1]);
  }
  return [...imports];
}

const files = await collectSourceFiles(sourceRoot);
const violations = [];

for (const importer of files) {
  const [topLevelRoot] = sourceParts(importer);
  const migrationTarget = legacyTargets.get(topLevelRoot);
  if (migrationTarget) {
    violations.push({
      edge: repositoryPath(importer),
      reason: `legacy source root "src/${topLevelRoot}" is forbidden; use "${migrationTarget}"`
    });
  }

  const sourceText = await readFile(importer, "utf8");
  for (const specifier of importSpecifiers(sourceText, importer)) {
    if (!specifier.startsWith(".")) continue;
    const imported = resolve(dirname(importer), specifier);
    const reason = explainViolation(importer, imported);
    if (!reason) continue;

    const edge = `${repositoryPath(importer)} -> ${repositoryPath(imported)}`;
    const item = { edge, reason };
    violations.push(item);
  }
}

if (violations.length) {
  console.error(`Module boundaries: ${violations.length} unexpected violation(s).`);
  for (const item of violations) {
    console.error(`  ${item.edge}`);
    console.error(`    ${item.reason}`);
  }
  process.exitCode = 1;
} else {
  console.log("Module boundaries: no unexpected violations.");
}
