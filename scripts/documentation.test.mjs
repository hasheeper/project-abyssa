import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {execFileSync} from "node:child_process";
import {resolve} from "node:path";
import {projectRoot} from "../config/paths.mjs";
import {maskCode, markdownLinks, localTarget, headingSlug, headingAnchors} from "./check-doc-links.mjs";

test("code fences, comments and inline code retain offsets without generating links", () => {
  const source = "# title\n\x60[code](no.md)\x60\n\x60\x60\x60md\n[x](hidden.md)\n\x60\x60\x60\n<!-- [x](comment.md) -->\n[real](ok.md)\n";
  assert.equal(maskCode(source).length, source.length);
  assert.deepEqual(markdownLinks(source).map(x => [x.target, x.line]), [["ok.md", 7]]);
  assert.equal(markdownLinks("~~~\n[x](hidden.md)\n").length, 0);
  assert.equal(markdownLinks("\x60\x60a \x60 [x](hidden.md)\x60\x60 [yes](ok.md)").length, 1);
});

test("inline, image, angle/space, nested and reference destinations", () => {
  const source = "[\x60label\x60](a.md:12) ![image](<img (old).png>) [a [b]](dir/a(b).md \"Title\")\n[ref]: <with spaces.md> \"Title\"\n";
  const links = markdownLinks(source).sort((a,b) => a.start - b.start);
  assert.deepEqual(links.map(x => x.target), ["a.md:12", "img (old).png", "dir/a(b).md", "with spaces.md"]);
  assert.equal(source.slice(links[1].start, links[1].end), "![image](<img (old).png>)");
  assert.equal(markdownLinks("\\[escaped](none.md)").length, 0);
});

test("local targets handle encodings, fragments, query and line suffixes", () => {
  const from = "/repo/docs/readme.md";
  assert.deepEqual(localTarget("../x%20y.md:42:3?raw=1#%E4%B8%AD%E6%96%87", from), {path: "/repo/x y.md", anchor: "中文"});
  assert.deepEqual(localTarget("#same", from), {path: from, anchor: "same"});
  assert.equal(localTarget("https://example.test/x", from), null);
  assert.equal(localTarget("mailto:user@example.test", from), null);
  assert.equal(localTarget("//example.test/x", from), null);
});

test("heading anchors preserve Chinese, inline code and duplicate ordering", () => {
  assert.equal(headingSlug("10.2 已登记内容与兼容方式"), "102-已登记内容与兼容方式");
  assert.equal(headingSlug("4.2 AIRP第二批：资料与药箱样本先达标"), "42-airp第二批资料与药箱样本先达标");
  const source = "# 重复\n# 重复\n# 重复-1\n# \x60API\x60 与 **文本**\nSetext\n---\n<a id=\"custom\"></a>\n\x60\x60\x60\n# false\n\x60\x60\x60\n";
  assert.deepEqual([...headingAnchors(source)], ["重复", "重复-1", "重复-1-1", "api-与-文本", "setext", "custom"]);
});

const inventory = JSON.parse(execFileSync(process.execPath, ["scripts/export-tutorial-copy.mjs"], {cwd: projectRoot, encoding: "utf8", maxBuffer: 16 * 1024 * 1024}));
test("read-only exporter covers content12 and explicitly labels content11 legacy", () => {
  assert.match(inventory._readme.scope, /当前内容12/);
  const bySource = name => inventory.sections.find(s => s.source.endsWith(name));
  assert.equal(bySource("tide-cave-chapter-one.json").scope, "current");
  assert.equal(bySource("demo-v12/content.ts").scope, "current");
  assert.equal(bySource("tide-cave-guided.json").scope, "legacy");
  assert.equal(bySource("demo-v11/content.ts").scope, "legacy");
  assert.ok(bySource("tide-cave-chapter-one.json").entries.length > 70);
  assert.ok(bySource("tide-cave-chapter-one.json").entries.every(e => !/\/(?:direction|background|actorId|emotion)(?:\/|$)/.test(e.key)));
});

test("handbook exports array paragraphs, controls, steps, tables and numeric cells", () => {
  const section = inventory.sections.find(s => s.source.endsWith("/handbook.json"));
  const source = JSON.parse(readFileSync(resolve(projectRoot, section.source), "utf8"));
  const entries = new Map(section.entries.map(e => [e.key, e.text]));
  const key = "/chapters/0/sections/0/interfaceOverview/walkthrough/0/paragraphs/0";
  assert.equal(entries.get(key), source.chapters[0].sections[0].interfaceOverview.walkthrough[0].paragraphs[0]);
  assert.equal(entries.get("/chapters/0/sections/0/interfaceOverview/controlsLabels/0"), "撤回");
  assert.ok(entries.has("/chapters/0/sections/1/steps/0/1"));
  assert.ok(entries.has("/chapters/0/sections/1/columns/0"));
  assert.ok(entries.has("/chapters/0/sections/1/rows/0/0"));
  assert.equal(entries.get("/figures/die-seals/values/1"), "+0.10");
  assert.ok([...entries.keys()].every(k => !/\/(?:id|chapter|section|figure|figureLayout|rowIcons|itemIcons|table)(?:\/|$)/.test(k)));
});

test("inventory identities and entry counts are unambiguous", () => {
  const identities = inventory.sections.flatMap(s => s.entries.map(e => s.source + ":" + e.key));
  assert.equal(new Set(inventory.sections.map(s => s.source)).size, inventory.sections.length);
  assert.equal(new Set(identities).size, identities.length);
  assert.equal(inventory._readme.entryCount, identities.length);
  assert.equal(inventory._readme.sourceCount, inventory.sections.length);
  for (const s of inventory.sections) assert.match(s.sourceSha256, /^[a-f0-9]{64}$/);
});
