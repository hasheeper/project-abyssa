import { createHash } from "node:crypto";
import { mkdir, readFile, readdir, unlink, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const SOURCE_COMMIT = "82d948812bfe3f269ef8f731dcdb07b08160edc4";
const EXPECTED_ICON_COUNT = 317;
const PROJECT_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const ITEMS_ROOT = join(PROJECT_ROOT, "src/assets/icons/items");
const ICONS_ROOT = ITEMS_ROOT;
const SELECTION_PATH = join(ITEMS_ROOT, "selection.json");
const MANIFEST_PATH = join(ITEMS_ROOT, "manifest.json");
const ATTRIBUTION_PATH = join(ITEMS_ROOT, "ATTRIBUTION.md");
const LICENSE_PATH = join(ITEMS_ROOT, "LICENSE-CC-BY-3.0.txt");
const CACHE_ROOT = join(PROJECT_ROOT, "node_modules/.cache/abyssa-game-icons");
const LOCAL_SOURCE = process.env.GAME_ICONS_SOURCE_DIR;
const args = new Set(process.argv.slice(2));
const checkOnly = args.has("--check");
const refreshMetadata = args.has("--refresh-metadata");
const offline = args.has("--offline");
const ALLOWED_SINGLE_CJK_KEYWORDS = new Set(["剑", "弓", "盾", "蕈", "桶", "床", "灯", "弩", "箭", "蛋", "梨", "牙", "盐"]);
let reusableSources = new Map();

const sleep = (milliseconds) => new Promise((resolvePromise) => setTimeout(resolvePromise, milliseconds));
const sha256 = (value) => createHash("sha256").update(value).digest("hex");

function decodeHtml(value) {
  return value
    .replaceAll("&amp;", "&")
    .replaceAll("&quot;", '"')
    .replaceAll("&#39;", "'")
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">");
}

async function fetchText(url, timeout = 15_000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);
  try {
    const response = await fetch(url, {
      headers: { "User-Agent": "project-abyssa-icon-curator/1.0 (+https://game-icons.net)" },
      signal: controller.signal
    });
    if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
    return await response.text();
  } finally {
    clearTimeout(timer);
  }
}

async function readSource(entry) {
  const reusable = reusableSources.get(entry.id);
  if (reusable?.sourcePath === entry.source) {
    const existing = await readFile(join(ICONS_ROOT, `${entry.id}.svg`), "utf8");
    if (sha256(existing) === reusable.sha256) return existing;
  }
  if (LOCAL_SOURCE) {
    const sourcePath = resolve(LOCAL_SOURCE, entry.source);
    if (!sourcePath.startsWith(resolve(LOCAL_SOURCE) + "/")) throw new Error(`Unsafe source path: ${entry.source}`);
    return readFile(sourcePath, "utf8");
  }
  const mirrorUrl = `https://cdn.jsdelivr.net/gh/game-icons/icons@${SOURCE_COMMIT}/${entry.source}`;
  const rawUrl = `https://raw.githubusercontent.com/game-icons/icons/${SOURCE_COMMIT}/${entry.source}`;
  try {
    return await fetchText(mirrorUrl);
  } catch {
    return fetchText(rawUrl);
  }
}

async function loadReusableSources() {
  if (!existsSync(MANIFEST_PATH)) return;
  const manifest = JSON.parse(await readFile(MANIFEST_PATH, "utf8"));
  if (manifest.sourceCommit !== SOURCE_COMMIT) return;
  reusableSources = new Map(manifest.icons.map((entry) => [entry.id, entry]));
}

function normalizeSvg(raw, entry) {
  if (!/<svg\b/i.test(raw) || !/viewBox="0 0 512 512"/i.test(raw)) {
    throw new Error(`${entry.id}: SVG must use a 0 0 512 512 viewBox`);
  }
  if (/<(?:script|image|foreignObject|use)\b/i.test(raw) || /\bon\w+\s*=/i.test(raw) || /\b(?:href|xlink:href)\s*=/i.test(raw)) {
    throw new Error(`${entry.id}: unsafe or external SVG content`);
  }

  const ids = [...raw.matchAll(/\bid="([^"]+)"/g)].map((match) => match[1]);
  if (new Set(ids).size !== ids.length) throw new Error(`${entry.id}: duplicate SVG ids`);

  const innerMatch = raw.match(/<svg\b[^>]*>([\s\S]*?)<\/svg>/i);
  if (!innerMatch) throw new Error(`${entry.id}: malformed SVG root`);

  let inner = innerMatch[1]
    .replace(/<!--([\s\S]*?)-->/g, "")
    .replace(/<path\b(?=[^>]*\bd="M0 0h512v512H0z")[^>]*\/>/gi, "")
    .replace(/\s(?:style|class)="[^"]*"/gi, "")
    .replace(/\sfill="(?!none)[^"]*"/gi, ' fill="#fff"')
    .trim();

  if (/\bd="M0 0h512v512H0z"/i.test(inner)) throw new Error(`${entry.id}: background canvas was not removed`);
  if (!/<path\b/i.test(inner)) throw new Error(`${entry.id}: SVG has no foreground path`);

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" aria-hidden="true" focusable="false">${inner}</svg>\n`;
}

