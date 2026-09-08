import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

const projectRoot = resolve(import.meta.dirname, "..");
const packageJson = JSON.parse(
  readFileSync(resolve(projectRoot, "package.json"), "utf8")
);

const entrypoints = {
  // Includes the five shared emotion-cue exports added to index and patterns.
  index: 108,
  branding: 14,
  patterns: 37,
  primitives: 57
};
const requiredAssets = [
  "dist/ui/battle-frame-corner-gold.png",
  "dist/ui/battle-frame-corner-red.png",
  "dist/ui/battle-frame-corner.png",
  "dist/ui/status-panel-emblem.png",
  "dist/ui/battle-frame-top-gold.png",
  "dist/ui/battle-frame-top-red.png",
  "dist/ui/battle-frame-top.png"
];
const budgets = {
  packedBytes: 7 * 1024 * 1024,
  unpackedBytes: 8 * 1024 * 1024,
  textAssetBytes: 256 * 1024,
  dataUrlBytes: 16 * 1024
};

const failures = [];

/** @param {boolean} condition @param {string} message */
function check(condition, message) {
  if (!condition) {
    failures.push(message);
  }
}

/** @param {number} bytes */
function formatBytes(bytes) {
  return `${(bytes / 1024 / 1024).toFixed(2)} MiB`;
}

/** @param {string} source */
function findDataUrls(source) {
  const urls = [];
  const marker = /data:(?:image|font)\/[a-z0-9.+-]+(?:;[^,]*)?,/gi;

  for (const match of source.matchAll(marker)) {
    const start = match.index;
    let end = start + match[0].length;
    const quote = source[start - 1];
    const terminators = quote === '"' || quote === "'" || quote === "`"
      ? new Set([quote, "\n", "\r"])
      : new Set(['"', "'", "`", ")", "\n", "\r"]);

    while (end < source.length && !terminators.has(source[end])) {
      end += 1;
    }

    urls.push(source.slice(start, end));
  }

  return urls;
}

/** @type {{files: {path: string, size: number}[], size: number, unpackedSize: number} | undefined} */
let pack;

try {
  const output = execFileSync(
    "npm",
    ["pack", "--dry-run", "--json", "--ignore-scripts"],
    {
      cwd: projectRoot,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"]
    }
  );
  [pack] = JSON.parse(output);
} catch (error) {
  const details = error instanceof Error ? error.message : String(error);
  failures.push(`npm pack --dry-run failed: ${details}`);
}

