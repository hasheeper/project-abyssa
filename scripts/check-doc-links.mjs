/** Read-only Markdown file/heading checks; no network or report regeneration. */
import {readFileSync, existsSync} from "node:fs";
import {execFileSync} from "node:child_process";
import {dirname, resolve, relative, isAbsolute} from "node:path";
import {fileURLToPath} from "node:url";
import {projectRoot} from "../config/paths.mjs";

const blank = value => value.replace(/[^\r\n]/g, " ");
function escaped(text, at) {
  let count = 0;
  while (at > 0 && text[--at] === "\\") count++;
  return count % 2 === 1;
}

export function maskCode(source, inline = true) {
  let fence = null;
  let result = source.replace(/^.*(?:\r?\n|$)/gm, line => {
    const open = /^ {0,3}(\x60{3,}|~{3,})(.*)/.exec(line);
    if (fence) {
      if (open && open[1][0] === fence.char && open[1].length >= fence.size && !open[2].trim()) fence = null;
      return blank(line);
    }
    if (open && !(open[1][0] === "\x60" && open[2].includes("\x60"))) {
      fence = {char: open[1][0], size: open[1].length};
      return blank(line);
    }
    return line;
  }).replace(/<!--[\s\S]*?-->/g, blank);
  if (!inline) return result;
  for (let i = 0; i < result.length; i++) {
    if (result[i] !== "\x60" || escaped(result, i)) continue;
    let end = i;
    while (result[end] === "\x60") end++;
    const size = end - i, runs = /\x60+/g;
    runs.lastIndex = end;
    let found;
    while ((found = runs.exec(result))) if (found[0].length === size) break;
    if (found) {
      const close = found.index + size;
      result = result.slice(0, i) + blank(result.slice(i, close)) + result.slice(close);
      i = close - 1;
    } else i = end - 1;
  }
  return result;
}

function destination(text, at, inline) {
  while (at < text.length && /\s/.test(text[at])) at++;
  if (text[at] === "<") {
    const start = ++at;
    while (at < text.length && (text[at] !== ">" || escaped(text, at))) at++;
    return at === text.length ? null : {value: text.slice(start, at), end: at + 1};
  }
  const start = at;
  let depth = 0;
  for (; at < text.length; at++) {
    if (escaped(text, at)) continue;
    if (/\s/.test(text[at])) break;
    if (text[at] === "(") depth++;
    if (text[at] === ")") {
      if (depth === 0 && inline) break;
      depth--;
    }
  }
  return {value: text.slice(start, at), end: at};
}

// Inline/images and reference definitions. Offsets refer to original source.
export function markdownLinks(source) {
  const masked = maskCode(source), links = [], ranges = [];
  for (const match of masked.matchAll(/^ {0,3}\[([^\]\n]+)\]:[ \t]*/gm)) {
    const dest = destination(source, match.index + match[0].length, false);
    if (!dest) continue;
    const end = masked.indexOf("\n", dest.end);
    ranges.push([match.index, end < 0 ? masked.length : end]);
    links.push({start: match.index, end: dest.end, label: match[1], target: dest.value, definition: true});
  }
  for (let i = 0; i < masked.length; i++) {
    if (masked[i] !== "[" || escaped(masked, i) || ranges.some(([a,b]) => i >= a && i < b)) continue;
    let depth = 1, endLabel = i + 1;
    for (; endLabel < masked.length; endLabel++) {
      if (escaped(masked, endLabel)) continue;
      if (masked[endLabel] === "[") depth++;
      if (masked[endLabel] === "]" && --depth === 0) break;
    }
    if (depth !== 0 || masked[endLabel + 1] !== "(") continue;
    const dest = destination(source, endLabel + 2, true);
    if (!dest) continue;
    let end = dest.end;
    while (end < masked.length && /\s/.test(masked[end])) end++;
    if (masked[end] === '"' || masked[end] === "'") {
      const quote = masked[end++];
      while (end < masked.length && (masked[end] !== quote || escaped(masked, end))) end++;
      end++;
      while (end < masked.length && /\s/.test(masked[end])) end++;
    }
    if (masked[end] !== ")") continue;
    const start = i > 0 && masked[i - 1] === "!" && !escaped(masked, i - 1) ? i - 1 : i;
    links.push({start, end: end + 1, label: source.slice(i + 1, endLabel), target: dest.value, definition: false});
    i = end;
  }
  return links.map(link => ({...link, line: source.slice(0, link.start).split("\n").length}));
}