function parseMetadata(html, entry) {
  const author = html.match(/<h4 class="author">by <a[^>]*>([^<]+)<\/a>/i)?.[1];
  const license = html.match(/rel="license">([^<]+)<\/a>/i)?.[1];
  const description = html.match(/itemprop="description" class="description"><p>([\s\S]*?)<\/p>/i)?.[1];
  const tagsBlock = html.match(/<div class="tags">([\s\S]*?)<div itemprop="description"/i)?.[1] ?? "";
  const tags = [...tagsBlock.matchAll(/rel="tag">([^<]+)<\/a>/gi)].map((match) => decodeHtml(match[1].trim()));
  if (!author || !license) throw new Error(`${entry.id}: website metadata is incomplete`);
  return {
    author: decodeHtml(author.trim()),
    license: decodeHtml(license.trim()),
    tags: [...new Set(tags)].sort(),
    description: description ? decodeHtml(description.replace(/<[^>]+>/g, "").trim()) : ""
  };
}

async function getMetadata(entry) {
  const cachePath = join(CACHE_ROOT, `${entry.id}.json`);
  if (!refreshMetadata && existsSync(cachePath)) return JSON.parse(await readFile(cachePath, "utf8"));
  if (offline) return { author: entry.author, license: "CC BY 3.0", tags: [], description: "", metadataStatus: "offline" };

  const pageUrl = `https://game-icons.net/1x1/${entry.source.replace(/\.svg$/, ".html")}`;
  const metadata = { ...parseMetadata(await fetchText(pageUrl), entry), metadataStatus: "verified" };
  await mkdir(CACHE_ROOT, { recursive: true });
  await writeFile(cachePath, `${JSON.stringify(metadata, null, 2)}\n`);
  return metadata;
}

async function mapWithConcurrency(values, limit, mapper) {
  const output = new Array(values.length);
  let cursor = 0;
  async function worker() {
    while (cursor < values.length) {
      const index = cursor++;
      output[index] = await mapper(values[index], index);
      if (!offline) await sleep(180);
    }
  }
  await Promise.all(Array.from({ length: limit }, () => worker()));
  return output;
}

function validateSelection(selection) {
  if (selection.length !== EXPECTED_ICON_COUNT) throw new Error(`Expected ${EXPECTED_ICON_COUNT} selected icons, found ${selection.length}`);
  const ids = new Set();
  const sources = new Set();
  const keywordCategories = new Map();
  const variantGroups = new Map();
  const normalizeKeyword = (value) => value.normalize("NFKC").toLocaleLowerCase().replace(/[\s\p{P}\p{S}]+/gu, "");
  for (const entry of selection) {
    if (!/^[a-z0-9-]+$/.test(entry.id)) throw new Error(`Invalid id: ${entry.id}`);
    if (!/^[a-z0-9-]+\/[a-z0-9-]+\.svg$/.test(entry.source)) throw new Error(`Invalid source: ${entry.source}`);
    if (ids.has(entry.id) || sources.has(entry.source)) throw new Error(`Duplicate selection: ${entry.id}`);
    if (!entry.zh?.length || !entry.en?.length || !entry.author || entry.review !== "verified") throw new Error(`Incomplete selection: ${entry.id}`);
    if (entry.quality != null && (!Number.isInteger(entry.quality) || entry.quality < 1 || entry.quality > 5)) throw new Error(`Invalid quality: ${entry.id}`);
    const rawKeywords = [...entry.zh, ...entry.en];
    const normalizedKeywords = rawKeywords.map(normalizeKeyword);
    if (new Set(normalizedKeywords).size !== normalizedKeywords.length) throw new Error(`Duplicate normalized keyword in ${entry.id}`);
    for (const keyword of rawKeywords) {
      if (/^\p{Script=Han}$/u.test(keyword) && !ALLOWED_SINGLE_CJK_KEYWORDS.has(keyword)) {
        throw new Error(`Unreviewed single-character CJK keyword in ${entry.id}: ${keyword}`);
      }
    }
    for (const keyword of normalizedKeywords) {
      const categories = keywordCategories.get(keyword) ?? new Set();
      categories.add(entry.category);
      keywordCategories.set(keyword, categories);
    }
    if (entry.variantGroup) {
      const variants = variantGroups.get(entry.variantGroup) ?? [];
      variants.push(entry);
      variantGroups.set(entry.variantGroup, variants);
    }
    ids.add(entry.id);
    sources.add(entry.source);
  }
  for (const [keyword, categories] of keywordCategories) {
    if (categories.size > 1) throw new Error(`Cross-category keyword conflict: ${keyword} (${[...categories].join(", ")})`);
  }
  for (const [group, variants] of variantGroups) {
    const qualities = variants.map((entry) => entry.quality);
    if (variants.length < 2 || qualities.some((quality) => quality == null) || new Set(qualities).size !== qualities.length) {
      throw new Error(`Invalid quality variant group: ${group}`);
    }
    if (new Set(variants.map((entry) => entry.priority)).size !== 1) {
      throw new Error(`Quality variants must share a priority: ${group}`);
    }
  }
}