if (pack) {
  const packageFiles = new Map(pack.files.map((file) => [file.path, file]));
  check([...packageFiles.keys()].every(file => file.startsWith("dist/ui/") || /^(package\.json|README(?:\.[^/]+)?|LICEN[CS]E(?:\.[^/]+)?)$/i.test(file)), "UI package contains files outside dist/ui");
  const requiredFiles = [
    "dist/ui/abyssa-ui.css",
    ...Object.keys(entrypoints).flatMap((entry) => [
      `dist/ui/${entry}.js`,
      `dist/ui/${entry}.d.ts`
    ]),
    ...requiredAssets
  ];

  for (const file of requiredFiles) {
    check(packageFiles.has(file), `Missing required package file: ${file}`);
  }

  const packagedPngs = [...packageFiles.keys()].filter(
    (file) => file.startsWith("dist/ui/") && file.endsWith(".png")
  );
  check(
    packagedPngs.length === requiredAssets.length &&
      requiredAssets.every((file) => packagedPngs.includes(file)),
    `Expected exactly ${requiredAssets.length} release PNG assets; found ${packagedPngs.length}`
  );
  check(
    ![...packageFiles.keys()].some(
      (file) => file === "dist/ui/mansion-map" || file.startsWith("dist/ui/mansion-map/")
    ),
    "dist/ui/mansion-map must not be included in the package"
  );
  check(
    pack.size <= budgets.packedBytes,
    `Packed size ${formatBytes(pack.size)} exceeds ${formatBytes(budgets.packedBytes)}`
  );
  check(
    pack.unpackedSize <= budgets.unpackedBytes,
    `Unpacked size ${formatBytes(pack.unpackedSize)} exceeds ${formatBytes(budgets.unpackedBytes)}`
  );

  for (const file of pack.files.filter(({ path }) => /\.(?:css|js)$/.test(path))) {
    check(
      file.size <= budgets.textAssetBytes,
      `${file.path} is ${formatBytes(file.size)}, above the ${formatBytes(budgets.textAssetBytes)} text asset budget`
    );

    const source = readFileSync(resolve(projectRoot, file.path), "utf8");
    for (const dataUrl of findDataUrls(source)) {
      const size = Buffer.byteLength(dataUrl);
      check(
        size <= budgets.dataUrlBytes,
        `${file.path} contains an inline data URL of ${formatBytes(size)}`
      );
    }
  }

  if (packageFiles.has("dist/ui/abyssa-ui.css")) {
    const libraryCss = readFileSync(resolve(projectRoot, "dist/ui/abyssa-ui.css"), "utf8");
    /** @type {[string, RegExp][]} */
    const publicStyleMarkers = [
      ["character status panel", /\.abyssa-status-panel(?:[\s,{.:>])/],
      ["character status screen", /\.abyssa-character-screen(?:[\s,{.:>])/]
    ];
    /** @type {[string, RegExp][]} */
    const internalStyleMarkers = [
      ["character dice loadout", /\.abyssa-dice(?:[\s,{.:>])/],
      ["character chronicle", /\.abyssa-chronicle(?:[\s,{.:>])/]
    ];

    for (const [label, marker] of publicStyleMarkers) {
      check(
        marker.test(libraryCss),
        `dist/ui/abyssa-ui.css must contain public ${label} styles`
      );
    }
    for (const [label, marker] of internalStyleMarkers) {
      check(
        !marker.test(libraryCss),
        `dist/ui/abyssa-ui.css must not contain product-only ${label} styles`
      );
    }
  }
}

/** @type {Record<string, string>} */
const expectedExportPaths = {
  index: ".",
  branding: "./branding",
  patterns: "./patterns",
  primitives: "./primitives"
};
/** @type {Record<string, string[]>} */
const loadedEntrypoints = {};

for (const [entry, expectedExportCount] of Object.entries(entrypoints)) {
  const exportPath = expectedExportPaths[entry];
  const expected = packageJson.exports?.[exportPath];
  check(expected?.import === `./dist/ui/${entry}.js`, `Invalid import path for ${exportPath}`);
  check(expected?.types === `./dist/ui/${entry}.d.ts`, `Invalid types path for ${exportPath}`);

  try {
    const moduleUrl = pathToFileURL(resolve(projectRoot, `dist/ui/${entry}.js`));
    const loaded = await import(`${moduleUrl.href}?release-check=${Date.now()}`);
    const exportNames = Object.keys(loaded);
    loadedEntrypoints[entry] = exportNames;
    check(
      exportNames.length === expectedExportCount,
      `${entry} exports ${exportNames.length} runtime values; expected ${expectedExportCount}`
    );
  } catch (error) {
    failures.push(`Unable to import dist/ui/${entry}.js: ${error instanceof Error ? error.message : String(error)}`);
  }
}

const rootExports = new Set(loadedEntrypoints.index ?? []);
for (const entry of ["branding", "patterns", "primitives"]) {
  const missingFromRoot = (loadedEntrypoints[entry] ?? []).filter(
    (name) => !rootExports.has(name)
  );
  check(
    missingFromRoot.length === 0,
    `${entry} has exports missing from the root entry: ${missingFromRoot.join(", ")}`
  );
}

check(
  packageJson.exports?.["./styles.css"] === "./dist/ui/abyssa-ui.css",
  "Invalid export path for ./styles.css"
);

if (failures.length > 0) {
  console.error("Package release check failed:\n");
  for (const failure of failures) {
    console.error(`- ${failure}`);
  }
  process.exitCode = 1;
} else if (pack) {
  console.log("Package release check passed.");
  console.log(
    `Packed ${formatBytes(pack.size)} / unpacked ${formatBytes(pack.unpackedSize)}; ` +
      `${pack.files.length} files; ${requiredAssets.length} external PNG assets.`
  );
  console.log(
    `Runtime exports: ${Object.entries(entrypoints)
      .map(([entry, count]) => `${entry} ${count}`)
      .join(", ")}.`
  );
}
