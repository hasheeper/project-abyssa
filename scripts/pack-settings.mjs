import { mkdir, readFile, readdir, rename, writeFile } from "node:fs/promises";
import { dirname, extname, relative, resolve } from "node:path";

const projectRoot = resolve(import.meta.dirname, "..");
const sourceDir = resolve(projectRoot, process.argv[2] ?? "st/setting");
const outputFile = resolve(
  projectRoot,
  process.argv[3] ?? "st/setting/ABYSSA_SETTINGS_BUNDLE.txt"
);
const temporaryOutput = `${outputFile}.tmp`;
const collator = new Intl.Collator("zh-CN", {
  numeric: true,
  sensitivity: "base"
});

const preferredOrder = new Map([
  ["world_setting_bible.txt", 0],
  ["world_history.txt", 1],
  ["institutional_lore.txt", 2],
  ["four_heavenly_kings_overview.txt", 3],
  ["prequel_chronicle.txt", 4],
  ["current_situation.txt", 5]
]);

function orderOf(path) {
  if (preferredOrder.has(path)) return preferredOrder.get(path);
  if (path.startsWith("user/")) return 100;
  if (path.startsWith("char/")) return 200;
  return 50;
}

async function collectTextFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const absolutePath = resolve(directory, entry.name);

    if (entry.isDirectory()) {
      files.push(...await collectTextFiles(absolutePath));
      continue;
    }

    if (
      entry.isFile() &&
      extname(entry.name).toLowerCase() === ".txt" &&
      absolutePath !== outputFile &&
      absolutePath !== temporaryOutput
    ) {
      files.push(absolutePath);
    }
  }

  return files;
}

const sourceFiles = (await collectTextFiles(sourceDir))
  .map((absolutePath) => ({
    absolutePath,
    relativePath: relative(sourceDir, absolutePath).replaceAll("\\", "/")
  }))
  .sort((a, b) => {
    const rankDifference = orderOf(a.relativePath) - orderOf(b.relativePath);
    return rankDifference || collator.compare(a.relativePath, b.relativePath);
  });

if (sourceFiles.length === 0) {
  throw new Error(`没有在 ${relative(projectRoot, sourceDir)} 中找到可打包的 TXT 文件。`);
}

const sections = await Promise.all(sourceFiles.map(async (file, index) => {
  const source = await readFile(file.absolutePath, "utf8");

  if (source.includes("\uFFFD")) {
    throw new Error(`${file.relativePath} 可能不是有效的 UTF-8 文本。`);
  }

  const normalizedSource = source.replaceAll("\r\n", "\n").trimEnd();
  const number = String(index + 1).padStart(2, "0");
  const divider = "=".repeat(88);

  return [
    divider,
    `[${number}/${String(sourceFiles.length).padStart(2, "0")}] ${file.relativePath}`,
    divider,
    normalizedSource
  ].join("\n");
}));

const indexLines = sourceFiles.map((file, index) =>
  `${String(index + 1).padStart(2, "0")}. ${file.relativePath}`
);
const bundle = [
  "《ABYSSA》设定合集",
  "本文件由 scripts/pack-settings.mjs 自动生成，请修改源文件后重新打包。",
  `源目录：${relative(projectRoot, sourceDir).replaceAll("\\", "/")}`,
  `收录文件：${sourceFiles.length}`,
  "编码：UTF-8",
  "",
  "内容索引",
  "-".repeat(88),
  ...indexLines,
  "",
  ...sections,
  ""
].join("\n");

await mkdir(dirname(outputFile), { recursive: true });
await writeFile(temporaryOutput, bundle, "utf8");
await rename(temporaryOutput, outputFile);

const relativeOutput = relative(projectRoot, outputFile).replaceAll("\\", "/");
const sizeInKiB = (Buffer.byteLength(bundle, "utf8") / 1024).toFixed(1);
console.log(`设定打包完成：${relativeOutput}`);
console.log(`共 ${sourceFiles.length} 个文件，${sizeInKiB} KiB。`);