async function checkGenerated(selection) {
  const manifest = JSON.parse(await readFile(MANIFEST_PATH, "utf8"));
  if (manifest.sourceCommit !== SOURCE_COMMIT || manifest.icons.length !== selection.length) throw new Error("Generated manifest is stale");
  const expectedEntries = new Map(selection.map((entry) => [entry.id, entry]));
  for (const entry of manifest.icons) {
    const expected = expectedEntries.get(entry.id);
    if (!expected || expected.source !== entry.sourcePath || expected.author !== entry.author) {
      throw new Error(`Generated manifest does not match selection: ${entry.id}`);
    }
    if (entry.metadataStatus !== "verified") throw new Error(`Unverified website metadata: ${entry.id}`);
    expectedEntries.delete(entry.id);
  }
  if (expectedEntries.size) throw new Error(`Generated manifest is missing: ${[...expectedEntries.keys()].join(", ")}`);
  for (const entry of manifest.icons) {
    const svg = await readFile(join(ICONS_ROOT, `${entry.id}.svg`), "utf8");
    normalizeSvg(svg, entry);
    if (sha256(svg) !== entry.sha256) throw new Error(`${entry.id}: SHA-256 mismatch`);
  }
  const attribution = await readFile(ATTRIBUTION_PATH, "utf8");
  for (const author of new Set(manifest.icons.map((entry) => entry.author))) {
    if (!attribution.includes(author)) throw new Error(`Missing attribution for ${author}`);
  }
  console.log(`Validated ${manifest.icons.length} curated Game-Icons.net SVGs.`);
}

async function main() {
  const selection = JSON.parse(await readFile(SELECTION_PATH, "utf8"));
  validateSelection(selection);
  if (checkOnly) return checkGenerated(selection);
  await loadReusableSources();

  await mkdir(ICONS_ROOT, { recursive: true });
  const generated = await mapWithConcurrency(selection, 2, async (entry) => {
    const [raw, metadata] = await Promise.all([readSource(entry), getMetadata(entry)]);
    const svg = normalizeSvg(raw, entry);
    await writeFile(join(ICONS_ROOT, `${entry.id}.svg`), svg);
    return {
      id: entry.id,
      sourcePath: entry.source,
      sourceUrl: `https://github.com/game-icons/icons/blob/${SOURCE_COMMIT}/${entry.source}`,
      pageUrl: `https://game-icons.net/1x1/${entry.source.replace(/\.svg$/, ".html")}`,
      author: metadata.author,
      license: metadata.license,
      tags: metadata.tags,
      description: metadata.description,
      metadataStatus: metadata.metadataStatus,
      sha256: sha256(svg)
    };
  });

  const selectedFiles = new Set(selection.map((entry) => `${entry.id}.svg`));
  for (const file of await readdir(ICONS_ROOT)) {
    if (file.endsWith(".svg") && !selectedFiles.has(file)) await unlink(join(ICONS_ROOT, file));
  }

  const manifest = {
    source: "https://github.com/game-icons/icons",
    sourceCommit: SOURCE_COMMIT,
    count: generated.length,
    icons: generated
  };
  await writeFile(MANIFEST_PATH, `${JSON.stringify(manifest, null, 2)}\n`);

  const byAuthor = new Map();
  for (const entry of generated) {
    const icons = byAuthor.get(entry.author) ?? [];
    icons.push(entry);
    byAuthor.set(entry.author, icons);
  }
  const attributionLines = [
    "# Game-Icons.net attribution",
    "",
    "These icons are sourced from [Game-Icons.net](https://game-icons.net/) and the pinned",
    `official repository commit \`${SOURCE_COMMIT}\`. Each icon remains under its listed license.`,
    "",
    ...[...byAuthor.entries()].sort(([a], [b]) => a.localeCompare(b)).flatMap(([author, icons]) => [
      `## ${author}`,
      "",
      ...icons.sort((a, b) => a.id.localeCompare(b.id)).map((icon) => `- [${icon.id}](${icon.pageUrl}) — ${icon.license}`),
      ""
    ])
  ];
  await writeFile(ATTRIBUTION_PATH, `${attributionLines.join("\n").trim()}\n`);

  let licenseText;
  try {
    licenseText = await fetchText("https://creativecommons.org/licenses/by/3.0/legalcode.txt");
  } catch {
    licenseText = "Creative Commons Attribution 3.0 Unported (CC BY 3.0)\nhttps://creativecommons.org/licenses/by/3.0/\n";
  }
  await writeFile(LICENSE_PATH, licenseText.endsWith("\n") ? licenseText : `${licenseText}\n`);
  await checkGenerated(selection);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