export function localTarget(target, from) {
  let value = target.replace(/\\([\\()[\] <>])/g, "$1");
  if (/^[a-z][a-z\d+.-]*:/i.test(value) || value.startsWith("//")) return null;
  const hash = value.indexOf("#"), anchor = hash < 0 ? "" : value.slice(hash + 1);
  value = (hash < 0 ? value : value.slice(0, hash)).split("?")[0];
  const decode = text => {try {return decodeURIComponent(text);} catch {return text;}};
  value = decode(value).replace(/:\d+(?::\d+)?$/, "");
  return {path: value ? resolve(dirname(from), value) : from, anchor: decode(anchor)};
}

// Repository heading conventions: Chinese, inline formatting, duplicate suffixes.
export function headingSlug(heading) {
  return heading.replace(/<[^>]*>/g, "").replace(/!?\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/[*\x60~]/g, "").toLowerCase()
    .replace(/[\p{P}\p{S}]/gu, char => /[-_]/.test(char) ? char : "").replace(/\s/g, "-");
}

export function headingAnchors(source) {
  const text = maskCode(source, false), used = new Set(), anchors = new Set(), lines = text.split(/\r?\n/);
  for (let i = 0; i < lines.length; i++) {
    const atx = /^ {0,3}#{1,6}[ \t]+(.+?)(?:[ \t]+#+)?[ \t]*$/.exec(lines[i]);
    const setext = i + 1 < lines.length && /^ {0,3}(?:=+|-+)\s*$/.test(lines[i + 1]) && lines[i].trim() && !/^[>|]/.test(lines[i]);
    const title = atx?.[1] ?? (setext ? lines[i].trim() : null);
    if (title === null) continue;
    const base = headingSlug(title);
    let slug = base, index = 0;
    while (used.has(slug)) slug = base + "-" + (++index);
    used.add(slug); anchors.add(slug);
    if (!atx && setext) i++;
  }
  for (const match of text.matchAll(/<[^>]*\b(?:id|name)=["']([^"']+)["'][^>]*>/g)) anchors.add(match[1]);
  return anchors;
}

export function checkDocLinks(root = projectRoot) {
  const files = execFileSync("rg", ["--files", "-g", "*.md"], {cwd: root, encoding: "utf8"}).trim().split("\n").filter(Boolean).sort();
  const anchors = new Map(), errors = [];
  let checked = 0;
  for (const file of files) {
    const absolute = resolve(root, file), source = readFileSync(absolute, "utf8");
    for (const link of markdownLinks(source)) {
      const target = localTarget(link.target, absolute);
      if (!target) continue;
      checked++;
      let reason = null;
      if (!existsSync(target.path)) reason = "missing-file";
      else {
        const rel = relative(root, target.path), inside = !isAbsolute(rel) && rel !== ".." && !rel.startsWith("../");
        if (inside && /\.md$/i.test(target.path) && target.anchor) {
          if (!anchors.has(target.path)) anchors.set(target.path, headingAnchors(readFileSync(target.path, "utf8")));
          if (!anchors.get(target.path).has(target.anchor)) reason = "missing-anchor";
        }
      }
      if (reason) errors.push({file, ...link, reason, resolved: target.path, anchor: target.anchor});
    }
  }
  return {files: files.length, checked, errors};
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const result = checkDocLinks();
  if (process.argv.includes("--json")) console.log(JSON.stringify(result, null, 2));
  else {
    for (const e of result.errors) console.error(e.file + ":" + e.line + ": " + e.reason + " " + e.target);
    console.log("Markdown: " + result.files + " files, " + result.checked + " local links, " + result.errors.length + " errors.");
  }
  if (result.errors.length) process.exitCode = 1;
}
